# Activity Service Architecture

The activity service is responsible for making audit logs and activity logs
available to platform consumers. Consumers can leverage this platform to
understand what changes are being made to their infrastructure and by whom.

In the future, consumers will be able to subscribe to a reliable event stream of
events happening across the platform.

## Components

- **Activity Web UI**: A polished user interface for browsing your activity logs
- **Activity CLI**: A intuitive CLI for querying audit logs from the command
  line
- **Activity API**: A Kubernetes-native API for managing activity resources

## Technology Stack

- **Vector**: A data processing pipeline component that can receive, transform,
  and send data to build reliable data pipelines
- **NATS Jetstream**: A durable event buffer with ordering guarantees
- **Clickhouse**: Extremely high-performance OLAP database for storing audit log
  data with long-term retention capabilities
- **Kubernetes Aggregated API**: An apiserver framework for extending the
  control plane to expose a custom API

## Activity Pipeline

The activity service uses a data pipeline built on **Vector**, **NATS**, and
**Clickhouse** to collect and store audit logs efficiently for platform-wide,
user-specific, and tenant-scoped querying.

![activity service C4 container architecture
diagram](./diagrams/C4_Container_Diagram.png)

Consumers can use the activity API, activity web UI, or activity CLI to query
for audit logs to understand what's happening within their infrastructure.

### Vector Sidecar

The Vector sidecar collects audit logs from the control plane API server and
publishes them to NATS JetStream. It runs as a DaemonSet agent on nodes hosting
the API server. Deploy it on the same node as the API server or as a true
sidecar container to minimize network latency and reduce the risk of event loss.

The sidecar exposes an HTTP webhook endpoint at `/events` on port 8080. The
control plane API server sends audit events as `EventList` batches. The sidecar
parses these batches, extracts individual events from `EventList.items`, and
sets the Vector event timestamp from `stageTimestamp` for accurate lag metrics.

> [!NOTE]
>
> The control plane API server also supports writing audit logs to the
> filesystem. When running Vector as a sidecar container with a shared volume
> mount, configure it to read from the log file instead of the webhook endpoint.

Events publish to the `audit.k8s.activity` subject with the following
configuration:

| Feature | Configuration | Purpose |
|---------|---------------|---------|
| Message ID | `auditID` field | Enables JetStream deduplication |
| Disk buffer | 10 GB | Survives NATS outages |
| Buffer behavior | Block when full | Applies backpressure instead of dropping events |
| Encoding | JSON | Preserves full audit event structure |

### NATS JetStream

NATS JetStream provides durable message storage between the Vector sidecar and
Vector aggregator. It decouples log collection from processing, allowing the
pipeline to survive processing delays or downstream outages. The activity
service uses [NACK][nack] (NATS Controllers for Kubernetes) to manage
[streams][nack-stream] and [consumers][nack-consumer] declaratively via custom
resources.

[nack]: https://github.com/nats-io/nack
[nack-stream]:
    https://docs.nats.io/running-a-nats-service/configuration/resource_management/configuration_mgmt/kubernetes_controller#stream
[nack-consumer]:
    https://docs.nats.io/running-a-nats-service/configuration/resource_management/configuration_mgmt/kubernetes_controller#consumer

The `AUDIT_EVENTS` stream stores all audit events with these settings:

| Setting | Value | Purpose |
|---------|-------|---------|
| Subjects | `audit.k8s.>` | Captures all control plane audit events |
| Retention | Limits-based | Bounded by time and size |
| Max age | 7 days | Prevents unbounded growth |
| Max size | 100 GB | Caps storage usage |
| Storage | File-based | Durable across restarts |
| Deduplication window | 10 minutes | Prevents duplicates from webhook retries |

The stream uses `auditID` as the message ID for deduplication. If the API server
retries a webhook or Vector restarts mid-batch, JetStream drops duplicate events
within the 10-minute window.

