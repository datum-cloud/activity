# Activity Stream System - Project Plan

This plan outlines the iterative development approach for the Activity Stream System
based on the [enhancement proposal](./activity.md).

## Current State Summary

**Already Implemented:**
- API types (`Activity`, `ActivityPolicy`, `AuditLogQuery`, `PolicyPreview`)
- Aggregated API server infrastructure with ClickHouse and etcd backends
- ClickHouse storage layer with cursor-based pagination
- Database schema for both audit events and activities tables
- CEL policy validation engine with template parsing
- Policy controller cache management
- Registry storage for AuditLogQuery, ActivityPolicy, and PolicyPreview (partial)

**Not Yet Implemented:**
- Activity Processor (translation engine) - the core missing piece
- NATS integration for consuming audit events and publishing activities
- Watch API for real-time activity streaming
- ActivityFacetQuery endpoint
- Full Activity query API implementation
- kubectl plugin

## Development Phases

### Phase 1: Activity Processor Foundation

**Goal:** Build the core translation engine that converts raw audit logs into Activity records.

**Deliverables:**
1. Activity Processor service structure
2. ActivityPolicy evaluation engine using the CEL package
3. Summary template rendering with link extraction
4. Actor resolution logic
5. Change source classification (human vs system)
6. Direct ClickHouse insertion (bypassing NATS initially)

**Tasks:**

| # | Task | Description |
|---|------|-------------|
| 1.1 | Create processor package structure | `internal/processor/processor.go` with main processing loop |
| 1.2 | Implement policy matcher | Load compiled policies from cache, match audit events by apiGroup/kind |
| 1.3 | Implement template evaluator | Render CEL templates with `{{ }}` expressions, extract links |
| 1.4 | Implement actor resolver | Extract actor from audit.user fields, classify type (user/service account/controller) |
| 1.5 | Implement change source classifier | Determine human vs system based on username patterns and annotations |
| 1.6 | Add Activity record builder | Assemble complete Activity struct from processed data |
| 1.7 | Add direct ClickHouse writer | Insert Activity records directly (temporary, replaced by NATS in Phase 2) |
| 1.8 | Unit tests for processor | Test policy matching, template rendering, actor resolution |

**Dependencies:** Existing CEL package, policy cache, ClickHouse storage

**Validation Criteria:**
- [ ] Can load ActivityPolicy resources and compile CEL expressions
- [ ] Can match an audit event to the correct policy rule
- [ ] Can render summary templates with embedded expressions
- [ ] Can extract links from summary templates
- [ ] Can classify actors and change sources correctly
- [ ] Can write Activity records to ClickHouse

---

### Phase 2: NATS Integration

**Goal:** Integrate with NATS JetStream for consuming audit events and publishing activities.

**Deliverables:**
1. NATS consumer for audit events
2. NATS publisher for activities
3. Subject naming convention implementation
4. Consumer group management for horizontal scaling

**Tasks:**

| # | Task | Description |
|---|------|-------------|
| 2.1 | Add NATS client configuration | Connection settings, credentials, TLS |
| 2.2 | Implement audit event consumer | Subscribe to audit event stream, deserialize events |
| 2.3 | Implement activity publisher | Publish to subjects matching naming convention |
| 2.4 | Implement subject naming | Replace dots with underscores in apiGroup, build full subject path |
| 2.5 | Add consumer group support | Durable consumers for horizontal scaling |
| 2.6 | Replace direct ClickHouse write | Activities flow: Processor → NATS → Vector → ClickHouse |
| 2.7 | Integration tests | End-to-end with embedded NATS |

**Dependencies:** Phase 1, NATS JetStream

**Validation Criteria:**
- [ ] Can consume audit events from NATS
- [ ] Can publish activities to correct NATS subjects
- [ ] Subject naming follows convention (tenant, apiGroup, kind, namespace, name)
- [ ] Multiple processor instances can consume without duplication

---

### Phase 3: Activity Query API

**Goal:** Implement full Activity query functionality in the API server.

**Deliverables:**
1. List activities with filtering
2. Get specific activity
3. CEL filter evaluation
4. Time range queries
5. Full-text search

**Tasks:**

| # | Task | Description |
|---|------|-------------|
| 3.1 | Implement Activity List handler | Query ClickHouse with pagination |
| 3.2 | Implement Activity Get handler | Fetch by name/namespace |
| 3.3 | Add CEL filter support | Compile and evaluate user-provided CEL expressions |
| 3.4 | Add time range support | Parse `start` and `end` parameters, including relative times |
| 3.5 | Add field selector support | Parse and apply field selectors to query |
| 3.6 | Add label selector support | Parse and apply label selectors |
| 3.7 | Add full-text search | Use ClickHouse tokenbf_v1 index for summary search |
| 3.8 | Integration tests | Query various filter combinations |

