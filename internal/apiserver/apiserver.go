package apiserver

import (
	"context"
	"fmt"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/runtime/serializer"
	"k8s.io/apiserver/pkg/registry/rest"
	genericapiserver "k8s.io/apiserver/pkg/server"
	"k8s.io/klog/v2"

	_ "go.miloapis.com/activity/internal/metrics"
	"go.miloapis.com/activity/internal/registry/activity/activityquery"
	"go.miloapis.com/activity/internal/registry/activity/auditlog"
	"go.miloapis.com/activity/internal/registry/activity/auditlogfacet"
	"go.miloapis.com/activity/internal/registry/activity/eventfacet"
	"go.miloapis.com/activity/internal/registry/activity/eventquery"
	"go.miloapis.com/activity/internal/registry/activity/events"
	"go.miloapis.com/activity/internal/registry/activity/facet"
	"go.miloapis.com/activity/internal/registry/activity/policy"
	"go.miloapis.com/activity/internal/registry/activity/preview"
	"go.miloapis.com/activity/internal/registry/activity/record"
	"go.miloapis.com/activity/internal/registry/activity/reindexjob"
	"go.miloapis.com/activity/internal/storage"
	"go.miloapis.com/activity/internal/watch"
	"go.miloapis.com/activity/pkg/apis/activity/install"
	"go.miloapis.com/activity/pkg/apis/activity/v1alpha1"
)

var (
	// Scheme defines the runtime type system for API object serialization.
	Scheme = runtime.NewScheme()
	// Codecs provides serializers for API objects.
	Codecs = serializer.NewCodecFactory(Scheme)
)

func init() {
	install.Install(Scheme)

	metav1.AddToGroupVersion(Scheme, schema.GroupVersion{Version: "v1"})

	// Register unversioned meta types required by the API machinery.
	unversioned := schema.GroupVersion{Group: "", Version: "v1"}
	Scheme.AddUnversionedTypes(unversioned,
		&metav1.Status{},
		&metav1.APIVersions{},
		&metav1.APIGroupList{},
		&metav1.APIGroup{},
		&metav1.APIResourceList{},
	)
}

// ExtraConfig extends the generic apiserver configuration with activity-specific settings.
type ExtraConfig struct {
	ClickHouseConfig storage.ClickHouseConfig
	NATSConfig       watch.NATSConfig
	EventsNATSConfig watch.NATSConfig
}

// Config combines generic and activity-specific configuration.
type Config struct {
	GenericConfig *genericapiserver.RecommendedConfig
	ExtraConfig   ExtraConfig
}

// ActivityServer is the activity audit log apiserver.
type ActivityServer struct {
	GenericAPIServer *genericapiserver.GenericAPIServer
	storage          *storage.ClickHouseStorage
	watcher          *watch.NATSWatcher
	eventsWatcher    *watch.EventsWatcher
}

type completedConfig struct {
	GenericConfig genericapiserver.CompletedConfig
	ExtraConfig   *ExtraConfig
}

// CompletedConfig prevents incomplete configuration from being used.
// Embeds a private pointer that can only be created via Complete().
type CompletedConfig struct {
	*completedConfig
}

// Complete validates and fills default values for the configuration.
func (cfg *Config) Complete() CompletedConfig {
	c := completedConfig{
		cfg.GenericConfig.Complete(),
		&cfg.ExtraConfig,
	}

	return CompletedConfig{&c}
}

