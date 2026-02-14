# Enhancement: Kubernetes Events Storage Backend

- **Status**: Draft
- **Authors**: @scotwells
- **Created**: 2026-02-11
- **Last Updated**: 2026-02-11

## Summary

Replace the etcd-based storage for Kubernetes Events (`core/v1.Event`) in the Milo
control plane with a ClickHouse-backed storage system provided by the Activity
service. The Milo API server will act as a thin proxy, forwarding event
operations to the Activity API server, which handles storage in ClickHouse with
NATS buffering for durability.

## Motivation

### Problem Statement

Kubernetes Events are high-volume, short-lived resources that create significant
pressure on etcd:

1. **Storage pressure**: Events accumulate rapidly in busy clusters, consuming
   etcd storage even with TTL-based cleanup
2. **Write amplification**: Every event write triggers etcd's Raft consensus and
   compaction overhead
3. **Limited queryability**: etcd provides only key-prefix queries, making it
   difficult to search events by involved object, reason, or time range
4. **No long-term retention**: Default 1-hour TTL means historical events are
   lost, complicating incident investigation

### Goals

- **Offload event storage** from etcd to ClickHouse, reducing control plane
  storage pressure
- **Preserve API compatibility** with existing Kubernetes clients and tooling
  (kubectl, client-go)
- **Enable rich querying** of events by time range, involved object, reason,
  type, and other fields
- **Support longer retention** with configurable TTL policies
- **Maintain multi-tenancy** with project-scoped event isolation
- **Provide durability** through NATS buffering during outages

### Non-Goals

- Replacing audit events (already handled by Activity service)
- Supporting watch semantics with the same consistency guarantees as etcd
  (eventual consistency is acceptable for events)
- Modifying the Event resource schema
- Handling events for external clusters (only Milo control plane events)

## Proposal

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Milo Control Plane                               │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │                      Milo API Server                                │  │
│  │                                                                     │  │
│  │  ┌─────────────────┐    ┌─────────────────────────────────────┐   │  │
│  │  │  EventsREST     │───▶│  DynamicProvider (Thin Client)      │   │  │
│  │  │  (rest.Storage) │    │  - Forwards X-Remote-* headers      │   │  │
│  │  └─────────────────┘    │  - Uses dynamic.Interface           │   │  │
│  │                          └──────────────────┬──────────────────┘   │  │
│  └─────────────────────────────────────────────┼──────────────────────┘  │
│                                                 │                         │
└─────────────────────────────────────────────────┼─────────────────────────┘
                                                  │ HTTPS + mTLS
                                                  │ X-Remote-User
                                                  │ X-Remote-Group
                                                  │ X-Remote-Extra-*
                                                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        Activity Service                                  │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │                   Activity API Server                               │  │
│  │                                                                     │  │
│  │  ┌─────────────────┐    ┌─────────────────┐    ┌────────────────┐  │  │
│  │  │ X-Remote-*      │───▶│   EventsREST    │───▶│ ClickHouse     │  │  │
│  │  │ Auth Filter     │    │   (CRUD+Watch)  │    │ Backend        │  │  │
│  │  └─────────────────┘    └────────┬────────┘    └───────┬────────┘  │  │
│  │                                  │                      │           │  │
│  └──────────────────────────────────┼──────────────────────┼───────────┘  │
│                                     │                      │              │
│                                     ▼                      ▼              │
│                            ┌────────────────┐    ┌────────────────┐      │
│                            │ NATS JetStream │    │   ClickHouse   │      │
│                            │ (Write Buffer) │───▶│   (Storage)    │      │
│                            └────────────────┘    └────────────────┘      │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Design Principles

1. **Thin client in Milo**: Milo implements minimal proxy logic, delegating all
   storage complexity to the Activity service. This follows the existing
   Sessions/UserIdentities pattern.

2. **Activity owns the contract**: The Activity service defines the Events API
   and provides the storage implementation. Milo consumes it as an external
   service.

3. **User context forwarding**: Authentication context flows from Milo to
   Activity via X-Remote-* headers, enabling scope-aware storage and queries.

4. **Eventual consistency for Watch**: Unlike etcd-backed resources, event
   watches may have slight delays. This tradeoff is acceptable for events.

