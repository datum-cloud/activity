# EventQuery API and EventRecord Structure

## Overview

The Activity API now provides two ways to access Kubernetes Events:

1. **Live Events API** (`/apis/activity.miloapis.com/v1alpha1/events`) - Returns `K8sEvent` objects directly
   - Real-time events via watch streams
   - Limited to recent events (typically 24 hours)
   - Use for monitoring and live updates

2. **EventQuery API** (`/apis/activity.miloapis.com/v1alpha1/eventqueries`) - Returns `EventRecord` objects
   - Historical events from ClickHouse storage
   - Up to 60 days of event history
   - Use for analysis and historical queries

## Data Structure Changes

### Before: K8sEvent (Live Events API)

```typescript
const event: K8sEvent = {
  apiVersion: 'events.k8s.io/v1',
  kind: 'Event',
  metadata: { name: 'pod-event-123', ... },
  regarding: { kind: 'Pod', name: 'my-pod', ... },
  reason: 'Started',
  type: 'Normal',
  note: 'Started container',
  eventTime: '2024-01-15T10:30:00Z',
  // ... other event fields
};

// Access fields directly
console.log(event.regarding.kind); // 'Pod'
console.log(event.reason); // 'Started'
```

### After: EventRecord (EventQuery API)

```typescript
const record: EventRecord = {
  apiVersion: 'activity.miloapis.com/v1alpha1',
  kind: 'EventRecord',
  metadata: { name: 'pod-event-123', ... },
  event: {  // <-- Event data is nested here
    apiVersion: 'events.k8s.io/v1',
    kind: 'Event',
    metadata: { name: 'pod-event-123', ... },
    regarding: { kind: 'Pod', name: 'my-pod', ... },
    reason: 'Started',
    type: 'Normal',
    note: 'Started container',
    eventTime: '2024-01-15T10:30:00Z',
    // ... other event fields
  }
};

// Access fields via .event
console.log(record.event.regarding.kind); // 'Pod'
console.log(record.event.reason); // 'Started'
```

## TypeScript Type Definitions

```typescript
// New types added to ui/src/types/k8s-event.ts

interface EventRecord {
  apiVersion: 'activity.miloapis.com/v1alpha1';
  kind: 'EventRecord';
  metadata: ObjectMeta;
  event: K8sEvent;  // The actual event data
}

interface EventQuery {
  apiVersion: 'activity.miloapis.com/v1alpha1';
  kind: 'EventQuery';
  spec: EventQuerySpec;
  status?: EventQueryStatus;
}

interface EventQuerySpec {
  startTime: string;      // RFC3339 or relative (e.g., "now-7d")
  endTime: string;        // RFC3339 or relative (e.g., "now")
  namespace?: string;
  fieldSelector?: string;
  limit?: number;
  continue?: string;
}

interface EventQueryStatus {
  results: EventRecord[];  // Array of EventRecord objects
  continue?: string;
  effectiveStartTime?: string;
  effectiveEndTime?: string;
}
```

## Helper Functions

Use these helper functions to work with both formats seamlessly:

```typescript
import { extractEvent, isEventRecord } from '@miloapis/activity-ui';

// Extract K8sEvent from either format
const event = extractEvent(eventOrRecord);
console.log(event.regarding.kind); // Works for both K8sEvent and EventRecord

// Check if object is an EventRecord
if (isEventRecord(obj)) {
  console.log('This is an EventRecord from EventQuery');
  const event = obj.event;
} else {
  console.log('This is a plain K8sEvent from live API');
}
```

## API Client Usage

### Using Live Events API (existing)

```typescript
import { ActivityApiClient } from '@miloapis/activity-ui';

const client = new ActivityApiClient({ baseUrl: 'https://api.example.com' });

// List events (returns K8sEvent[])
const eventList = await client.listEvents({
  namespace: 'default',
  fieldSelector: 'type=Warning',
  limit: 50,
});

eventList.items.forEach((event: K8sEvent) => {
  console.log(event.regarding.kind, event.reason);
});

// Watch events in real-time (returns K8sEvent objects)
const { stop } = client.watchEvents({}, {
  onEvent: (watchEvent) => {
    const event: K8sEvent = watchEvent.object;
    console.log('Event:', event.regarding.kind, event.reason);
  },
});
```

### Using EventQuery API (new)

```typescript
import { ActivityApiClient, extractEvent } from '@miloapis/activity-ui';

const client = new ActivityApiClient({ baseUrl: 'https://api.example.com' });

// Query historical events (returns EventRecord[])
const eventQuery = await client.createEventQuery({
  startTime: 'now-7d',
  endTime: 'now',
  namespace: 'production',
  fieldSelector: 'type=Warning,regarding.kind=Pod',
  limit: 100,
});

// Results contain EventRecord objects with nested event data
eventQuery.status?.results.forEach((record) => {
  // Option 1: Access via record.event
  console.log(record.event.regarding.kind, record.event.reason);

  // Option 2: Extract to plain K8sEvent
  const event = extractEvent(record);
  console.log(event.regarding.kind, event.reason);
});
```

