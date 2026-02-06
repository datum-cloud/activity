package record

import (
	"net/http"

	"k8s.io/apiserver/pkg/endpoints/request"
	genericapiserver "k8s.io/apiserver/pkg/server"
	"k8s.io/klog/v2"
)

// ActivityQueryParamsHandler wraps an http.Handler to extract custom activity
// query parameters from the request and inject them into the context.
// This allows the storage layer to access parameters like start, end, search
// that aren't part of standard Kubernetes ListOptions.
type ActivityQueryParamsHandler struct {
	handler http.Handler
}

// NewActivityQueryParamsHandler creates a new handler wrapper.
func NewActivityQueryParamsHandler(handler http.Handler) *ActivityQueryParamsHandler {
	return &ActivityQueryParamsHandler{handler: handler}
}

// ServeHTTP extracts activity query params and injects them into the context.
func (h *ActivityQueryParamsHandler) ServeHTTP(w http.ResponseWriter, req *http.Request) {
	// Only process requests to the activities endpoint
	requestInfo, ok := request.RequestInfoFrom(req.Context())
	if !ok {
		klog.V(4).InfoS("ActivityQueryParamsHandler: requestInfo not found in context", "url", req.URL.String())
		h.handler.ServeHTTP(w, req)
		return
	}

	if requestInfo.Resource != "activities" {
		h.handler.ServeHTTP(w, req)
		return
	}

	// Only inject params for list and watch operations
	if requestInfo.Verb != "list" && requestInfo.Verb != "watch" {
		klog.V(4).InfoS("ActivityQueryParamsHandler: skipping verb", "verb", requestInfo.Verb)
		h.handler.ServeHTTP(w, req)
		return
	}

	// Extract custom query parameters
	query := req.URL.Query()
	params := ActivityQueryParams{
		StartTime:    query.Get("start"),
		EndTime:      query.Get("end"),
		Search:       query.Get("search"),
		ChangeSource: query.Get("changeSource"),
		Filter:       query.Get("filter"),
	}

	klog.V(4).InfoS("ActivityQueryParamsHandler: injecting params",
		"startTime", params.StartTime,
		"endTime", params.EndTime,
		"search", params.Search,
		"changeSource", params.ChangeSource,
		"filter", params.Filter,
	)

	// Inject params into context
	ctx := WithActivityQueryParams(req.Context(), params)
	req = req.WithContext(ctx)

	h.handler.ServeHTTP(w, req)
}

// WrapHandler creates a handler wrapper as a filter function.
// This can be used with the apiserver's filter chain.
func WrapHandler(handler http.Handler) http.Handler {
	return NewActivityQueryParamsHandler(handler)
}

// BuildHandlerChainWithActivityParams creates a handler chain builder that includes
// the activity query params filter. This should be used to wrap the default handler chain.
//
// The wrapper is injected INSIDE the handler chain by wrapping the apiHandler before
// building the chain. This ensures the requestInfo is available when our wrapper is called.
//
// Usage in apiserver config:
//
//	config.GenericConfig.BuildHandlerChainFunc = record.BuildHandlerChainWithActivityParams(
//	    genericapiserver.DefaultBuildHandlerChain,
//	)
func BuildHandlerChainWithActivityParams(delegate func(apiHandler http.Handler, c *genericapiserver.Config) http.Handler) func(apiHandler http.Handler, c *genericapiserver.Config) http.Handler {
	return func(apiHandler http.Handler, c *genericapiserver.Config) http.Handler {
		// Wrap the API handler with our param extractor BEFORE building the chain.
		// This ensures our wrapper is called AFTER the requestInfo filter (which is
		// part of the outer chain) sets up the request context.
		wrappedApiHandler := WrapHandler(apiHandler)
		// Now build the chain with the wrapped handler
		return delegate(wrappedApiHandler, c)
	}
}