## Detailed Design

### Milo API Server Changes

#### Storage Provider Registration

Replace the standard events storage provider with a custom implementation:

```go
// cmd/milo/apiserver/config.go

// Before:
eventsrest.RESTStorageProvider{TTL: c.ControlPlane.EventTTL}

// After:
eventsproxy.StorageProvider{
    Backend: eventsproxy.NewDynamicProvider(eventsproxy.Config{
        URL:           c.Events.ProviderURL,
        CAFile:        c.Events.CAFile,
        ClientCertFile: c.Events.ClientCertFile,
        ClientKeyFile:  c.Events.ClientKeyFile,
        Timeout:       c.Events.Timeout,
        Retries:       c.Events.Retries,
        ForwardExtras: c.Events.ForwardExtras,
    }),
}
```

#### Configuration Flags

| Flag | Description | Default |
|------|-------------|---------|
| `--events-provider-url` | Activity API server URL for events | Required |
| `--events-provider-ca-file` | TLS CA certificate for verification | Required |
| `--events-provider-client-cert` | mTLS client certificate | Required |
| `--events-provider-client-key` | mTLS client key | Required |
| `--events-provider-timeout` | Request timeout in seconds | 30 |
| `--events-provider-retries` | Number of retry attempts | 3 |
| `--events-forward-extras` | User.Extra keys to forward | `iam.miloapis.com/*` |

#### Thin Client Implementation

The thin client uses Kubernetes' dynamic client with custom transport:

```go
// internal/apiserver/events/dynamic.go

type DynamicProvider struct {
    client        dynamic.Interface
    retries       int
    forwardExtras []string
}

func NewDynamicProvider(cfg Config) (*DynamicProvider, error) {
    restCfg := &rest.Config{
        Host: cfg.URL,
        TLSClientConfig: rest.TLSClientConfig{
            CAFile:   cfg.CAFile,
            CertFile: cfg.ClientCertFile,
            KeyFile:  cfg.ClientKeyFile,
        },
    }

    // Inject user context headers on every request
    restCfg.WrapTransport = func(rt http.RoundTripper) http.RoundTripper {
        return &userContextTransport{
            delegate:      rt,
            forwardExtras: cfg.ForwardExtras,
        }
    }

    client, err := dynamic.NewForConfig(restCfg)
    if err != nil {
        return nil, err
    }

    return &DynamicProvider{client: client, retries: cfg.Retries}, nil
}
```

#### User Context Transport

Forwards authentication context via HTTP headers:

```go
// internal/apiserver/events/transport.go

type userContextTransport struct {
    delegate      http.RoundTripper
    forwardExtras []string
}

func (t *userContextTransport) RoundTrip(req *http.Request) (*http.Response, error) {
    userInfo, ok := request.UserFrom(req.Context())
    if ok {
        req.Header.Set("X-Remote-User", userInfo.GetName())
        req.Header.Set("X-Remote-Uid", userInfo.GetUID())

        for _, group := range userInfo.GetGroups() {
            req.Header.Add("X-Remote-Group", group)
        }

        for _, key := range t.forwardExtras {
            if values, ok := userInfo.GetExtra()[key]; ok {
                for _, v := range values {
                    req.Header.Add("X-Remote-Extra-"+key, v)
                }
            }
        }
    }

    return t.delegate.RoundTrip(req)
}
```

### Activity API Server Changes

#### New API Resource

Register Events under the existing `activity.miloapis.com` API group:

| Resource | API Group | Version | Namespaced |
|----------|-----------|---------|------------|
| `events` | `activity.miloapis.com` | `v1alpha1` | Yes |

The Activity service will use `corev1.Event` and `corev1.EventList` types
directly to maintain wire compatibility:

```go
// pkg/apis/activity/v1alpha1/register.go

func addKnownTypes(scheme *runtime.Scheme) error {
    scheme.AddKnownTypes(SchemeGroupVersion,
        &AuditLogQuery{},
        &AuditLogQueryList{},
        &AuditLogFacetsQuery{},
        &AuditLogFacetsQueryList{},
        // New: Events
        &corev1.Event{},
        &corev1.EventList{},
    )
    return nil
}
```

#### REST Handlers

Implement standard Kubernetes REST interfaces:

| Interface | Operations |
|-----------|------------|
| `rest.Creater` | Create new events |
| `rest.Getter` | Get event by name |
| `rest.Lister` | List events with filtering |
| `rest.Watcher` | Watch for event changes |
| `rest.Updater` | Update existing events |
| `rest.GracefulDeleter` | Delete events |

```go
// internal/registry/activity/events/rest.go

type EventsREST struct {
    backend EventsBackend
}

var _ rest.Creater = &EventsREST{}
var _ rest.Getter = &EventsREST{}
var _ rest.Lister = &EventsREST{}
var _ rest.Watcher = &EventsREST{}
var _ rest.Updater = &EventsREST{}
var _ rest.GracefulDeleter = &EventsREST{}
```

#### Authentication Middleware

Extract user identity from X-Remote-* headers:

```go
// internal/server/filters/remote_user.go

func WithRemoteUser(handler http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        remoteUser := r.Header.Get("X-Remote-User")
        if remoteUser == "" {
            handler.ServeHTTP(w, r)
            return
        }

        userInfo := &user.DefaultInfo{
            Name:   remoteUser,
            UID:    r.Header.Get("X-Remote-Uid"),
            Groups: r.Header.Values("X-Remote-Group"),
            Extra:  extractExtras(r.Header),
        }

        ctx := request.WithUser(r.Context(), userInfo)
        handler.ServeHTTP(w, r.WithContext(ctx))
    })
}
```

#### Backend Interface

```go
// internal/registry/activity/events/backend.go

type EventsBackend interface {
    Create(ctx context.Context, event *corev1.Event) (*corev1.Event, error)
    Get(ctx context.Context, namespace, name string) (*corev1.Event, error)
    List(ctx context.Context, namespace string, opts metav1.ListOptions) (*corev1.EventList, error)
    Update(ctx context.Context, event *corev1.Event) (*corev1.Event, error)
    Delete(ctx context.Context, namespace, name string) error
    Watch(ctx context.Context, namespace string, opts metav1.ListOptions) (watch.Interface, error)
}
```

### ClickHouse Schema

#### Events Table

```sql
CREATE TABLE IF NOT EXISTS activity.events
(
    -- Primary storage
    event_json String CODEC(ZSTD(3)),

    -- Metadata (materialized from JSON)
    namespace LowCardinality(String)
        MATERIALIZED JSONExtractString(event_json, 'metadata', 'namespace'),
    name String
        MATERIALIZED JSONExtractString(event_json, 'metadata', 'name'),
    uid String
        MATERIALIZED JSONExtractString(event_json, 'metadata', 'uid'),
    resource_version UInt64
        MATERIALIZED toUInt64OrZero(JSONExtractString(event_json, 'metadata', 'resourceVersion')),

    -- Event fields
    reason LowCardinality(String)
        MATERIALIZED JSONExtractString(event_json, 'reason'),
    message String
        MATERIALIZED JSONExtractString(event_json, 'message'),
    type LowCardinality(String)
        MATERIALIZED JSONExtractString(event_json, 'type'),
    count UInt32
        MATERIALIZED JSONExtractUInt(event_json, 'count'),

    -- Involved object
    involved_api_version LowCardinality(String)
        MATERIALIZED JSONExtractString(event_json, 'involvedObject', 'apiVersion'),
    involved_kind LowCardinality(String)
        MATERIALIZED JSONExtractString(event_json, 'involvedObject', 'kind'),
    involved_namespace LowCardinality(String)
        MATERIALIZED JSONExtractString(event_json, 'involvedObject', 'namespace'),
    involved_name String
        MATERIALIZED JSONExtractString(event_json, 'involvedObject', 'name'),
    involved_uid String
        MATERIALIZED JSONExtractString(event_json, 'involvedObject', 'uid'),

    -- Source
    source_component LowCardinality(String)
        MATERIALIZED JSONExtractString(event_json, 'source', 'component'),
    source_host String
        MATERIALIZED JSONExtractString(event_json, 'source', 'host'),

    -- Timestamps
    first_timestamp DateTime64(6)
        MATERIALIZED parseDateTime64BestEffortOrNull(
            JSONExtractString(event_json, 'firstTimestamp')
        ),
    last_timestamp DateTime64(6)
        MATERIALIZED parseDateTime64BestEffortOrNull(
            JSONExtractString(event_json, 'lastTimestamp')
        ),
    event_time DateTime64(6)
        MATERIALIZED parseDateTime64BestEffortOrNull(
            JSONExtractString(event_json, 'eventTime')
        ),

    -- Multi-tenancy
    scope_type LowCardinality(String)
        MATERIALIZED JSONExtractString(
            event_json, 'metadata', 'annotations', 'platform.miloapis.com/scope.type'
        ),
    scope_name String
        MATERIALIZED JSONExtractString(
            event_json, 'metadata', 'annotations', 'platform.miloapis.com/scope.name'
        ),

    -- Tracking
    inserted_at DateTime64(3) DEFAULT now64(3)
)
ENGINE = ReplicatedReplacingMergeTree(
    '/clickhouse/tables/{shard}/activity_k8s_events',
    '{replica}',
    inserted_at
)
PARTITION BY toYYYYMMDD(coalesce(last_timestamp, first_timestamp, inserted_at))
ORDER BY (namespace, name, uid)
TTL coalesce(last_timestamp, first_timestamp, inserted_at) + INTERVAL 7 DAY
SETTINGS index_granularity = 8192;
```

