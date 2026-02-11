# Audit Pipeline

The audit pipeline captures API server operations for compliance, security
investigation, and debugging. It provides a durable, queryable record of all
control plane interactions.

### Key Capabilities

- **CEL-based filtering**: Query audit logs using [Common Expression
  Language][cel] expressions for flexible, type-safe filtering across any field
- **Cursor-based pagination**: Traverse large result sets efficiently with
  time-bounded, tamper-resistant cursors
- **Deduplication**: Automatic detection and elimination of duplicate events
  from webhook retries or collector restarts
- **Multi-tenant isolation**: Scope-based filtering ensures users only see
  audit logs for resources they can access

[cel]: https://cel.dev

### Design Goals

The pipeline prioritizes **durability over latency**. Each stage buffers events
to disk and uses explicit acknowledgments, ensuring no audit records are lost
during outages or restarts. This adds seconds of end-to-end latency but
guarantees delivery.

The pipeline also prioritizes **completeness over storage efficiency**. Full
audit event payloads are preserved in JSON format, enabling ad-hoc queries
against any field. Stage filtering (keeping only `ResponseComplete` events)
reduces storage by ~75% while retaining complete audit information for each
operation.

## Overview

![Audit Pipeline C4 Container Diagram](../diagrams/audit-pipeline.png)

## Components

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

### ClickHouse Storage

See [Data Model](./data-model.md) for the `audit.events` table schema.

Vector pulls batches of up to 1,000 messages and acknowledges them only after
successful insertion into ClickHouse. This provides end-to-end delivery
guarantees from the API server to storage. The pipeline handles failures at each
stage: the sidecar disk buffer retains events during NATS outages, the durable
stream replays events after NATS restarts, unacknowledged messages redeliver
after 60 seconds if the aggregator crashes, and the aggregator disk buffer
retains events during ClickHouse outages.

## Query API

The **AuditLogQuery** resource is an ephemeral resource that executes queries on
creation. Like `TokenReview` or `SubjectAccessReview`, it supports only the
`create` verb and does not persist to etcd.

```yaml
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

### CEL Filtering

The API server compiles [CEL][cel] filter expressions to ClickHouse SQL at query
time. Parameterized queries prevent SQL injection.

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

### Pagination

The API server uses cursor-based pagination for efficient traversal of large
result sets. Cursors encode the last event's timestamp and audit ID, a SHA256
hash of query parameters, and an issuance timestamp.

> [!IMPORTANT]
>
> Pagination cursors expire after 1 hour and are invalidated if query parameters
> change between requests. The API returns an error indicating the cursor has
> expired. When this occurs, re-issue the original query to obtain a fresh
> cursor.

## Related Documentation

- [Architecture Overview](./README.md)
- [Data Model](./data-model.md) - ClickHouse schema details
- [Multi-tenancy](./multi-tenancy.md) - Scope-based query filtering
- [API Reference](../api.md) - Complete AuditLogQuery specification
