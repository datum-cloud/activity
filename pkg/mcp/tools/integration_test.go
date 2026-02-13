//go:build integration

package tools

import (
	"context"
	"encoding/json"
	"os"
	"testing"
	"time"

	authnv1 "k8s.io/api/authentication/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	auditv1 "k8s.io/apiserver/pkg/apis/audit/v1"
	"k8s.io/client-go/tools/clientcmd"

	"go.miloapis.com/activity/pkg/apis/activity/v1alpha1"
	activityclient "go.miloapis.com/activity/pkg/client/clientset/versioned/typed/activity/v1alpha1"
)

// Integration tests for MCP tools against a live cluster.
// Run with: go test -tags=integration -v ./pkg/mcp/tools/...
//
// Requires:
// - KUBECONFIG environment variable set to a valid kubeconfig
// - Activity API server running in the cluster

func getTestClient(t *testing.T) activityclient.ActivityV1alpha1Interface {
	kubeconfig := os.Getenv("KUBECONFIG")
	if kubeconfig == "" {
		t.Skip("KUBECONFIG not set, skipping integration test")
	}

	loadingRules := &clientcmd.ClientConfigLoadingRules{ExplicitPath: kubeconfig}
	kubeConfig := clientcmd.NewNonInteractiveDeferredLoadingClientConfig(loadingRules, &clientcmd.ConfigOverrides{})
	restConfig, err := kubeConfig.ClientConfig()
	if err != nil {
		t.Fatalf("Failed to load kubeconfig: %v", err)
	}

	client, err := activityclient.NewForConfig(restConfig)
	if err != nil {
		t.Fatalf("Failed to create client: %v", err)
	}

	return client
}

func TestIntegration_AuditLogQuery(t *testing.T) {
	client := getTestClient(t)

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	query := &v1alpha1.AuditLogQuery{
		ObjectMeta: metav1.ObjectMeta{
			GenerateName: "integration-test-",
		},
		Spec: v1alpha1.AuditLogQuerySpec{
			StartTime: "now-1h",
			EndTime:   "now",
			Limit:     10,
		},
	}

	result, err := client.AuditLogQueries().Create(ctx, query, metav1.CreateOptions{})
	if err != nil {
		t.Fatalf("AuditLogQuery failed: %v", err)
	}

	t.Logf("AuditLogQuery succeeded:")
	t.Logf("  Count: %d events", len(result.Status.Results))
	t.Logf("  Effective time range: %s to %s", result.Status.EffectiveStartTime, result.Status.EffectiveEndTime)

	if len(result.Status.Results) > 0 {
		event := result.Status.Results[0]
		t.Logf("  First event: %s %s/%s by %s", event.Verb, event.ObjectRef.Resource, event.ObjectRef.Name, event.User.Username)
	}
}

func TestIntegration_AuditLogFacetsQuery(t *testing.T) {
	client := getTestClient(t)

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	query := &v1alpha1.AuditLogFacetsQuery{
		ObjectMeta: metav1.ObjectMeta{
			GenerateName: "integration-test-",
		},
		Spec: v1alpha1.AuditLogFacetsQuerySpec{
			TimeRange: v1alpha1.FacetTimeRange{
				Start: "now-1h",
				End:   "now",
			},
			Facets: []v1alpha1.FacetSpec{
				{Field: "verb", Limit: 10},
				{Field: "objectRef.resource", Limit: 10},
			},
		},
	}

	result, err := client.AuditLogFacetsQueries().Create(ctx, query, metav1.CreateOptions{})
	if err != nil {
		t.Fatalf("AuditLogFacetsQuery failed: %v", err)
	}

	t.Logf("AuditLogFacetsQuery succeeded:")
	for _, facet := range result.Status.Facets {
		t.Logf("  Field %s:", facet.Field)
		for _, v := range facet.Values {
			t.Logf("    %s: %d", v.Value, v.Count)
		}
	}
}

func TestIntegration_ActivityQuery(t *testing.T) {
	client := getTestClient(t)

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	query := &v1alpha1.ActivityQuery{
		ObjectMeta: metav1.ObjectMeta{
			GenerateName: "integration-test-",
		},
		Spec: v1alpha1.ActivityQuerySpec{
			StartTime: "now-1h",
			EndTime:   "now",
			Limit:     10,
		},
	}

	result, err := client.ActivityQueries().Create(ctx, query, metav1.CreateOptions{})
	if err != nil {
		t.Fatalf("ActivityQuery failed: %v", err)
	}

	t.Logf("ActivityQuery succeeded:")
	t.Logf("  Count: %d activities", len(result.Status.Results))
	t.Logf("  Effective time range: %s to %s", result.Status.EffectiveStartTime, result.Status.EffectiveEndTime)

	for i, activity := range result.Status.Results {
		if i >= 3 {
			break
		}
		t.Logf("  Activity: %s", activity.Spec.Summary)
	}
}

