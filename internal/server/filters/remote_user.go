// Package filters provides HTTP filter/middleware implementations for the Activity server.
package filters

import (
	"net/http"
	"net/url"
	"strings"

	"k8s.io/apiserver/pkg/authentication/user"
	"k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/klog/v2"
)

// RemoteUserHeaders defines the HTTP headers used for remote user authentication.
// These headers are typically set by an authenticating proxy (e.g., the Milo API gateway).
const (
	// HeaderRemoteUser contains the authenticated username
	HeaderRemoteUser = "X-Remote-User"

	// HeaderRemoteUID contains the authenticated user's UID
	HeaderRemoteUID = "X-Remote-Uid"

	// HeaderRemoteGroup contains the authenticated user's groups (may appear multiple times)
	HeaderRemoteGroup = "X-Remote-Group"

	// HeaderRemoteExtraPrefix is the prefix for extra user attributes
	// The full header name is X-Remote-Extra-{key} where key is URL-encoded
	HeaderRemoteExtraPrefix = "X-Remote-Extra-"
)

// WithRemoteUser returns an HTTP handler that extracts user information from
// X-Remote-* headers and injects it into the request context.
//
// This is used when the Activity server is deployed behind an authenticating proxy
// (like the Milo API gateway) that sets these headers after authenticating the user.
//
// Expected headers:
//   - X-Remote-User: The authenticated username
//   - X-Remote-Uid: The authenticated user's UID
//   - X-Remote-Group: The authenticated user's groups (may appear multiple times)
//   - X-Remote-Extra-{key}: Additional user attributes (URL-encoded keys)
//
// Note: The Kubernetes apiserver already has built-in support for request header
// authentication via the --requestheader-* flags. This middleware is provided
// as a simpler alternative for deployments that don't use the full request header
// authenticator configuration.
func WithRemoteUser(handler http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		username := req.Header.Get(HeaderRemoteUser)
		if username == "" {
			// No remote user header - pass through to next handler
			handler.ServeHTTP(w, req)
			return
		}

		uid := req.Header.Get(HeaderRemoteUID)
		groups := req.Header[HeaderRemoteGroup]
		extra := extractExtraHeaders(req.Header)

		userInfo := &user.DefaultInfo{
			Name:   username,
			UID:    uid,
			Groups: groups,
			Extra:  extra,
		}

		klog.V(4).InfoS("Remote user authentication",
			"user", username,
			"uid", uid,
			"groups", groups,
			"extraKeys", getExtraKeys(extra),
		)

		// Add user to context
		ctx := request.WithUser(req.Context(), userInfo)
		req = req.WithContext(ctx)

		handler.ServeHTTP(w, req)
	})
}

// extractExtraHeaders extracts X-Remote-Extra-* headers into a map.
// The header name format is X-Remote-Extra-{url-encoded-key}.
// Keys are URL-decoded to match what the Kubernetes API expects.
func extractExtraHeaders(headers http.Header) map[string][]string {
	extra := make(map[string][]string)

	for key, values := range headers {
		// HTTP headers are case-insensitive, but Go's http.Header canonicalizes them
		// Check with case-insensitive prefix matching
		if !strings.HasPrefix(strings.ToLower(key), strings.ToLower(HeaderRemoteExtraPrefix)) {
			continue
		}

		// Extract the key name (everything after the prefix)
		extraKey := key[len(HeaderRemoteExtraPrefix):]
		if extraKey == "" {
			continue
		}

		// URL decode the key (keys are URL-encoded to be header-safe)
		decodedKey, err := url.QueryUnescape(extraKey)
		if err != nil {
			// If decoding fails, use the original key
			klog.V(4).InfoS("Failed to URL-decode extra header key", "key", extraKey, "error", err)
			decodedKey = extraKey
		}

		extra[decodedKey] = values
	}

	return extra
}

// getExtraKeys returns the keys from an extra map for logging.
func getExtraKeys(extra map[string][]string) []string {
	keys := make([]string, 0, len(extra))
	for k := range extra {
		keys = append(keys, k)
	}
	return keys
}

// RemoteUserConfig holds configuration for the remote user authenticator.
type RemoteUserConfig struct {
	// UsernameHeader is the header containing the username (default: X-Remote-User)
	UsernameHeader string

	// UIDHeader is the header containing the user's UID (default: X-Remote-Uid)
	UIDHeader string

	// GroupHeaders are the headers containing group memberships (default: X-Remote-Group)
	GroupHeaders []string

	// ExtraHeaderPrefixes are the prefixes for extra attribute headers
	// (default: X-Remote-Extra-)
	ExtraHeaderPrefixes []string

	// AllowedClientCAFile is the path to a CA bundle to verify client certificates
	// when using mutual TLS with the authenticating proxy
	AllowedClientCAFile string
}

// DefaultRemoteUserConfig returns the default configuration for remote user authentication.
func DefaultRemoteUserConfig() RemoteUserConfig {
	return RemoteUserConfig{
		UsernameHeader:      HeaderRemoteUser,
		UIDHeader:           HeaderRemoteUID,
		GroupHeaders:        []string{HeaderRemoteGroup},
		ExtraHeaderPrefixes: []string{HeaderRemoteExtraPrefix},
	}
}