// New creates and initializes the ActivityServer with storage and API groups.
func (c completedConfig) New() (*ActivityServer, error) {
	genericServer, err := c.GenericConfig.New("activity-apiserver", genericapiserver.NewEmptyDelegate())
	if err != nil {
		return nil, err
	}

	clickhouseStorage, err := storage.NewClickHouseStorage(c.ExtraConfig.ClickHouseConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to create ClickHouse storage: %w", err)
	}

	// Create NATS watcher for Watch API (optional - returns nil if not configured)
	watcher, err := watch.NewNATSWatcher(c.ExtraConfig.NATSConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to create NATS watcher: %w", err)
	}

	// Create NATS watcher for Events Watch API (optional - returns nil if not configured)
	eventsNATSWatcher, err := watch.NewNATSWatcher(c.ExtraConfig.EventsNATSConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to create Events NATS watcher: %w", err)
	}

	var eventsWatcher *watch.EventsWatcher
	if eventsNATSWatcher != nil {
		eventsWatcher = watch.NewEventsWatcher(eventsNATSWatcher)
	}

	s := &ActivityServer{
		GenericAPIServer: genericServer,
		storage:          clickhouseStorage,
		watcher:          watcher,
		eventsWatcher:    eventsWatcher,
	}

	apiGroupInfo := genericapiserver.NewDefaultAPIGroupInfo(v1alpha1.GroupName, Scheme, metav1.ParameterCodec, Codecs)

	v1alpha1Storage := map[string]rest.Storage{}
	v1alpha1Storage["auditlogqueries"] = auditlog.NewQueryStorage(clickhouseStorage)
	v1alpha1Storage["auditlogfacetsqueries"] = auditlogfacet.NewAuditLogFacetsQueryStorage(clickhouseStorage)

	// ActivityPolicy is stored in etcd
	policyStorage, policyStatusStorage, err := policy.NewStorage(Scheme, c.GenericConfig.RESTOptionsGetter)
	if err != nil {
		return nil, fmt.Errorf("failed to create ActivityPolicy storage: %w", err)
	}
	v1alpha1Storage["activitypolicies"] = policyStorage
	v1alpha1Storage["activitypolicies/status"] = policyStatusStorage

	// ReindexJob is stored in etcd (namespace-scoped)
	reindexJobStorage, reindexJobStatusStorage, err := reindexjob.NewStorage(Scheme, c.GenericConfig.RESTOptionsGetter)
	if err != nil {
		return nil, fmt.Errorf("failed to create ReindexJob storage: %w", err)
	}
	v1alpha1Storage["reindexjobs"] = reindexJobStorage
	v1alpha1Storage["reindexjobs/status"] = reindexJobStatusStorage

	// Activity List/Watch for real-time streaming (last hour, standard field selectors)
	v1alpha1Storage["activities"] = record.NewActivityStorageWithWatcher(clickhouseStorage, watcher)

	// ActivityQuery for historical queries (custom time ranges, search, CEL filters)
	v1alpha1Storage["activityqueries"] = activityquery.NewQueryStorage(clickhouseStorage)

	// ActivityFacetQuery for faceted search on activities
	v1alpha1Storage["activityfacetqueries"] = facet.NewFacetQueryStorage(clickhouseStorage)

	// PolicyPreview for testing policies without persisting
	v1alpha1Storage["policypreviews"] = preview.NewPolicyPreviewStorage()

	// Create events backend using the same ClickHouse connection
	eventsBackend := storage.NewClickHouseEventsBackend(clickhouseStorage.Conn(), storage.ClickHouseEventsConfig{
		Database: clickhouseStorage.Config().Database,
	})

	// Create NATS publisher for events if configured
	// When configured, events will be published to NATS instead of written directly to ClickHouse
	// Vector will consume from NATS and write to ClickHouse
	if c.ExtraConfig.EventsNATSConfig.URL != "" {
		eventsPublisher, err := storage.NewEventsPublisher(storage.EventsPublisherConfig{
			URL:           c.ExtraConfig.EventsNATSConfig.URL,
			StreamName:    c.ExtraConfig.EventsNATSConfig.StreamName,
			SubjectPrefix: c.ExtraConfig.EventsNATSConfig.SubjectPrefix,
			TLSEnabled:    c.ExtraConfig.EventsNATSConfig.TLSEnabled,
			TLSCertFile:   c.ExtraConfig.EventsNATSConfig.TLSCertFile,
			TLSKeyFile:    c.ExtraConfig.EventsNATSConfig.TLSKeyFile,
			TLSCAFile:     c.ExtraConfig.EventsNATSConfig.TLSCAFile,
		})
		if err != nil {
			return nil, fmt.Errorf("failed to create events NATS publisher: %w", err)
		}
		if eventsPublisher != nil {
			eventsBackend.SetPublisher(eventsPublisher)
			klog.Info("Events will be published to NATS for processing by Vector")
		}
	}

	// Note: Events are NOT exposed under activity.miloapis.com/v1alpha1.
	// They are served via the standard Kubernetes API paths:
	// - /api/v1/namespaces/{ns}/events (core/v1)
	// - /apis/events.k8s.io/v1/namespaces/{ns}/events (events.k8s.io/v1)
	// This avoids OpenAPI GVK conflicts since corev1.Event has its OpenAPIModelName()
	// returning io.k8s.api.core.v1.Event with GVK [/v1, Kind=Event].

	// EventFacetQuery for faceted search on Kubernetes Events
	v1alpha1Storage["eventfacetqueries"] = eventfacet.NewEventFacetQueryStorage(eventsBackend)

	// EventQuery for historical event queries up to 60 days (no 24-hour limit)
	eventQueryBackend := storage.NewClickHouseEventQueryBackend(clickhouseStorage.Conn(), storage.ClickHouseEventsConfig{
		Database: clickhouseStorage.Config().Database,
	})
	v1alpha1Storage["eventqueries"] = eventquery.NewEventQueryREST(eventQueryBackend)

	apiGroupInfo.VersionedResourcesStorageMap["v1alpha1"] = v1alpha1Storage

	if err := s.GenericAPIServer.InstallAPIGroup(&apiGroupInfo); err != nil {
		return nil, err
	}

	// Install legacy core/v1 API group for Kubernetes Events
	// This enables proxying Events from Milo without GVK transformation
	// Serves Events at: /api/v1/namespaces/{namespace}/events
	if err := s.installLegacyCoreAPIGroup(eventsBackend); err != nil {
		return nil, fmt.Errorf("failed to install legacy core API group: %w", err)
	}

	// Install events.k8s.io API group for newer Events API
	// This enables serving Events under the newer events.k8s.io/v1 API group
	// Serves Events at: /apis/events.k8s.io/v1/namespaces/{namespace}/events
	if err := s.installEventsAPIGroup(eventsBackend); err != nil {
		return nil, fmt.Errorf("failed to install events.k8s.io API group: %w", err)
	}

	klog.Info("Activity server initialized successfully")

	return s, nil
}

