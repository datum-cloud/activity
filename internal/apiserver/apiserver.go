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
	"go.miloapis.com/activity/internal/registry/activity/auditlog"
	"go.miloapis.com/activity/internal/registry/activity/auditlogfacet"
	"go.miloapis.com/activity/internal/registry/activity/policy"
	"go.miloapis.com/activity/internal/registry/activity/preview"
	"go.miloapis.com/activity/internal/storage"
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

	s := &ActivityServer{
		GenericAPIServer: genericServer,
		storage:          clickhouseStorage,
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

	// PolicyPreview for testing policies without persisting
	v1alpha1Storage["policypreviews"] = preview.NewPolicyPreviewStorage()

	apiGroupInfo.VersionedResourcesStorageMap["v1alpha1"] = v1alpha1Storage

	if err := s.GenericAPIServer.InstallAPIGroup(&apiGroupInfo); err != nil {
		return nil, err
	}

	klog.Info("Activity server initialized successfully")

	return s, nil
}

// Run starts the server and ensures storage cleanup on shutdown.
func (s *ActivityServer) Run(ctx context.Context) error {
	defer s.storage.Close()
	return s.GenericAPIServer.PrepareRun().RunWithContext(ctx)
}
