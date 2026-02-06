package controller

import (
	"context"
	"fmt"
	"net/http"
	"sync"
	"time"

	"k8s.io/apimachinery/pkg/api/meta"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/runtime/serializer"
	"k8s.io/client-go/discovery"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/dynamic/dynamicinformer"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/restmapper"
	"k8s.io/client-go/tools/cache"
	"k8s.io/client-go/util/workqueue"
	"k8s.io/klog/v2"

	"go.miloapis.com/activity/pkg/apis/activity/v1alpha1"
)

var (
	// Scheme defines the runtime type system for API object serialization.
	Scheme = runtime.NewScheme()
	// Codecs provides serializers for API objects.
	Codecs = serializer.NewCodecFactory(Scheme)
)

func init() {
	_ = v1alpha1.AddToScheme(Scheme)
}

// ManagerOptions contains configuration for the controller manager.
type ManagerOptions struct {
	// Workers is the number of worker threads for processing items.
	Workers int
	// ResyncPeriod is the resync period in seconds for the informer cache.
	ResyncPeriod int
	// MetricsAddr is the address to bind the metrics endpoint.
	MetricsAddr string
	// HealthProbeAddr is the address to bind the health probe endpoint.
	HealthProbeAddr string
}

// Manager manages the lifecycle of controllers.
type Manager struct {
	config  *rest.Config
	options ManagerOptions

	dynamicClient   dynamic.Interface
	restMapper      meta.RESTMapper
	informerFactory dynamicinformer.DynamicSharedInformerFactory

	// Controllers managed by this manager
	policyController *PolicyController

	// Health and readiness tracking
	mu      sync.RWMutex
	started bool
	healthy bool
}

// NewManager creates a new controller manager.
func NewManager(config *rest.Config, options ManagerOptions) (*Manager, error) {
	// Create dynamic client for watching ActivityPolicy resources
	dynamicClient, err := dynamic.NewForConfig(config)
	if err != nil {
		return nil, fmt.Errorf("failed to create dynamic client: %w", err)
	}

	// Create discovery client and RESTMapper for validating resource types
	discoveryClient, err := discovery.NewDiscoveryClientForConfig(config)
	if err != nil {
		return nil, fmt.Errorf("failed to create discovery client: %w", err)
	}
	groupResources, err := restmapper.GetAPIGroupResources(discoveryClient)
	if err != nil {
		return nil, fmt.Errorf("failed to get API group resources: %w", err)
	}
	restMapper := restmapper.NewDiscoveryRESTMapper(groupResources)

	// Create shared informer factory
	resyncPeriod := time.Duration(options.ResyncPeriod) * time.Second
	informerFactory := dynamicinformer.NewDynamicSharedInformerFactory(dynamicClient, resyncPeriod)

	m := &Manager{
		config:          config,
		options:         options,
		dynamicClient:   dynamicClient,
		restMapper:      restMapper,
		informerFactory: informerFactory,
	}

	// Create the policy controller
	policyController, err := NewPolicyController(
		dynamicClient,
		informerFactory,
		restMapper,
		options.Workers,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create policy controller: %w", err)
	}
	m.policyController = policyController

	return m, nil
}

// Run starts the controller manager and blocks until the context is cancelled.
func (m *Manager) Run(ctx context.Context) error {
	klog.Info("Starting controller manager")

	// Start health and metrics servers
	go m.runHealthServer(ctx)

	// Start the informer factory
	m.informerFactory.Start(ctx.Done())

	// Wait for caches to sync
	klog.Info("Waiting for informer caches to sync")
	syncCtx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	if !cache.WaitForCacheSync(syncCtx.Done(), m.policyController.HasSynced) {
		return fmt.Errorf("timed out waiting for caches to sync")
	}
	klog.Info("Informer caches synced")

	// Mark as started and healthy
	m.mu.Lock()
	m.started = true
	m.healthy = true
	m.mu.Unlock()

	// Run controllers
	errChan := make(chan error, 1)
	go func() {
		if err := m.policyController.Run(ctx); err != nil {
			errChan <- err
		}
	}()

	// Wait for shutdown or error
	select {
	case <-ctx.Done():
		klog.Info("Context cancelled, shutting down controllers")
		return nil
	case err := <-errChan:
		return err
	}
}

