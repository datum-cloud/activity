package controller

import (
	"context"
	"fmt"

	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	utilruntime "k8s.io/apimachinery/pkg/util/runtime"
	clientgoscheme "k8s.io/client-go/kubernetes/scheme"
	"k8s.io/client-go/rest"
	"k8s.io/klog/v2"
	ctrl "sigs.k8s.io/controller-runtime"
	"sigs.k8s.io/controller-runtime/pkg/healthz"
	metricsserver "sigs.k8s.io/controller-runtime/pkg/metrics/server"

	"go.miloapis.com/activity/pkg/apis/activity/v1alpha1"
)

var (
	// Scheme defines the runtime type system for API object serialization.
	Scheme = runtime.NewScheme()
)

func init() {
	utilruntime.Must(clientgoscheme.AddToScheme(Scheme))
	utilruntime.Must(v1alpha1.AddToScheme(Scheme))
}

// ManagerOptions contains configuration for the controller manager.
type ManagerOptions struct {
	// Workers is the number of worker threads for processing items.
	Workers int
	// MetricsAddr is the address to bind the metrics endpoint.
	MetricsAddr string
	// HealthProbeAddr is the address to bind the health probe endpoint.
	HealthProbeAddr string
}

// ActivityPolicyGVR is the GroupVersionResource for ActivityPolicy.
var ActivityPolicyGVR = schema.GroupVersionResource{
	Group:    v1alpha1.GroupName,
	Version:  "v1alpha1",
	Resource: "activitypolicies",
}

// NewManager creates a new controller manager using controller-runtime.
func NewManager(config *rest.Config, options ManagerOptions) (ctrl.Manager, error) {
	mgr, err := ctrl.NewManager(config, ctrl.Options{
		Scheme:                 Scheme,
		HealthProbeBindAddress: options.HealthProbeAddr,
		Metrics: metricsserver.Options{
			BindAddress: options.MetricsAddr,
		},
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create manager: %w", err)
	}

	// Add health and readiness checks
	if err := mgr.AddHealthzCheck("healthz", healthz.Ping); err != nil {
		return nil, fmt.Errorf("failed to add healthz check: %w", err)
	}
	if err := mgr.AddReadyzCheck("readyz", healthz.Ping); err != nil {
		return nil, fmt.Errorf("failed to add readyz check: %w", err)
	}

	// Create and register the ActivityPolicy reconciler
	reconciler := &ActivityPolicyReconciler{
		Client:     mgr.GetClient(),
		Scheme:     mgr.GetScheme(),
		RESTMapper: mgr.GetRESTMapper(),
	}

	if err := reconciler.SetupWithManager(mgr, options.Workers); err != nil {
		return nil, fmt.Errorf("failed to create ActivityPolicy controller: %w", err)
	}

	return mgr, nil
}

// Run starts the controller manager and blocks until the context is cancelled.
func Run(ctx context.Context, mgr ctrl.Manager) error {
	klog.Info("Starting controller manager")
	return mgr.Start(ctx)
}
