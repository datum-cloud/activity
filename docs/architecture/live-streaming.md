# Live Streaming Architecture

The activity service provides real-time streaming of activities via the
Kubernetes Watch API. This enables clients to receive immediate notifications
when resources change, rather than continuously polling for updates.

![Live Streaming Architecture](../diagrams/live-streaming.png)

All Watch operations are backed by NATS JetStream consumers rather than
traditional approaches like etcd watches or in-memory caches. When a client
initiates a Watch request, the API server creates an ephemeral NATS consumer
that subscribes to the relevant subject pattern. As new messages arrive in the
stream, they flow through the consumer to the API server, which applies any
requested filters (CEL expressions, field selectors) before forwarding matching
events to the client over a long-lived HTTP connection.

This architecture provides several key benefits:

- **Decoupled from storage**: Watch operations don't query ClickHouse, reducing
  database load and eliminating polling latency
- **Scalable fan-out**: Multiple clients can watch the same resources without
  duplicating work; each gets an independent consumer
- **Resumable connections**: Clients can reconnect from any point using
  resourceVersion (backed by NATS sequence numbers)
- **Efficient filtering**: Subject-based routing narrows the message stream
  before it reaches the API server

## Ephemeral Consumers

The API server creates an ephemeral ordered consumer for each Watch connection:

| Setting | Value | Purpose |
|---------|-------|---------|
| Durable name | None (ephemeral) | Auto-deleted on disconnect |
| Deliver policy | By start sequence | Resume from resourceVersion |
| Ack policy | None | Fire-and-forget delivery |
| Max deliver | 1 | No redelivery attempts |
| Inactive threshold | 30 seconds | Cleanup after client disconnect |

## resourceVersion Semantics

NATS JetStream sequence numbers serve as resourceVersion, allowing clients to
resume a Watch from any point in the stream. Passing `0` or omitting the value
starts from the current position (new messages only). Watch requests with an
expired resourceVersion receive a 410 Gone error, and clients should fall back
to a List operation to resync state.

## Filtering

Filtering happens in two stages. First, the API server constructs a NATS subject
pattern based on request parameters (tenant, resource kind, namespace) to narrow
the message stream at the source. Then, any CEL expressions or field selectors
are evaluated server-side against each message, with only matching activities
forwarded to the client.

## Scaling

Each API server replica creates independent NATS consumers, requiring no
coordination between replicas. If a client reads slowly, messages buffer in the
consumer until the inactive threshold triggers cleanup. Slow clients should use
the List + Watch pattern to resync state.

## Related Documentation

- [Architecture Overview](./README.md)
- [Activity Pipeline](./activity-pipeline.md) - How activities are generated
- [Multi-tenancy](./multi-tenancy.md) - Scope-based subject filtering