#### Indexes

```sql
-- Fast lookups by namespace and name
ALTER TABLE activity.events
    ADD INDEX idx_namespace_name (namespace, name)
    TYPE bloom_filter(0.01) GRANULARITY 4;

-- Filter by involved object
ALTER TABLE activity.events
    ADD INDEX idx_involved_object (involved_kind, involved_namespace, involved_name)
    TYPE bloom_filter(0.01) GRANULARITY 4;

-- Filter by reason and type
ALTER TABLE activity.events
    ADD INDEX idx_reason_type (reason, type)
    TYPE set(100) GRANULARITY 4;

-- Filter by source component
ALTER TABLE activity.events
    ADD INDEX idx_source (source_component)
    TYPE set(100) GRANULARITY 4;

-- Multi-tenant filtering
ALTER TABLE activity.events
    ADD INDEX idx_scope (scope_type, scope_name)
    TYPE bloom_filter(0.01) GRANULARITY 4;
```

#### Projection for Time-based Queries

```sql
ALTER TABLE activity.events
    ADD PROJECTION events_by_time
    (
        SELECT *
        ORDER BY (
            toStartOfHour(coalesce(last_timestamp, first_timestamp, inserted_at)),
            namespace,
            involved_kind,
            involved_name
        )
    );
```

### Watch Implementation

Since ClickHouse doesn't support change streams, implement watch using NATS
pub/sub:

```
Event Create → ClickHouse Insert
            ↘
              NATS Publish (events.k8s.{namespace}.{kind})
                    ↓
              Watch Subscribers
```

#### NATS Subject Pattern

| Subject | Description |
|---------|-------------|
| `events.k8s.>` | All Kubernetes events |
| `events.k8s.{namespace}.>` | Events in a specific namespace |
| `events.k8s.{namespace}.{kind}` | Events for a specific kind |

#### Watch Flow

```go
func (b *ClickHouseEventsBackend) Watch(
    ctx context.Context,
    namespace string,
    opts metav1.ListOptions,
) (watch.Interface, error) {
    watcher := newEventWatcher()

    // Subscribe to NATS for real-time updates
    subject := fmt.Sprintf("events.k8s.%s.>", namespace)
    sub, err := b.natsConn.Subscribe(subject, func(msg *nats.Msg) {
        var event corev1.Event
        if err := json.Unmarshal(msg.Data, &event); err != nil {
            return
        }

        // Apply field selector filtering
        if !matchesFieldSelector(event, opts.FieldSelector) {
            return
        }

        watcher.Send(watch.Event{Type: watch.Added, Object: &event})
    })

    if err != nil {
        return nil, err
    }

    // Cleanup on context cancellation
    go func() {
        <-ctx.Done()
        sub.Unsubscribe()
        watcher.Stop()
    }()

    return watcher, nil
}
```

### Multi-Tenancy

#### Scope Annotation

Events must include scope annotations for tenant isolation:

```yaml
apiVersion: v1
kind: Event
metadata:
  name: pod-created.abc123
  namespace: default
  annotations:
    platform.miloapis.com/scope.type: "Project"
    platform.miloapis.com/scope.name: "project-123"
```

The Milo API server should inject these annotations via admission control when
events are created.

#### Query Filtering

The Activity service applies scope filters based on user context:

```go
func (b *ClickHouseEventsBackend) applyScopeFilter(
    ctx context.Context,
    query *strings.Builder,
    args *[]interface{},
) {
    userInfo, ok := request.UserFrom(ctx)
    if !ok {
        return
    }

    extras := userInfo.GetExtra()
    parentType := getFirstExtra(extras, "iam.miloapis.com/parent-type")
    parentName := getFirstExtra(extras, "iam.miloapis.com/parent-name")

    switch parentType {
    case "Project":
        query.WriteString(" AND scope_type = ? AND scope_name = ?")
        *args = append(*args, "Project", parentName)
    case "Organization":
        query.WriteString(" AND scope_type = ? AND scope_name = ?")
        *args = append(*args, "Organization", parentName)
    // Platform scope: no additional filter
    }
}
```

### Field Selector Support

Support standard Kubernetes field selectors for events:

| Field | ClickHouse Column |
|-------|-------------------|
| `metadata.namespace` | `namespace` |
| `metadata.name` | `name` |
| `involvedObject.kind` | `involved_kind` |
| `involvedObject.namespace` | `involved_namespace` |
| `involvedObject.name` | `involved_name` |
| `involvedObject.uid` | `involved_uid` |
| `involvedObject.apiVersion` | `involved_api_version` |
| `reason` | `reason` |
| `type` | `type` |
| `source.component` | `source_component` |

Example query:

```bash
kubectl get events --field-selector involvedObject.kind=Pod,reason=Scheduled
```

## API

### Milo Configuration

```yaml
# milo-config.yaml
events:
  provider:
    url: https://activity-apiserver.activity-system.svc:6443
    caFile: /etc/milo/activity-ca.crt
    clientCertFile: /etc/milo/activity-client.crt
    clientKeyFile: /etc/milo/activity-client.key
    timeout: 30
    retries: 3
  forwardExtras:
    - iam.miloapis.com/parent-type
    - iam.miloapis.com/parent-name
    - iam.miloapis.com/parent-api-group
```

### Activity APIService Registration

```yaml
apiVersion: apiregistration.k8s.io/v1
kind: APIService
metadata:
  name: v1alpha1.activity.miloapis.com
spec:
  service:
    name: activity-apiserver
    namespace: activity-system
    port: 6443
  group: activity.miloapis.com
  version: v1alpha1
  insecureSkipTLSVerify: false
  caBundle: <base64-encoded-ca>
```

### Example Event Flow

**1. Client creates an event:**

```bash
kubectl create -f - <<EOF
apiVersion: v1
kind: Event
metadata:
  name: my-pod.start
  namespace: default
involvedObject:
  apiVersion: v1
  kind: Pod
  name: my-pod
  namespace: default
reason: Started
message: Started container
type: Normal
EOF
```

**2. Milo API server receives request:**
- Authenticates user
- Injects scope annotations via admission
- Forwards to Activity API server with X-Remote-* headers

**3. Activity API server processes request:**
- Extracts user context from headers
- Validates event
- Inserts into ClickHouse
- Publishes to NATS for watchers

**4. Client queries events:**

```bash
kubectl get events -n default --field-selector involvedObject.name=my-pod
```

## Implementation Plan

### Phase 1: Activity Service Foundation

1. Define Events backend interface
2. Implement ClickHouse schema and migrations
3. Implement basic CRUD operations (Create, Get, List, Delete)
4. Add X-Remote-* authentication middleware
5. Write unit and integration tests

### Phase 2: Watch Support

1. Configure NATS subjects for event streaming
2. Implement NATS-based watch
3. Add field selector filtering for watches
4. Test watch reliability and reconnection

### Phase 3: Milo Integration

1. Implement thin client (DynamicProvider)
2. Implement user context transport
3. Create EventsREST storage provider
4. Add configuration flags
5. Integration tests with Activity service

### Phase 4: Multi-Tenancy