// runHealthServer runs the health and readiness probe server.
func (m *Manager) runHealthServer(ctx context.Context) {
	mux := http.NewServeMux()

	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		m.mu.RLock()
		healthy := m.healthy
		m.mu.RUnlock()

		if healthy {
			w.WriteHeader(http.StatusOK)
			w.Write([]byte("ok"))
		} else {
			w.WriteHeader(http.StatusServiceUnavailable)
			w.Write([]byte("not healthy"))
		}
	})

	mux.HandleFunc("/readyz", func(w http.ResponseWriter, r *http.Request) {
		m.mu.RLock()
		started := m.started
		m.mu.RUnlock()

		if started {
			w.WriteHeader(http.StatusOK)
			w.Write([]byte("ok"))
		} else {
			w.WriteHeader(http.StatusServiceUnavailable)
			w.Write([]byte("not ready"))
		}
	})

	server := &http.Server{
		Addr:    m.options.HealthProbeAddr,
		Handler: mux,
	}

	go func() {
		<-ctx.Done()
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		server.Shutdown(shutdownCtx)
	}()

	klog.Infof("Starting health probe server on %s", m.options.HealthProbeAddr)
	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		klog.Errorf("Health probe server error: %v", err)
	}
}

// PolicyController handles ActivityPolicy resource lifecycle.
type PolicyController struct {
	dynamicClient dynamic.Interface
	restMapper    meta.RESTMapper
	informer      cache.SharedIndexInformer
	workqueue     workqueue.TypedRateLimitingInterface[string]
	workers       int

	// policyCache holds the in-memory cache of compiled policies
	policyCache *PolicyCache
}

// ActivityPolicyGVR is the GroupVersionResource for ActivityPolicy.
var ActivityPolicyGVR = schema.GroupVersionResource{
	Group:    v1alpha1.GroupName,
	Version:  "v1alpha1",
	Resource: "activitypolicies",
}

// NewPolicyController creates a new controller for ActivityPolicy resources.
func NewPolicyController(
	dynamicClient dynamic.Interface,
	informerFactory dynamicinformer.DynamicSharedInformerFactory,
	restMapper meta.RESTMapper,
	workers int,
) (*PolicyController, error) {
	informer := informerFactory.ForResource(ActivityPolicyGVR).Informer()

	c := &PolicyController{
		dynamicClient: dynamicClient,
		restMapper:    restMapper,
		informer:      informer,
		workqueue: workqueue.NewTypedRateLimitingQueue(
			workqueue.DefaultTypedControllerRateLimiter[string](),
		),
		workers:     workers,
		policyCache: NewPolicyCache(),
	}

	// Set up event handlers
	informer.AddEventHandler(cache.ResourceEventHandlerFuncs{
		AddFunc: func(obj interface{}) {
			c.enqueue(obj)
		},
		UpdateFunc: func(oldObj, newObj interface{}) {
			c.enqueue(newObj)
		},
		DeleteFunc: func(obj interface{}) {
			c.enqueue(obj)
		},
	})

	return c, nil
}

// HasSynced returns true if the informer cache has synced.
func (c *PolicyController) HasSynced() bool {
	return c.informer.HasSynced()
}

// Run starts the controller workers.
func (c *PolicyController) Run(ctx context.Context) error {
	defer c.workqueue.ShutDown()

	klog.Info("Starting ActivityPolicy controller")

	// Start workers
	for i := 0; i < c.workers; i++ {
		go c.runWorker(ctx)
	}

	klog.Infof("Started %d workers for ActivityPolicy controller", c.workers)

	<-ctx.Done()
	klog.Info("Shutting down ActivityPolicy controller")
	return nil
}

// runWorker processes items from the workqueue.
func (c *PolicyController) runWorker(ctx context.Context) {
	for c.processNextItem(ctx) {
	}
}