func TestIntegration_ActivityFacetQuery(t *testing.T) {
	client := getTestClient(t)

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	query := &v1alpha1.ActivityFacetQuery{
		ObjectMeta: metav1.ObjectMeta{
			GenerateName: "integration-test-",
		},
		Spec: v1alpha1.ActivityFacetQuerySpec{
			TimeRange: v1alpha1.FacetTimeRange{
				Start: "now-1h",
				End:   "now",
			},
			Facets: []v1alpha1.FacetSpec{
				{Field: "spec.actor.name", Limit: 10},
				{Field: "spec.resource.kind", Limit: 10},
			},
		},
	}

	result, err := client.ActivityFacetQueries().Create(ctx, query, metav1.CreateOptions{})
	if err != nil {
		t.Fatalf("ActivityFacetQuery failed: %v", err)
	}

	t.Logf("ActivityFacetQuery succeeded:")
	for _, facet := range result.Status.Facets {
		t.Logf("  Field %s:", facet.Field)
		for _, v := range facet.Values {
			t.Logf("    %s: %d", v.Value, v.Count)
		}
	}
}

func TestIntegration_ListActivityPolicies(t *testing.T) {
	client := getTestClient(t)

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	result, err := client.ActivityPolicies().List(ctx, metav1.ListOptions{})
	if err != nil {
		t.Fatalf("ListActivityPolicies failed: %v", err)
	}

	t.Logf("ListActivityPolicies succeeded:")
	t.Logf("  Count: %d policies", len(result.Items))

	for _, policy := range result.Items {
		t.Logf("  Policy: %s (resource: %s/%s)", policy.Name, policy.Spec.Resource.APIGroup, policy.Spec.Resource.Kind)
	}
}

func TestIntegration_PolicyPreview(t *testing.T) {
	client := getTestClient(t)

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	preview := &v1alpha1.PolicyPreview{
		ObjectMeta: metav1.ObjectMeta{
			GenerateName: "integration-test-",
		},
		Spec: v1alpha1.PolicyPreviewSpec{
			Policy: v1alpha1.ActivityPolicySpec{
				Resource: v1alpha1.ActivityPolicyResource{
					APIGroup: "",
					Kind:     "Pod",
				},
				AuditRules: []v1alpha1.ActivityPolicyRule{
					{
						Match:   `audit.verb == "create"`,
						Summary: "{{ actor }} created pod {{ audit.objectRef.name }}",
					},
				},
			},
			Inputs: []v1alpha1.PolicyPreviewInput{
				{
					Type: "audit",
					Audit: &auditv1.Event{
						Verb: "create",
						User: authnv1.UserInfo{
							Username: "test-user",
						},
						ObjectRef: &auditv1.ObjectReference{
							Name:     "test-pod",
							Resource: "pods",
						},
					},
				},
			},
		},
	}

	result, err := client.PolicyPreviews().Create(ctx, preview, metav1.CreateOptions{})
	if err != nil {
		t.Fatalf("PolicyPreview failed: %v", err)
	}

	t.Logf("PolicyPreview succeeded:")
	if result.Status.Error != "" {
		t.Logf("  Error: %s", result.Status.Error)
	}

	for _, r := range result.Status.Results {
		t.Logf("  Input %d: matched=%v", r.InputIndex, r.Matched)
		if r.Error != "" {
			t.Logf("    Error: %s", r.Error)
		}
	}

	for _, a := range result.Status.Activities {
		t.Logf("  Generated activity: %s", a.Spec.Summary)
	}
}

func TestIntegration_ToolProvider(t *testing.T) {
	kubeconfig := os.Getenv("KUBECONFIG")
	if kubeconfig == "" {
		t.Skip("KUBECONFIG not set, skipping integration test")
	}

	cfg := Config{
		Kubeconfig: kubeconfig,
		Namespace:  "default",
	}

	provider, err := NewToolProvider(cfg)
	if err != nil {
		t.Fatalf("Failed to create ToolProvider: %v", err)
	}
	defer provider.Close()

	t.Logf("ToolProvider created successfully")

	// Verify it can create an MCP server
	server := provider.NewMCPServer(ServerConfig{
		Name:    "test",
		Version: "1.0.0",
	})

	if server == nil {
		t.Fatal("NewMCPServer returned nil")
	}

	t.Logf("MCP server created successfully")
}