1. Implement scope filtering in Activity service
2. Add admission controller for scope annotation injection in Milo
3. Test tenant isolation
4. Performance testing with multi-tenant load

### Phase 5: Production Readiness

1. Add metrics and tracing
2. Write runbooks and documentation
3. Load testing and performance optimization
4. Gradual rollout with feature flag

## Alternatives Considered

### Option 1: API Aggregation

Register Activity as an aggregated API server with a different API group
(`events.activity.miloapis.com`).

**Pros:**
- Clean separation of concerns
- Standard Kubernetes aggregation

**Cons:**
- Different API group breaks existing tooling expecting `core/v1.Event`
- More complex client configuration

### Option 2: Dual-Write (etcd + ClickHouse)

Write events to both etcd (for fast reads) and ClickHouse (for analytics).

**Pros:**
- Fast local reads from etcd
- Rich analytics from ClickHouse

**Cons:**
- Dual-write complexity and consistency challenges
- Doesn't solve etcd storage pressure

### Option 3: Custom storage.Interface

Implement `storage.Interface` directly in Milo with NATS/ClickHouse.

**Pros:**
- No network hop to Activity service
- Full control over storage semantics

**Cons:**
- Complex implementation in Milo
- Watch semantics difficult without etcd
- Violates separation of concerns

### Option 4: Client Library from Activity

Activity provides a typed Go client library that Milo imports.

**Pros:**
- Type safety
- Single source of truth for client logic

**Cons:**
- Cross-repo dependency and version coordination
- More coupling between services

**Decision:** Option 5 (Thin Client with X-Remote-* headers) was chosen because:
- Follows existing Sessions/UserIdentities pattern in Milo
- Minimal coupling between services
- Activity service can evolve independently
- Simple implementation using existing Kubernetes dynamic client

## Security Considerations

### Authentication

- mTLS required between Milo and Activity
- User context forwarded via trusted X-Remote-* headers
- Activity service must only accept X-Remote-* from authenticated Milo

### Authorization

- Milo performs RBAC checks before proxying
- Activity service trusts scope from Milo (no additional authz)
- Scope filtering ensures tenant isolation

### Data Protection

- Events may contain sensitive information (resource names, user identities)
- ClickHouse data encrypted at rest
- TLS for all network communication
- Audit logging for event access

## Observability

### Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `activity_events_operations_total` | Counter | Event operations by verb and status |
| `activity_events_operation_duration_seconds` | Histogram | Operation latency |
| `activity_events_watch_connections` | Gauge | Active watch connections |
| `activity_events_clickhouse_errors_total` | Counter | ClickHouse errors by type |
| `milo_events_proxy_requests_total` | Counter | Proxied requests by status |
| `milo_events_proxy_latency_seconds` | Histogram | Proxy latency |

### Tracing

OpenTelemetry traces should span:
- Milo: Request receipt → proxy → response
- Activity: Request receipt → ClickHouse query → response

Trace context propagated via standard W3C headers.

### Logging

Structured logs for:
- Event creation/deletion with involved object
- Watch connection lifecycle
- Error conditions with context

## Open Questions

1. **Resource version handling**: How to generate monotonically increasing
   resource versions without etcd? Options:
   - Timestamp-based (may have collisions)
   - ClickHouse sequence
   - Hybrid approach

2. **Watch bookmark support**: Should we support bookmark events for efficient
   reconnection?

3. **Event aggregation**: Should the Activity service aggregate duplicate events
   (increment count) or store each occurrence?

4. **Retention policy**: What should the default TTL be? Should it be
   configurable per-project?

5. **Migration strategy**: How to migrate existing events from etcd to
   ClickHouse during rollout?

## References

- [Kubernetes Events API](https://kubernetes.io/docs/reference/kubernetes-api/cluster-resources/event-v1/)
- [Kubernetes API Aggregation](https://kubernetes.io/docs/concepts/extend-kubernetes/api-extension/apiserver-aggregation/)
- [Milo Sessions Implementation](../milo/internal/apiserver/identity/sessions/)
- [Activity Architecture](./architecture.md)
- [ClickHouse ReplacingMergeTree](https://clickhouse.com/docs/en/engines/table-engines/mergetree-family/replacingmergetree)