// processNextItem processes the next item from the workqueue.
func (c *PolicyController) processNextItem(ctx context.Context) bool {
	key, shutdown := c.workqueue.Get()
	if shutdown {
		return false
	}
	defer c.workqueue.Done(key)

	if err := c.syncHandler(ctx, key); err != nil {
		// Requeue with rate limiting
		c.workqueue.AddRateLimited(key)
		klog.Errorf("Error syncing ActivityPolicy %s: %v", key, err)
		return true
	}

	// Forget the item (clear rate limiting)
	c.workqueue.Forget(key)
	klog.V(4).Infof("Successfully synced ActivityPolicy %s", key)
	return true
}

// syncHandler handles the business logic for a single ActivityPolicy.
func (c *PolicyController) syncHandler(ctx context.Context, key string) error {
	// Get the object from the informer cache
	obj, exists, err := c.informer.GetStore().GetByKey(key)
	if err != nil {
		return fmt.Errorf("error fetching object with key %s from store: %w", key, err)
	}

	if !exists {
		// Object was deleted, remove from cache
		klog.V(2).Infof("ActivityPolicy %s was deleted, removing from cache", key)
		c.policyCache.Delete(key)
		return nil
	}

	// Get the unstructured object for status updates
	u, ok := obj.(*unstructured.Unstructured)
	if !ok {
		return fmt.Errorf("expected *unstructured.Unstructured, got %T", obj)
	}

	// Convert unstructured to ActivityPolicy
	policy, err := c.policyCache.ConvertToActivityPolicy(obj)
	if err != nil {
		return fmt.Errorf("error converting object to ActivityPolicy: %w", err)
	}

	// Determine Ready condition
	condition := metav1.Condition{
		Type:               "Ready",
		ObservedGeneration: policy.Generation,
		LastTransitionTime: metav1.Now(),
	}

	// Validate that the target resource type exists in the cluster
	if validationErr := c.validateResourceExists(policy.Spec.Resource.APIGroup, policy.Spec.Resource.Kind); validationErr != nil {
		condition.Status = metav1.ConditionFalse
		condition.Reason = "ResourceNotFound"
		condition.Message = validationErr.Error()
		klog.V(2).Infof("ActivityPolicy %s targets non-existent resource: %v", key, validationErr)

		// Update status but don't add to cache - policy can't work without the resource
		if err := c.updatePolicyStatus(ctx, u, policy.Generation, condition); err != nil {
			return fmt.Errorf("error updating policy status: %w", err)
		}
		return nil
	}

	// Update the cache with the new/updated policy and capture any validation errors
	klog.V(2).Infof("Updating ActivityPolicy %s in cache", key)
	cacheErr := c.policyCache.Update(key, policy)

	if cacheErr != nil {
		condition.Status = metav1.ConditionFalse
		condition.Reason = "CompilationFailed"
		condition.Message = cacheErr.Error()
		klog.V(2).Infof("ActivityPolicy %s failed validation: %v", key, cacheErr)
	} else {
		condition.Status = metav1.ConditionTrue
		condition.Reason = "Valid"
		condition.Message = "All rules compiled successfully"
		klog.V(2).Infof("ActivityPolicy %s validated successfully", key)
	}

	// Update status via /status subresource
	if err := c.updatePolicyStatus(ctx, u, policy.Generation, condition); err != nil {
		return fmt.Errorf("error updating policy status: %w", err)
	}

	// Return the cache error if there was one (for requeuing)
	if cacheErr != nil {
		return nil // Don't requeue for validation errors - status shows the problem
	}

	return nil
}