**Dependencies:** ClickHouse activities table, timeutil package

**Validation Criteria:**
- [ ] Can list activities with pagination
- [ ] Can filter by changeSource, actor, resource, etc.
- [ ] Time range queries work with RFC3339 and relative formats
- [ ] Full-text search returns matching activities
- [ ] Scope-based filtering respects tenant isolation

---

### Phase 4: Watch API

**Goal:** Enable real-time activity streaming for portal integration.

**Deliverables:**
1. Watch endpoint implementation
2. NATS-to-Watch bridge
3. Filter application on watch streams
4. Reconnection handling

**Tasks:**

| # | Task | Description |
|---|------|-------------|
| 4.1 | Implement Watch handler | Return watch.Interface for activity streams |
| 4.2 | Add NATS subscription per watch | Create ephemeral consumer scoped to user's authorization |
| 4.3 | Apply field/label selectors to stream | Filter activities before sending to client |
| 4.4 | Add watch timeout handling | Clean up NATS consumers on disconnect |
| 4.5 | Add resourceVersion support | Resume watch from specific point |
| 4.6 | Load tests | Verify concurrent watch connections |

**Dependencies:** Phase 2 (NATS), Phase 3 (Activity API)

**Validation Criteria:**
- [ ] Can establish watch connection
- [ ] Receives real-time activities matching filters
- [ ] Multiple concurrent watches work correctly
- [ ] Consumer cleanup on disconnect

---

### Phase 5: ActivityFacetQuery

**Goal:** Enable autocomplete and filter population in the portal.

**Deliverables:**
1. ActivityFacetQuery API endpoint
2. Efficient distinct value queries
3. Count aggregation per facet value

**Tasks:**

| # | Task | Description |
|---|------|-------------|
| 5.1 | Define FacetQuery storage interface | Create-only ephemeral resource |
| 5.2 | Implement facet query execution | GROUP BY with COUNT for each requested field |
| 5.3 | Add filter support | Apply CEL filter before computing facets |
| 5.4 | Add time range support | Scope facets to time window |
| 5.5 | Add limit per facet | Configurable max values per field |
| 5.6 | Unit and integration tests | Various facet combinations |

**Dependencies:** Phase 3 (Activity API)

**Validation Criteria:**
- [ ] Can query distinct values for actor.name, resource.kind, etc.
- [ ] Results include counts
- [ ] Filters correctly scope facet results
- [ ] Performance acceptable for large datasets

---

### Phase 6: Kubernetes Events Integration

**Goal:** Process Kubernetes Events as an additional activity source.

**Deliverables:**
1. Event consumer from NATS (or direct watch)
2. Event-specific policy rules evaluation
3. Controller actor resolution from reportingController

**Tasks:**

| # | Task | Description |
|---|------|-------------|
| 6.1 | Add event consumer | Subscribe to Kubernetes events (via existing event collector) |
| 6.2 | Add event rule evaluation | Match against eventRules in ActivityPolicy |
| 6.3 | Implement event actor resolution | Map reportingController to actor |
| 6.4 | Add event variable bindings | Provide `event`, `kind`, `kindPlural`, `actor` to CEL |
| 6.5 | Handle event deduplication | Avoid duplicate activities for repeated events |
| 6.6 | Integration tests | End-to-end event processing |

**Dependencies:** Phase 1 (Processor), Phase 2 (NATS)

**Validation Criteria:**
- [ ] Can process Kubernetes Events
- [ ] Event rules match correctly
- [ ] Event summaries render with proper actor
- [ ] No duplicate activities for same logical event

---

### Phase 7: Policy Preview and Validation

**Goal:** Enable policy authors to test and validate their policies before deployment.

**Deliverables:**
1. PolicyPreview endpoint implementation
2. Dry-run validation on ActivityPolicy create/update
3. Enhanced validation error messages

**Tasks:**

| # | Task | Description |
|---|------|-------------|
| 7.1 | Implement evaluatePolicy in preview storage | Call processor with sample input |
| 7.2 | Return matched rule details | Include rule index, type, match expression |
| 7.3 | Return generated activity preview | Summary, links, actor, changeSource |
| 7.4 | Add dry-run validation webhook | Validate CEL syntax on create/update |
| 7.5 | Add duplicate policy detection | Reject if policy for same apiGroup/kind exists |
| 7.6 | Improve error messages | Include line numbers, suggestions |