// installLegacyCoreAPIGroup installs the legacy core/v1 API group for Events.
// This allows serving Events under /api/v1/namespaces/{ns}/events (in addition to activity.miloapis.com).
func (s *ActivityServer) installLegacyCoreAPIGroup(eventsBackend *storage.ClickHouseEventsBackend) error {
	// Create API group info for core/v1 (legacy API)
	// The core API group has an empty string for the group name
	coreAPIGroupInfo := genericapiserver.NewDefaultAPIGroupInfo("", Scheme, metav1.ParameterCodec, Codecs)

	// Create storage map for v1 resources
	v1Storage := map[string]rest.Storage{}

	// Reuse the same events storage backend - it will serve Events under both API groups
	if s.eventsWatcher != nil {
		v1Storage["events"] = events.NewEventsRESTWithWatcher(eventsBackend, s.eventsWatcher)
	} else {
		v1Storage["events"] = events.NewEventsREST(eventsBackend)
	}

	coreAPIGroupInfo.VersionedResourcesStorageMap["v1"] = v1Storage

	// Install legacy API group (uses InstallLegacyAPIGroup for core API)
	// The prefix must be "/api" for the legacy core API group
	if err := s.GenericAPIServer.InstallLegacyAPIGroup("/api", &coreAPIGroupInfo); err != nil {
		return err
	}

	klog.Info("Installed legacy core/v1 API group for Events")
	return nil
}

// installEventsAPIGroup installs the events.k8s.io API group for the newer Events API.
// This allows serving Events under /apis/events.k8s.io/v1/namespaces/{ns}/events.
func (s *ActivityServer) installEventsAPIGroup(eventsBackend *storage.ClickHouseEventsBackend) error {
	// Create API group info for events.k8s.io
	eventsAPIGroupInfo := genericapiserver.NewDefaultAPIGroupInfo("events.k8s.io", Scheme, metav1.ParameterCodec, Codecs)

	// Create storage map for v1 resources
	v1Storage := map[string]rest.Storage{}

	// Use the eventsv1 storage adapter which converts between eventsv1.Event and corev1.Event
	if s.eventsWatcher != nil {
		v1Storage["events"] = events.NewEventsV1RESTWithWatcher(eventsBackend, s.eventsWatcher)
	} else {
		v1Storage["events"] = events.NewEventsV1REST(eventsBackend)
	}

	eventsAPIGroupInfo.VersionedResourcesStorageMap["v1"] = v1Storage

	// Install the API group (use InstallAPIGroup for named API groups)
	if err := s.GenericAPIServer.InstallAPIGroup(&eventsAPIGroupInfo); err != nil {
		return err
	}

	klog.Info("Installed events.k8s.io/v1 API group for Events")
	return nil
}

// Run starts the server and ensures storage cleanup on shutdown.
func (s *ActivityServer) Run(ctx context.Context) error {
	defer s.storage.Close()
	if s.watcher != nil {
		defer s.watcher.Close()
	}
	return s.GenericAPIServer.PrepareRun().RunWithContext(ctx)
}