// updatePolicyStatus updates the status of an ActivityPolicy.
func (c *PolicyController) updatePolicyStatus(ctx context.Context, u *unstructured.Unstructured, generation int64, condition metav1.Condition) error {
	// Check if status already has the same condition to avoid unnecessary updates
	existingConditions, _, _ := unstructured.NestedSlice(u.Object, "status", "conditions")
	for _, c := range existingConditions {
		cond, ok := c.(map[string]interface{})
		if !ok {
			continue
		}
		if cond["type"] == condition.Type &&
			cond["status"] == string(condition.Status) &&
			cond["reason"] == condition.Reason &&
			cond["message"] == condition.Message {
			// Condition already matches, no update needed
			return nil
		}
	}

	// Build the status update
	conditionMap := map[string]interface{}{
		"type":               condition.Type,
		"status":             string(condition.Status),
		"reason":             condition.Reason,
		"message":            condition.Message,
		"lastTransitionTime": condition.LastTransitionTime.Format(time.RFC3339),
		"observedGeneration": condition.ObservedGeneration,
	}

	// Create a copy of the object for the status update
	statusUpdate := u.DeepCopy()

	// Set the conditions array (replace the Ready condition or add it)
	var newConditions []interface{}
	found := false
	for _, c := range existingConditions {
		cond, ok := c.(map[string]interface{})
		if !ok {
			continue
		}
		if cond["type"] == condition.Type {
			newConditions = append(newConditions, conditionMap)
			found = true
		} else {
			newConditions = append(newConditions, c)
		}
	}
	if !found {
		newConditions = append(newConditions, conditionMap)
	}

	// Set the status fields
	if err := unstructured.SetNestedSlice(statusUpdate.Object, newConditions, "status", "conditions"); err != nil {
		return fmt.Errorf("failed to set status.conditions: %w", err)
	}
	if err := unstructured.SetNestedField(statusUpdate.Object, generation, "status", "observedGeneration"); err != nil {
		return fmt.Errorf("failed to set status.observedGeneration: %w", err)
	}

	// Update via the status subresource
	_, err := c.dynamicClient.Resource(ActivityPolicyGVR).UpdateStatus(ctx, statusUpdate, metav1.UpdateOptions{})
	if err != nil {
		return fmt.Errorf("failed to update status: %w", err)
	}

	klog.V(4).Infof("Updated ActivityPolicy %s status: Ready=%s", u.GetName(), condition.Status)
	return nil
}

// enqueue adds an object to the workqueue.
func (c *PolicyController) enqueue(obj interface{}) {
	key, err := cache.MetaNamespaceKeyFunc(obj)
	if err != nil {
		klog.Errorf("Error getting key for object: %v", err)
		return
	}
	c.workqueue.Add(key)
}

// GetPolicyCache returns the policy cache for use by other components.
func (c *PolicyController) GetPolicyCache() *PolicyCache {
	return c.policyCache
}

// validateResourceExists checks if the specified apiGroup/kind exists in the cluster.
// It returns an error if the resource is not found or if the kind doesn't match exactly.
func (c *PolicyController) validateResourceExists(apiGroup, kind string) error {
	if c.restMapper == nil {
		klog.V(2).Infof("RESTMapper is nil, skipping resource validation for %s/%s", apiGroup, kind)
		return nil // Skip validation if no RESTMapper available
	}

	// Find all resources in the specified API group
	gk := schema.GroupKind{Group: apiGroup, Kind: kind}
	klog.V(2).Infof("Validating resource exists: apiGroup=%s, kind=%s", apiGroup, kind)
	mapping, err := c.restMapper.RESTMapping(gk)
	if err != nil {
		klog.V(2).Infof("RESTMapping failed for %s/%s: %v", apiGroup, kind, err)
		// Check if it's a "no match" error and provide a helpful message
		if meta.IsNoMatchError(err) {
			return fmt.Errorf("resource %q not found in API group %q - verify the Kind is spelled correctly (case-sensitive) and the CRD is installed", kind, apiGroup)
		}
		return fmt.Errorf("failed to validate resource %s/%s: %w", apiGroup, kind, err)
	}

	klog.V(2).Infof("RESTMapping found for %s/%s: GVK=%v", apiGroup, kind, mapping.GroupVersionKind)

	// Verify the kind matches exactly (case-sensitive)
	if mapping.GroupVersionKind.Kind != kind {
		klog.V(2).Infof("Kind mismatch for %s: specified=%q, actual=%q", apiGroup, kind, mapping.GroupVersionKind.Kind)
		return fmt.Errorf("kind mismatch: specified %q but API server has %q", kind, mapping.GroupVersionKind.Kind)
	}

	klog.V(2).Infof("Resource validation passed for %s/%s", apiGroup, kind)
	return nil
}
