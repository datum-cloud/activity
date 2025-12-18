package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"math/rand"
	"time"

	"github.com/google/uuid"
	"github.com/nats-io/nats.go"
	authenticationv1 "k8s.io/api/authentication/v1"
	auditv1 "k8s.io/apiserver/pkg/apis/audit/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/types"
)

var (
	natsURL     = flag.String("nats-url", "nats://localhost:4222", "NATS server URL")
	count       = flag.Int("count", 100, "Number of audit events to generate")
	ratePerSec  = flag.Int("rate", 10, "Events per second")
	subject     = flag.String("subject", "audit.k8s.synthetic", "NATS subject to publish to")
	source      = flag.String("source", "load-generator", "Source identifier for events")
	namespace   = flag.String("namespace", "default", "Namespace for generated resources")
)

// Event templates for different resource types
var resourceTypes = []struct {
	group    string
	version  string
	resource string
	kind     string
}{
	{"", "v1", "pods", "Pod"},
	{"", "v1", "services", "Service"},
	{"", "v1", "configmaps", "ConfigMap"},
	{"", "v1", "secrets", "Secret"},
	{"apps", "v1", "deployments", "Deployment"},
	{"apps", "v1", "statefulsets", "StatefulSet"},
	{"apps", "v1", "daemonsets", "DaemonSet"},
	{"batch", "v1", "jobs", "Job"},
	{"batch", "v1", "cronjobs", "CronJob"},
	{"networking.k8s.io", "v1", "ingresses", "Ingress"},
}

var verbs = []string{"get", "list", "create", "update", "patch", "delete", "watch"}
var users = []string{
	"system:admin",
	"user:alice",
	"user:bob",
	"user:charlie",
	"system:serviceaccount:default:deployer",
	"system:serviceaccount:kube-system:controller",
}

var responseStatuses = []int{200, 201, 204, 400, 403, 404, 409, 500}

func main() {
	flag.Parse()

	// Connect to NATS
	nc, err := nats.Connect(*natsURL)
	if err != nil {
		log.Fatalf("Failed to connect to NATS: %v", err)
	}
	defer nc.Close()

	log.Printf("Connected to NATS at %s", *natsURL)
	log.Printf("Generating %d audit events at %d events/sec", *count, *ratePerSec)
	log.Printf("Publishing to subject: %s", *subject)

	// Calculate delay between events
	delayNs := time.Second / time.Duration(*ratePerSec)

	ctx := context.Background()
	successCount := 0
	errorCount := 0

	for i := 0; i < *count; i++ {
		event := generateAuditEvent(i)

		eventJSON, err := json.Marshal(event)
		if err != nil {
			log.Printf("Failed to marshal event: %v", err)
			errorCount++
			continue
		}

		// Publish to NATS
		if err := nc.Publish(*subject, eventJSON); err != nil {
			log.Printf("Failed to publish event: %v", err)
			errorCount++
			continue
		}

		successCount++

		// Log progress every 100 events
		if (i+1)%100 == 0 {
			log.Printf("Published %d/%d events (errors: %d)", successCount, *count, errorCount)
		}

		// Rate limiting
		time.Sleep(delayNs)

		// Check context cancellation
		select {
		case <-ctx.Done():
			log.Printf("Context cancelled, stopping")
			return
		default:
		}
	}

	// Flush to ensure all messages are sent
	if err := nc.Flush(); err != nil {
		log.Printf("Failed to flush NATS connection: %v", err)
	}

	log.Printf("✅ Complete! Published %d events, %d errors", successCount, errorCount)
}

func generateAuditEvent(index int) *auditv1.Event {
	now := metav1.NewMicroTime(time.Now())

	// Pick random characteristics
	rt := resourceTypes[rand.Intn(len(resourceTypes))]
	verb := verbs[rand.Intn(len(verbs))]
	user := users[rand.Intn(len(users))]
	status := responseStatuses[rand.Intn(len(responseStatuses))]

	// Generate resource name
	resourceName := fmt.Sprintf("%s-%d-%d", rt.kind, time.Now().Unix(), rand.Intn(1000))

	// Generate unique audit ID using UUID
	auditID := types.UID(uuid.New().String())
	if index == 0 {
		log.Printf("DEBUG: First audit ID (UUID format): %s", auditID)
	}

	event := &auditv1.Event{
		TypeMeta: metav1.TypeMeta{
			Kind:       "Event",
			APIVersion: "audit.k8s.io/v1",
		},
		Level:      auditv1.LevelRequestResponse,
		AuditID:    auditID,
		Stage:      auditv1.StageResponseComplete,
		RequestURI: fmt.Sprintf("/api/%s/namespaces/%s/%s/%s", rt.version, *namespace, rt.resource, resourceName),
		Verb:       verb,
		User: authenticationv1.UserInfo{
			Username: user,
			Groups:   []string{"system:authenticated"},
		},
		ImpersonatedUser: nil,
		SourceIPs:        []string{fmt.Sprintf("10.0.%d.%d", rand.Intn(255), rand.Intn(255))},
		UserAgent:        "kubectl/v1.30.0 (linux/amd64) kubernetes/1234567",
		ObjectRef: &auditv1.ObjectReference{
			Resource:   rt.resource,
			Namespace:  *namespace,
			Name:       resourceName,
			APIGroup:   rt.group,
			APIVersion: rt.version,
		},
		ResponseStatus: &metav1.Status{
			Status: getStatusString(status),
			Code:   int32(status),
		},
		RequestReceivedTimestamp: now,
		StageTimestamp:           now,
		Annotations: map[string]string{
			"authorization.k8s.io/decision": "allow",
			"authorization.k8s.io/reason":   "RBAC: allowed by RoleBinding",
			"generator":                     "audit-log-generator",
			"load-test":                     "true",
		},
	}

	// Add request/response objects for create/update operations
	if verb == "create" || verb == "update" || verb == "patch" {
		apiVersion := rt.version
		if rt.group != "" {
			apiVersion = rt.group + "/" + rt.version
		}
		event.RequestObject = &runtime.Unknown{
			TypeMeta: runtime.TypeMeta{
				Kind:       rt.kind,
				APIVersion: apiVersion,
			},
			Raw:         []byte(fmt.Sprintf(`{"metadata":{"name":"%s","namespace":"%s"}}`, resourceName, *namespace)),
			ContentType: "application/json",
		}
		event.ResponseObject = event.RequestObject
	}

	return event
}

func getStatusString(code int) string {
	if code >= 200 && code < 300 {
		return "Success"
	}
	return "Failure"
}

func init() {
	rand.Seed(time.Now().UnixNano())
}