The `clickhouse-ingest` consumer delivers events to the Vector aggregator using
pull-based delivery with explicit acknowledgments:

| Setting | Value | Purpose |
|---------|-------|---------|
| Delivery policy | All | Includes historical messages |
| Ack policy | Explicit | Requires acknowledgment per message |
| Max ack pending | 10,000 | Allows multiple batches in-flight |
| Ack wait | 60 seconds | Redelivers if Vector crashes |

Vector pulls batches of up to 1,000 messages and acknowledges them only after
successful insertion into ClickHouse. This provides end-to-end delivery
guarantees from the API server to storage. The pipeline handles failures at each
stage: the sidecar disk buffer retains events during NATS outages, the durable
stream replays events after NATS restarts, unacknowledged messages redeliver
after 60 seconds if the aggregator crashes, and the aggregator disk buffer
retains events during ClickHouse outages.

### Vector Aggregator

The Vector aggregator pulls audit events from NATS JetStream and inserts them
into ClickHouse. It runs as a stateless deployment with horizontal autoscaling
(2-5 replicas) based on CPU and memory utilization.

> [!NOTE]
>
> Future versions will scale based on NATS consumer backlog depth rather than
> resource utilization, enabling faster catch-up during traffic spikes.

The aggregator performs several transforms before inserting events:

1. **Latency calculation**: Computes end-to-end pipeline latency from the
   `stageTimestamp` field and exports it as a Prometheus histogram metric
2. **IP filtering**: Removes RFC 1918 private addresses from the `sourceIPs`
   array to avoid exposing internal cluster topology
3. **Stage filtering**: Keeps only `ResponseComplete` events, reducing storage
   volume by approximately 75% while preserving complete audit information
4. **JSON encoding**: Wraps the full event as a JSON string for ClickHouse
   insertion

Events insert into ClickHouse with the following batching and reliability
settings:

| Setting | Value | Purpose |
|---------|-------|---------|
| Max batch size | 10 MB | Limits memory usage per batch |
| Max events | 10,000 | Caps batch event count |
| Batch timeout | 10 seconds | Ensures timely delivery |
| Disk buffer | 10 GB | Survives ClickHouse outages |
| Compression | gzip | Reduces network bandwidth |
| Retry behavior | Unlimited with backoff | Ensures delivery during outages |

The aggregator acknowledges messages in NATS only after successful insertion
into ClickHouse. This end-to-end acknowledgment ensures no events are lost
during processing failures or restarts.

### ClickHouse

The activity service stores audit events in a ClickHouse cluster managed by the
[Altinity ClickHouse Operator][clickhouse-operator]. The cluster runs 3 replicas
coordinated by [ClickHouse Keeper][clickhouse-keeper] for high availability.

[clickhouse-operator]: https://github.com/Altinity/clickhouse-operator
[clickhouse-keeper]:
    https://clickhouse.com/docs/en/guides/sre/keeper/clickhouse-keeper

The `audit.events` table stores raw audit events as ZSTD-compressed JSON with
materialized columns extracted for efficient filtering:

| Column | Type | Purpose |
|--------|------|---------|
| `event_json` | String | Full audit event (ZSTD compressed) |
| `timestamp` | DateTime64 | Extracted from `requestReceivedTimestamp` |
| `scope_type` | LowCardinality(String) | Tenant type (Organization, Project, User) |
| `scope_name` | String | Tenant identifier |
| `user`, `user_uid` | String | Actor identity |
| `verb`, `resource`, `api_group` | LowCardinality(String) | Request metadata |
| `namespace`, `resource_name` | String | Target object |
| `status_code` | UInt16 | HTTP response code |

The table uses `ReplicatedReplacingMergeTree` with daily partitioning and a
primary key optimized for time-scoped tenant queries. Bloom filter and minmax
skip indexes accelerate filtering on commonly queried columns. Three projections
provide optimized sort orders for platform-wide, username-based, and user UID
queries.