## When to Use Which API

### Use Live Events API (`listEvents`, `watchEvents`)
- Real-time monitoring dashboards
- Live event feeds with streaming
- Recent events (last 24 hours)
- WebSocket/watch connections for immediate updates

### Use EventQuery API (`createEventQuery`)
- Historical analysis (up to 60 days)
- Generating reports
- Investigating past incidents
- Querying events with complex time ranges
- Compliance and audit requirements

## Component Updates

The existing components (`EventFeedItem`, `EventExpandedDetails`, `EventsFeed`) work with `K8sEvent` objects from the live API. If you need to display historical events from EventQuery:

```typescript
import { EventFeedItem, extractEvent } from '@miloapis/activity-ui';

// From EventQuery
const eventQuery = await client.createEventQuery({ ... });
const records = eventQuery.status?.results || [];

// Extract K8sEvent objects for rendering
const events = records.map(extractEvent);

// Render with existing components
events.map(event => (
  <EventFeedItem key={event.metadata.uid} event={event} />
));
```

## Migration Checklist

If you're transitioning from live events to EventQuery:

- [ ] Update imports to include `EventRecord`, `EventQuery`, `EventQuerySpec`
- [ ] Change API calls from `listEvents()` to `createEventQuery()`
- [ ] Update data access patterns:
  - Before: `result.items` → After: `result.status?.results`
  - Before: `event.field` → After: `record.event.field`
- [ ] Use `extractEvent()` helper when passing to existing components
- [ ] Update time range parameters (use `startTime`/`endTime` instead of watch params)
- [ ] Handle pagination with `continue` cursor in status instead of metadata

## Examples

### Basic Query with Pagination

```typescript
async function fetchAllWarningEvents(client: ActivityApiClient) {
  const allRecords: EventRecord[] = [];
  let continueToken: string | undefined;

  do {
    const query = await client.createEventQuery({
      startTime: 'now-7d',
      endTime: 'now',
      fieldSelector: 'type=Warning',
      limit: 1000,
      continue: continueToken,
    });

    allRecords.push(...(query.status?.results || []));
    continueToken = query.status?.continue;
  } while (continueToken);

  return allRecords;
}
```

### Converting EventRecords for Display

```typescript
import { extractEvent } from '@miloapis/activity-ui';

const records: EventRecord[] = await fetchHistoricalEvents();

// Convert to K8sEvent for existing components
const events = records.map(extractEvent);

// Now use with any component expecting K8sEvent
<EventsFeed events={events} />
```

## API Response Comparison

### Live Events API Response
```json
{
  "apiVersion": "v1",
  "kind": "EventList",
  "metadata": {
    "continue": "...",
    "resourceVersion": "123456"
  },
  "items": [
    {
      "apiVersion": "events.k8s.io/v1",
      "kind": "Event",
      "metadata": { "name": "event-1" },
      "regarding": { "kind": "Pod", "name": "my-pod" },
      "reason": "Started"
    }
  ]
}
```

### EventQuery API Response
```json
{
  "apiVersion": "activity.miloapis.com/v1alpha1",
  "kind": "EventQuery",
  "spec": {
    "startTime": "now-7d",
    "endTime": "now",
    "limit": 100
  },
  "status": {
    "results": [
      {
        "apiVersion": "activity.miloapis.com/v1alpha1",
        "kind": "EventRecord",
        "metadata": { "name": "event-1" },
        "event": {
          "apiVersion": "events.k8s.io/v1",
          "kind": "Event",
          "metadata": { "name": "event-1" },
          "regarding": { "kind": "Pod", "name": "my-pod" },
          "reason": "Started"
        }
      }
    ],
    "continue": "...",
    "effectiveStartTime": "2024-01-08T10:00:00Z",
    "effectiveEndTime": "2024-01-15T10:00:00Z"
  }
}
```

## Key Differences Summary

| Aspect | Live Events API | EventQuery API |
|--------|----------------|----------------|
| Return Type | `K8sEvent` | `EventRecord` wrapping `K8sEvent` |
| Data Location | `result.items[]` | `result.status.results[]` |
| Event Fields | Direct access: `event.field` | Nested: `record.event.field` |
| Time Range | Implicit (recent) | Explicit (`startTime`, `endTime`) |
| History | ~24 hours | Up to 60 days |
| Use Case | Real-time monitoring | Historical analysis |
| Streaming | Supported (watch) | Not supported |

## Additional Resources

- [EventQuery API Reference](../pkg/apis/activity/v1alpha1/types_eventquery.go)
- [EventRecord Type Definition](../pkg/apis/activity/v1alpha1/types_eventrecord.go)
- [UI Type Definitions](./src/types/k8s-event.ts)
- [API Client Source](./src/api/client.ts)
