package processor

import (
	"fmt"

	"k8s.io/apimachinery/pkg/api/meta"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/discovery"
	"k8s.io/client-go/discovery/cached/memory"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/restmapper"
	"k8s.io/klog/v2"
)

// ResourceResolver resolves a Kind to its plural resource name using API discovery.
type ResourceResolver func(apiGroup, kind string) (string, error)

// NewKindResolver creates a KindResolver that uses a ResettableRESTMapper.
// On cache miss, it resets the discovery cache and retries to handle newly registered CRDs.
func NewKindResolver(mapper meta.ResettableRESTMapper) KindResolver {
	return func(apiGroup, resource string) (string, error) {
		gvr := schema.GroupVersionResource{
			Group:    apiGroup,
			Resource: resource,
		}

		kinds, err := mapper.KindsFor(gvr)
		if err != nil {
			if meta.IsNoMatchError(err) {
				klog.V(2).InfoS("Kind mapping not found, resetting discovery cache",
					"apiGroup", apiGroup,
					"resource", resource,
				)
				mapper.Reset()

				kinds, err = mapper.KindsFor(gvr)
				if err != nil {
					return "", fmt.Errorf("failed to find kind for %s/%s: %w", apiGroup, resource, err)
				}
			} else {
				return "", fmt.Errorf("failed to find kind for %s/%s: %w", apiGroup, resource, err)
			}
		}

		if len(kinds) == 0 {
			return "", fmt.Errorf("no kind found for %s/%s", apiGroup, resource)
		}

		return kinds[0].Kind, nil
	}
}

// NewResourceResolver creates a ResourceResolver that uses a ResettableRESTMapper.
// On cache miss, it resets the discovery cache and retries.
func NewResourceResolver(mapper meta.ResettableRESTMapper) ResourceResolver {
	return func(apiGroup, kind string) (string, error) {
		gk := schema.GroupKind{
			Group: apiGroup,
			Kind:  kind,
		}

		mapping, err := mapper.RESTMapping(gk)
		if err != nil {
			if meta.IsNoMatchError(err) {
				klog.V(2).InfoS("Resource mapping not found, resetting discovery cache",
					"apiGroup", apiGroup,
					"kind", kind,
				)
				mapper.Reset()

				mapping, err = mapper.RESTMapping(gk)
				if err != nil {
					return "", fmt.Errorf("failed to find resource mapping for %s/%s: %w", apiGroup, kind, err)
				}
			} else {
				return "", fmt.Errorf("failed to find resource mapping for %s/%s: %w", apiGroup, kind, err)
			}
		}

		return mapping.Resource.Resource, nil
	}
}

// NewRESTMapperFromConfig creates a ResettableRESTMapper from a Kubernetes rest.Config.
// Uses a cached discovery client for efficient API group/resource lookups.
func NewRESTMapperFromConfig(config *rest.Config) (meta.ResettableRESTMapper, error) {
	discoveryClient, err := discovery.NewDiscoveryClientForConfig(config)
	if err != nil {
		return nil, fmt.Errorf("failed to create discovery client: %w", err)
	}

	cachedClient := memory.NewMemCacheClient(discoveryClient)
	mapper := restmapper.NewDeferredDiscoveryRESTMapper(cachedClient)

	return mapper, nil
}