func TestIntegration_AllAPIsAvailable(t *testing.T) {
	client := getTestClient(t)

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// Test each API to verify the cluster has all required CRDs installed
	apis := []struct {
		name string
		test func() error
	}{
		{
			name: "AuditLogQuery",
			test: func() error {
				query := &v1alpha1.AuditLogQuery{
					ObjectMeta: metav1.ObjectMeta{GenerateName: "api-test-"},
					Spec:       v1alpha1.AuditLogQuerySpec{StartTime: "now-1m", EndTime: "now", Limit: 1},
				}
				_, err := client.AuditLogQueries().Create(ctx, query, metav1.CreateOptions{})
				return err
			},
		},
		{
			name: "AuditLogFacetsQuery",
			test: func() error {
				query := &v1alpha1.AuditLogFacetsQuery{
					ObjectMeta: metav1.ObjectMeta{GenerateName: "api-test-"},
					Spec: v1alpha1.AuditLogFacetsQuerySpec{
						TimeRange: v1alpha1.FacetTimeRange{Start: "now-1m", End: "now"},
						Facets:    []v1alpha1.FacetSpec{{Field: "verb", Limit: 1}},
					},
				}
				_, err := client.AuditLogFacetsQueries().Create(ctx, query, metav1.CreateOptions{})
				return err
			},
		},
		{
			name: "ActivityQuery",
			test: func() error {
				query := &v1alpha1.ActivityQuery{
					ObjectMeta: metav1.ObjectMeta{GenerateName: "api-test-"},
					Spec:       v1alpha1.ActivityQuerySpec{StartTime: "now-1m", EndTime: "now", Limit: 1},
				}
				_, err := client.ActivityQueries().Create(ctx, query, metav1.CreateOptions{})
				return err
			},
		},
		{
			name: "ActivityFacetQuery",
			test: func() error {
				query := &v1alpha1.ActivityFacetQuery{
					ObjectMeta: metav1.ObjectMeta{GenerateName: "api-test-"},
					Spec: v1alpha1.ActivityFacetQuerySpec{
						TimeRange: v1alpha1.FacetTimeRange{Start: "now-1m", End: "now"},
						Facets:    []v1alpha1.FacetSpec{{Field: "spec.actor.name", Limit: 1}},
					},
				}
				_, err := client.ActivityFacetQueries().Create(ctx, query, metav1.CreateOptions{})
				return err
			},
		},
		{
			name: "ActivityPolicy (list)",
			test: func() error {
				_, err := client.ActivityPolicies().List(ctx, metav1.ListOptions{})
				return err
			},
		},
		{
			name: "PolicyPreview",
			test: func() error {
				preview := &v1alpha1.PolicyPreview{
					ObjectMeta: metav1.ObjectMeta{GenerateName: "api-test-"},
					Spec: v1alpha1.PolicyPreviewSpec{
						Policy: v1alpha1.ActivityPolicySpec{
							Resource:   v1alpha1.ActivityPolicyResource{Kind: "Test"},
							AuditRules: []v1alpha1.ActivityPolicyRule{{Match: "true", Summary: "test"}},
						},
						Inputs: []v1alpha1.PolicyPreviewInput{},
					},
				}
				_, err := client.PolicyPreviews().Create(ctx, preview, metav1.CreateOptions{})
				return err
			},
		},
	}

	allPassed := true
	for _, api := range apis {
		err := api.test()
		if err != nil {
			t.Errorf("API %s: FAILED - %v", api.name, err)
			allPassed = false
		} else {
			t.Logf("API %s: OK", api.name)
		}
	}

	if allPassed {
		t.Logf("All Activity APIs are available and working!")
	}
}

func TestIntegration_QueryWithCELFilter(t *testing.T) {
	client := getTestClient(t)

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// Test CEL filtering
	filters := []struct {
		name   string
		filter string
	}{
		{"verb filter", `verb == "get"`},
		{"resource filter", `objectRef.resource == "pods"`},
		{"namespace filter", `objectRef.namespace != ""`},
		{"combined filter", `verb == "get" && objectRef.resource == "pods"`},
	}

	for _, f := range filters {
		query := &v1alpha1.AuditLogQuery{
			ObjectMeta: metav1.ObjectMeta{GenerateName: "cel-test-"},
			Spec: v1alpha1.AuditLogQuerySpec{
				StartTime: "now-1h",
				EndTime:   "now",
				Filter:    f.filter,
				Limit:     5,
			},
		}

		result, err := client.AuditLogQueries().Create(ctx, query, metav1.CreateOptions{})
		if err != nil {
			t.Errorf("CEL filter '%s' failed: %v", f.name, err)
			continue
		}

		t.Logf("CEL filter '%s': %d results", f.name, len(result.Status.Results))
	}
}

func TestIntegration_FailedOperations(t *testing.T) {
	client := getTestClient(t)

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// Query for failed operations (4xx/5xx)
	query := &v1alpha1.AuditLogQuery{
		ObjectMeta: metav1.ObjectMeta{GenerateName: "failed-ops-"},
		Spec: v1alpha1.AuditLogQuerySpec{
			StartTime: "now-24h",
			EndTime:   "now",
			Filter:    "responseStatus.code >= 400",
			Limit:     20,
		},
	}

	result, err := client.AuditLogQueries().Create(ctx, query, metav1.CreateOptions{})
	if err != nil {
		t.Fatalf("Failed operations query failed: %v", err)
	}

	t.Logf("Found %d failed operations in last 24h", len(result.Status.Results))

	// Group by status code
	byCode := make(map[int32]int)
	for _, event := range result.Status.Results {
		byCode[event.ResponseStatus.Code]++
	}

	resultJSON, _ := json.MarshalIndent(byCode, "", "  ")
	t.Logf("By status code: %s", resultJSON)
}