**Dependencies:** Phase 1 (Processor)

**Validation Criteria:**
- [ ] Can preview policy against sample audit event
- [ ] Can preview policy against sample Kubernetes event
- [ ] Validation errors include helpful messages
- [ ] Duplicate policies are rejected

---

### Phase 8: Kind Label Discovery

**Goal:** Automatically discover human-readable kind labels from CRD annotations.

**Deliverables:**
1. CRD annotation reader
2. Fallback label generation
3. Label cache with watch

**Tasks:**

| # | Task | Description |
|---|------|-------------|
| 8.1 | Add CRD informer | Watch CustomResourceDefinitions |
| 8.2 | Extract kind labels from annotations | Read `activity.miloapis.com/kind-label` |
| 8.3 | Implement fallback generation | Insert spaces before capitals ("HTTPProxy" → "HTTP Proxy") |
| 8.4 | Cache labels by apiGroup/kind | Fast lookup during translation |
| 8.5 | Handle label updates | Refresh cache when CRD annotations change |

**Dependencies:** Phase 1 (Processor)

**Validation Criteria:**
- [ ] Reads kind labels from CRD annotations
- [ ] Generates reasonable fallback labels
- [ ] Cache updates when CRDs change

---

### Phase 9: kubectl Plugin

**Goal:** Provide CLI access to activity stream.

**Deliverables:**
1. `kubectl activity list` command
2. `kubectl activity get` command
3. `kubectl activity watch` command (real-time streaming)

**Tasks:**

| # | Task | Description |
|---|------|-------------|
| 9.1 | Create kubectl-activity binary | Cobra CLI setup |
| 9.2 | Implement list subcommand | Table output with time, actor, summary |
| 9.3 | Implement get subcommand | Detailed activity output |
| 9.4 | Implement watch subcommand | Stream activities to terminal |
| 9.5 | Add filtering flags | --change-source, --actor, --resource-kind, --since |
| 9.6 | Add output format flags | -o json, -o yaml, -o wide |

**Dependencies:** Phase 3 (Activity API), Phase 4 (Watch API)

**Validation Criteria:**
- [ ] kubectl activity list shows recent activities
- [ ] kubectl activity get shows full activity details
- [ ] kubectl activity watch streams new activities
- [ ] Filtering flags work correctly

---

### Phase 10: Documentation and Examples

**Goal:** Provide comprehensive documentation for operators and service providers.

**Deliverables:**
1. ActivityPolicy authoring guide
2. Example policies for common resources
3. Integration guide
4. API reference

**Tasks:**

| # | Task | Description |
|---|------|-------------|
| 10.1 | Write ActivityPolicy authoring guide | CEL syntax, available variables, best practices |
| 10.2 | Create example policies | HTTPProxy, Gateway, Network, DNSZone |
| 10.3 | Write integration guide | Deploying policies with services |
| 10.4 | Generate API reference | OpenAPI docs for all endpoints |
| 10.5 | Add troubleshooting guide | Common issues and solutions |

**Dependencies:** All previous phases

---

## Milestone Summary

| Milestone | Phases | Key Capability |
|-----------|--------|----------------|
| **M1: Core Translation** | 1, 2 | Activities generated from audit logs via NATS |
| **M2: Query & Search** | 3, 5 | Full activity querying with filters and facets |
| **M3: Real-time** | 4 | Watch API for portal integration |
| **M4: Events & Polish** | 6, 7, 8 | Kubernetes events, policy preview, kind labels |
| **M5: CLI & Docs** | 9, 10 | kubectl plugin and documentation |

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| CEL performance on high-volume streams | Compile policies once, cache; benchmark early |
| NATS consumer lag | Horizontal scaling with consumer groups; backpressure handling |
| ClickHouse query latency | Materialized columns and skip indexes already in schema |
| Multi-tenant data isolation | Scope extracted from auth context; tested in Phase 3 |

## Testing Strategy

| Phase | Testing Approach |
|-------|------------------|
| 1-2 | Unit tests with mocked dependencies; embedded NATS for integration |
| 3-5 | Integration tests against real ClickHouse (testcontainers) |
| 6-8 | End-to-end tests with full stack |
| 9 | CLI tests with mock API server |

## Estimated Dependencies

External services required for full operation:
- ClickHouse cluster (Altinity operator)
- etcd instance (for ActivityPolicy storage)
- NATS JetStream cluster
- Vector aggregator (for ClickHouse batching)

Development/testing only:
- Embedded NATS (github.com/nats-io/nats-server/v2/test)
- ClickHouse testcontainer
- Embedded etcd (go.etcd.io/etcd/tests/v3)