Writes require acknowledgment from 2 of 3 replicas before returning success.
Reads use sequential consistency to ensure read-after-write guarantees. The
7-day deduplication window prevents duplicate events from pipeline retries.

The cluster uses a hot/cold storage policy:

| Tier | Storage | Retention | Purpose |
|------|---------|-----------|---------|
| Hot | Local SSD | 90 days | Fast queries on recent data |
| Cold | S3-compatible | Unlimited | Cost-effective archival |

Data automatically moves from hot to cold storage after 90 days via TTL rules. A
10 GB local cache accelerates queries against cold data.

### Activity APIServer

The activity API server exposes audit log queries through the control plane API.
It uses the [Kubernetes aggregated apiserver framework][aggregated-api] to
integrate seamlessly with kubectl and standard Kubernetes clients.

[aggregated-api]:
    https://kubernetes.io/docs/concepts/extend-kubernetes/api-extension/apiserver-aggregation/

The API server delegates authentication and authorization to the core platform
API server. Query scope is determined by the user's authentication context,
extracted from extra fields set by the platform's identity system.

#### AuditLogQuery Resource

The `AuditLogQuery` resource (`activity.miloapis.com/v1alpha1`) is an ephemeral
resource that executes queries on creation. Like `TokenReview` or
`SubjectAccessReview`, it supports only the `create` verb and does not persist
to etcd.

```yaml
apiVersion: activity.miloapis.com/v1alpha1
kind: AuditLogQuery
metadata:
  name: recent-deletions
spec:
  startTime: "now-7d"              # Relative or RFC3339 absolute
  endTime: "now"
  filter: "verb == 'delete'"       # CEL expression (optional)
  limit: 100                       # 1-1000, default 100
  continue: ""                     # Pagination cursor
```

Results return in the `status` field, sorted newest-first. The response includes
`effectiveStartTime` and `effectiveEndTime` showing the resolved timestamps when
using relative time expressions.

#### CEL Filtering

The API server compiles [CEL][cel] filter expressions to ClickHouse SQL at query
time. Parameterized queries prevent SQL injection.

[cel]: https://cel.dev

Available filter fields:

| Field | Type | Description |
|-------|------|-------------|
| `verb` | string | API action (get, list, create, update, patch, delete, watch) |
| `auditID` | string | Unique event identifier |
| `requestReceivedTimestamp` | timestamp | When the API server received the request |
| `objectRef.namespace` | string | Target resource namespace |
| `objectRef.resource` | string | Resource type (pods, deployments, secrets) |
| `objectRef.name` | string | Resource name |
| `objectRef.apiGroup` | string | API group (apps, networking.k8s.io) |
| `user.username` | string | Actor username or service account |
| `user.uid` | string | Actor unique identifier |
| `responseStatus.code` | int | HTTP response code |

Supported operators: `==`, `!=`, `<`, `>`, `<=`, `>=`, `&&`, `||`, `in`

String functions: `startsWith()`, `endsWith()`, `contains()`

#### Pagination

The API server uses cursor-based pagination for efficient traversal of large
result sets. Cursors encode the last event's timestamp and audit ID, a SHA256
hash of query parameters, and an issuance timestamp. Cursors expire after 1 hour
and are invalidated if query parameters change between requests.

## Multi-tenancy

The activity system isolates audit logs by tenant, enabling users to query their
own data while allowing platform operators to query across tenants.

### Scope Hierarchy

The system supports four scope levels:

| Scope | Description | Query Behavior |
|-------|-------------|----------------|
| Platform | Platform operators | Queries all events across all tenants |
| Organization | Organization members | Queries events within a specific organization |
| Project | Project members | Queries events within a specific project |
| User | Individual users | Queries events performed by a specific user |

User scope differs from organization and project scope: it returns events
performed **by** the user across all organizations and projects, not events
**within** a user's namespace. This enables users to view their own activity
across the platform.

> [!NOTE]
>
> Scopes are not hierarchically inclusive. Organization-scoped queries return
> only events tagged with that organization—they do not include events from
> projects within the organization. To view project activity, query with project
> scope directly. This behavior may change in a future release.

### Event Tagging

Audit events must include annotations to indicate their tenant scope. The
control plane API server or an admission controller sets these annotations when
generating audit events:

| Annotation | Description |
|------------|-------------|
| `platform.miloapis.com/scope.type` | Tenant type (Organization, Project) |
| `platform.miloapis.com/scope.name` | Tenant identifier |

The Vector aggregator extracts these annotations into materialized ClickHouse
columns (`scope_type`, `scope_name`) for efficient filtering.

### Scope Resolution

The API server determines query scope from the user's authentication context.
The platform's identity system sets extra fields on the authenticated user:

| Extra Field | Description |
|-------------|-------------|
| `iam.miloapis.com/parent-type` | Parent resource type (Organization, Project, User) |
| `iam.miloapis.com/parent-name` | Parent resource name or user UID |

When no parent resource is specified, the API server defaults to platform scope.
The query builder adds appropriate WHERE clauses based on the resolved scope:

- **Platform**: No scope filter applied
- **Organization/Project**: Filters by `scope_type` and `scope_name` columns
- **User**: Filters by `user_uid` column

> [!IMPORTANT]
>
> The platform is responsible for authorizing users before they reach the
> activity API. The activity service trusts the scope provided by the
> authentication system and does not perform additional authorization checks.

## Observability

The activity service exports metrics, traces, and logs to help operators
understand system performance and troubleshoot issues.

### Metrics

The API server exports Prometheus metrics at the `/metrics` endpoint:

| Metric | Type | Description |
|--------|------|-------------|
| `activity_clickhouse_query_duration_seconds` | Histogram | ClickHouse query latency |
| `activity_clickhouse_query_total` | Counter | Total queries by status |
| `activity_clickhouse_query_errors_total` | Counter | Failed queries by error type |
| `activity_auditlog_query_results_total` | Histogram | Results returned per query |
| `activity_cel_filter_parse_duration_seconds` | Histogram | CEL filter compilation time |
| `activity_cel_filter_errors_total` | Counter | CEL compilation errors by type |
| `activity_auditlog_queries_by_scope_total` | Counter | Queries by scope type |
| `activity_auditlog_query_lookback_duration_seconds` | Histogram | How far back queries look |
| `activity_auditlog_query_time_range_seconds` | Histogram | Query time range duration |

The Vector aggregator exports pipeline metrics:

| Metric | Type | Description |
|--------|------|-------------|
| `activity_pipeline_end_to_end_latency_seconds` | Histogram | Latency from event generation to aggregator |
| `vector_*` | Various | Standard Vector internal metrics |

### Tracing

The API server supports distributed tracing via OpenTelemetry. Traces export to
an OTLP-compatible backend (such as Tempo or Jaeger) and include spans for:

- ClickHouse query execution
- CEL filter compilation and SQL conversion
- Kubernetes API request handling

Configure the sampling rate based on environment:

| Environment | Sampling Rate | Configuration |
|-------------|---------------|---------------|
| Development | 100% | `samplingRatePerMillion: 1000000` |
| Staging | 10% | `samplingRatePerMillion: 100000` |
| Production | 1% | `samplingRatePerMillion: 10000` |

### Dashboards

Two Grafana dashboards are provided:

**Activity API Server**: Focuses on query performance and behavior. Shows API
request rates, query latency percentiles, error rates, and ClickHouse
performance correlation. Use this dashboard to diagnose issues reported by
end-users.

**Audit Pipeline**: Monitors the ingestion pipeline from Vector sidecar through
NATS to ClickHouse. Shows event throughput, end-to-end latency, buffer
utilization, and delivery success rates. Use this dashboard to identify
ingestion bottlenecks or delivery failures.
