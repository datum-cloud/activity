# Embedding the Activity UI

Drop a live activity feed, policy editor, or event explorer into your platform UI with a few lines of code. `@datum-cloud/activity-ui` is a React component library that lets you embed activity feeds, audit log viewers, ActivityPolicy editors, and ReindexJob management directly into platform portals and admin dashboards. Components talk directly to the Activity API server using the same Kubernetes API surface as kubectl — no separate backend required.

By the end of this guide you should have components rendering in your application and know where to look when you need to customize behavior.

## What the library provides

| Feature | Main components |
|---|---|
| Human-readable activity feed | `ActivityFeed`, `ResourceHistoryView` |
| Raw audit log viewer | `AuditLogQueryComponent` |
| Kubernetes events feed | `EventsFeed` |
| ActivityPolicy editor (with CEL support) | `PolicyEditor`, `PolicyList` |
| ReindexJob management | `ReindexJobList`, `ReindexJobCreate`, `ReindexJobDialog` |
| Shared UI primitives | `Button`, `Card`, `Badge`, `Dialog`, and others |

All data-fetching components accept an `ActivityApiClient` instance and manage their own loading, pagination, and error states internally.

The library exports additional components and UI primitives beyond those documented in this guide. Explore the full set via TypeScript autocompletion or the package's type declarations.

## Prerequisites

The library requires:
- React 18 or 19
- A running Activity API server reachable from the browser

## Installation

```bash
npm install @datum-cloud/activity-ui
```

Install peer dependencies your project does not already provide:

```bash
npm install \
  react react-dom \
  @monaco-editor/react monaco-editor \
  @radix-ui/react-checkbox \
  @radix-ui/react-dialog \
  @radix-ui/react-popover \
  @radix-ui/react-select \
  @radix-ui/react-separator \
  @radix-ui/react-tabs \
  @radix-ui/react-tooltip \
  cmdk
```

The Monaco Editor packages are only required if you embed the `PolicyEditor` or `CelEditor` components.

## Styling

The components use [Tailwind CSS](https://tailwindcss.com/) utility classes. To ensure the utility classes are included in your application's CSS output, add the library's built files to Tailwind's `content` paths:

```js
// tailwind.config.js
content: [
  './src/**/*.{js,ts,jsx,tsx}',
  './node_modules/@datum-cloud/activity-ui/dist/**/*.js',
]
```

This tells Tailwind's scanner to include any utility classes used by the library so they are not purged from the final build.

## The API client

Every data-fetching component requires an `ActivityApiClient` instance. Create it once and pass it down (or provide it via context).

```tsx
import { ActivityApiClient } from '@datum-cloud/activity-ui';

const client = new ActivityApiClient({
  // Base URL of the Activity API server.
  // In development this is typically a kubectl proxy or a reverse proxy in your app server.
  baseUrl: 'https://activity.example.com',

  // Bearer token for authentication. Obtain this from your auth session.
  token: session.accessToken,
});
```

### ApiClientConfig reference

The most important props are `baseUrl` and `token` — the rest have sensible defaults or are only needed in specific deployment scenarios.

| Prop | Type | Required | Description |
|---|---|---|---|
| `baseUrl` | `string` | Yes | Base URL of the Activity API server |
| `token` | `string` | No | Bearer token sent as `Authorization: Bearer <token>` |
| `fetch` | `typeof fetch` | No | Custom fetch implementation, useful for testing |
| `responseTransformer` | `(response: unknown) => unknown` | No | Unwraps proxy-wrapped responses before parsing |

If your portal serves the API behind a reverse proxy that wraps responses (e.g., `{ code: 200, data: {...} }`), use `responseTransformer` to unwrap:

```tsx
const client = new ActivityApiClient({
  baseUrl: '/api/activity',
  token: session.accessToken,
  responseTransformer: (response) => (response as { data: unknown }).data,
});
```

## Activity feed

Use `ActivityFeed` on any page where you want to show users a human-readable log of what has changed — who did what, and when. It fetches on mount and supports infinite scroll and optional real-time streaming.

```tsx
import { ActivityFeed, ActivityApiClient } from '@datum-cloud/activity-ui';

function ActivityPage() {
  const client = new ActivityApiClient({
    baseUrl: 'https://activity.example.com',
    token: session.accessToken,
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <ActivityFeed
        client={client}
        initialTimeRange={{ start: 'now-7d' }}
        initialFilters={{ changeSource: 'human' }}
      />
    </div>
  );
}
```

The component uses flex layout to fill its container. Give the parent a defined height (e.g., `height: 100vh` or a fixed pixel value) so the internal scroll container works correctly.

Explore available props via TypeScript autocompletion in your editor, or see the [TypeScript declarations](https://www.npmjs.com/package/@datum-cloud/activity-ui) for the full list.

### Filtering activities to a specific resource

To scope the feed to changes on one resource, pass `resourceUid`:

```tsx
<ActivityFeed
  client={client}
  resourceUid="6ba7b810-9dad-11d1-80b4-00c04fd430c8"
  showFilters={false}
  compact={true}
/>
```

### Turning on real-time streaming

```tsx
<ActivityFeed
  client={client}
  enableStreaming={true}
  initialTimeRange={{ start: 'now-1h' }}
/>
```

When streaming is active the component shows a live indicator. The user can pause and resume the stream from the component header.

### Making resource links clickable

Provide `resourceLinkResolver` to turn resource references in activity summaries into navigable links:

```tsx
<ActivityFeed
  client={client}
  resourceLinkResolver={(resource, context) => {
    // resource: { apiGroup, kind, name, namespace?, uid? }
    // context: { tenant? }
    return `/projects/${context?.tenant?.name}/resources/${resource.kind.toLowerCase()}/${resource.name}`;
  }}
/>
```

## Resource history view

Use `ResourceHistoryView` on resource detail pages to show a timeline of everything that happened to a specific resource — creates, updates, deletes — in one place.

```tsx
import { ResourceHistoryView } from '@datum-cloud/activity-ui';

function HTTPProxyDetailPage({ proxy }) {
  return (
    <ResourceHistoryView
      client={client}
      resourceFilter={{
        uid: proxy.metadata.uid,
      }}
      startTime="now-30d"
    />
  );
}
```

When you do not have the UID, filter by attributes instead:

```tsx
<ResourceHistoryView
  client={client}
  resourceFilter={{
    apiGroup: 'networking.datumapis.com',
    kind: 'HTTPProxy',
    namespace: 'production',
    name: 'my-proxy',
  }}
/>
```

Explore available props via TypeScript autocompletion in your editor, or see the [TypeScript declarations](https://www.npmjs.com/package/@datum-cloud/activity-ui) for the full list.

## Audit log viewer

`AuditLogQueryComponent` is the right tool for admin and support workflows where you need to dig into the raw Kubernetes audit events — before they are translated into human-readable activities. It includes filter controls and infinite-scroll results.

```tsx
import { AuditLogQueryComponent } from '@datum-cloud/activity-ui';

function AuditLogsPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <AuditLogQueryComponent
        client={client}
        initialTimeRange={{
          start: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          end: new Date().toISOString(),
        }}
      />
    </div>
  );
}
```

Explore available props via TypeScript autocompletion in your editor, or see the [TypeScript declarations](https://www.npmjs.com/package/@datum-cloud/activity-ui) for the full list.

## Kubernetes events feed

`EventsFeed` is useful for operations dashboards and namespace overview pages — it surfaces the same events `kubectl get events` returns, with filtering and optional real-time updates.

```tsx
import { EventsFeed } from '@datum-cloud/activity-ui';

function EventsPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <EventsFeed
        client={client}
        initialTimeRange={{ start: 'now-24h' }}
        enableStreaming={true}
      />
    </div>
  );
}
```

To scope events to a namespace, pass `namespace` and use `hiddenFilters` to hide specific filter fields from the UI:

```tsx
<EventsFeed
  client={client}
  namespace="production"
  hiddenFilters={['namespaces']}
/>
```

Explore available props via TypeScript autocompletion in your editor, or see the [TypeScript declarations](https://www.npmjs.com/package/@datum-cloud/activity-ui) for the full list.

## ActivityPolicy editor

`PolicyEditor` is the right component for a policy management section of your admin UI. It gives operators a full create/edit interface for ActivityPolicy resources, including a rule list editor with Monaco-powered CEL expressions, a live preview panel for testing rules against sample inputs, and validation against the API server.

```tsx
import { PolicyEditor } from '@datum-cloud/activity-ui';

// Create a new policy
function NewPolicyPage() {
  return (
    <PolicyEditor
      client={client}
      onSaveSuccess={(policyName) => {
        router.navigate(`/policies/${policyName}`);
      }}
      onCancel={() => router.navigate('/policies')}
    />
  );
}

// Edit an existing policy
function EditPolicyPage({ policyName }) {
  return (
    <PolicyEditor
      client={client}
      policyName={policyName}
      onSaveSuccess={() => router.navigate(`/policies/${policyName}`)}
      onCancel={() => router.navigate(`/policies/${policyName}`)}
    />
  );
}
```

Explore available props via TypeScript autocompletion in your editor, or see the [TypeScript declarations](https://www.npmjs.com/package/@datum-cloud/activity-ui) for the full list.

### Policy list

`PolicyList` renders a table of all ActivityPolicies with links to view or edit them.

```tsx
import { PolicyList } from '@datum-cloud/activity-ui';

function PoliciesPage() {
  return (
    <PolicyList
      client={client}
      onViewPolicy={(name) => router.navigate(`/policies/${name}/edit`)}
      onCreatePolicy={() => router.navigate('/policies/new')}
    />
  );
}
```

## ReindexJob management

When ActivityPolicy rules change, you can re-process historical audit logs to apply the new rules retroactively. The library provides components for listing, creating, and monitoring those ReindexJobs.

### List jobs with real-time updates

```tsx
import { ReindexJobList } from '@datum-cloud/activity-ui';

function ReindexPage() {
  const [selectedJob, setSelectedJob] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  return (
    <ReindexJobList
      client={client}
      watch={true}
      onViewJob={(jobName) => setSelectedJob(jobName)}
      onCreateJob={() => setShowCreate(true)}
    />
  );
}
```

### Create a job via dialog

`ReindexJobDialog` wraps the create form in a modal dialog. The `policyName` prop is required — wire it to the currently selected policy name:

```tsx
import { ReindexJobDialog } from '@datum-cloud/activity-ui';

function ReindexPage({ selectedPolicyName }: { selectedPolicyName: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button onClick={() => setOpen(true)}>Reindex</button>
      <ReindexJobDialog
        client={client}
        open={open}
        onOpenChange={setOpen}
        policyName={selectedPolicyName}
        onSuccess={(jobName) => {
          setOpen(false);
          console.log('Job created:', jobName);
        }}
      />
    </>
  );
}
```

Explore available props via TypeScript autocompletion in your editor, or see the [TypeScript declarations](https://www.npmjs.com/package/@datum-cloud/activity-ui) for the full list.

## URL-based state (deep linking)

Users expect to share a URL that brings their colleague to the same filtered view. `ActivityFeed` and `EventsFeed` expose an `onFiltersChange` callback that fires whenever the user changes filters or the time range. Use this to synchronize filter state into the URL so pages are shareable and browser-history-navigable.

```tsx
import { useSearchParams } from 'react-router-dom';
import { ActivityFeed } from '@datum-cloud/activity-ui';
import type { ActivityFeedFilters, TimeRange } from '@datum-cloud/activity-ui';

function ActivityPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  // Read initial state from URL
  const initialFilters: ActivityFeedFilters = {
    changeSource: (searchParams.get('source') as 'human' | 'system' | 'all') || 'human',
    resourceKinds: searchParams.getAll('kind'),
    actorNames: searchParams.getAll('actor'),
  };

  const initialTimeRange: TimeRange = {
    start: searchParams.get('start') || 'now-7d',
    end: searchParams.get('end') || undefined,
  };

  // Write state back to URL on change
  const handleFiltersChange = (filters: ActivityFeedFilters, timeRange: TimeRange) => {
    const params = new URLSearchParams();
    if (filters.changeSource) params.set('source', filters.changeSource);
    filters.resourceKinds?.forEach((k) => params.append('kind', k));
    filters.actorNames?.forEach((a) => params.append('actor', a));
    if (timeRange.start) params.set('start', timeRange.start);
    if (timeRange.end) params.set('end', timeRange.end);
    setSearchParams(params, { replace: true });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <ActivityFeed
        client={client}
        initialFilters={initialFilters}
        initialTimeRange={initialTimeRange}
        onFiltersChange={handleFiltersChange}
      />
    </div>
  );
}
```

The same pattern works for `EventsFeed` using its `EventsFeedFilters` and `TimeRange` types.

## Time range formats

All time range fields accept:

- **Relative**: `now-7d`, `now-24h`, `now-30m` (units: `s`, `m`, `h`, `d`, `w`)
- **Absolute**: RFC3339 strings like `2024-01-15T00:00:00Z`

## Using the hooks directly

If the built-in components don't fit your layout, you can use the hooks directly and build your own UI around the data. This is useful when you want to integrate activity data into an existing list, table, or custom visualization.

```tsx
import { useActivityFeed, ActivityApiClient } from '@datum-cloud/activity-ui';

function CustomActivityList({ client }: { client: ActivityApiClient }) {
  const { activities, isLoading, error, hasMore, loadMore } = useActivityFeed({
    client,
    initialFilters: { changeSource: 'human' },
    initialTimeRange: { start: 'now-7d' },
    pageSize: 20,
    enableStreaming: false,
  });

  if (isLoading && activities.length === 0) return <p>Loading...</p>;
  if (error) return <p>Error: {error.message}</p>;

  return (
    <>
      {activities.map((activity) => (
        <div key={activity.metadata?.uid}>{activity.spec?.summary}</div>
      ))}
      {hasMore && <button onClick={loadMore}>Load more</button>}
    </>
  );
}
```

Available hooks:

| Hook | Purpose |
|---|---|
| `useActivityFeed` | Paginated activity list with optional streaming |
| `useFacets` | Distinct field values for activity filter autocomplete |
| `useEventsFeed` | Paginated Kubernetes events with optional streaming |
| `useEventFacets` | Distinct field values for events filter autocomplete |
| `useAuditLogQuery` | Raw audit log search |
| `useAuditLogFacets` | Distinct field values for audit log filters |
| `usePolicyList` | List ActivityPolicies |
| `usePolicyEditor` | Create and edit ActivityPolicy state |
| `usePolicyPreview` | Test policy rules against sample inputs |
| `useReindexJobs` | List and watch ReindexJobs |

## Customizing error messages

All data-fetching components accept an `errorFormatter` prop. The formatter receives an error object and returns a `FormattedError` with `title` and optional `description` strings.

```tsx
import type { ErrorFormatter } from '@datum-cloud/activity-ui';

const errorFormatter: ErrorFormatter = (error) => {
  if (error.name === 'NetworkError') {
    return {
      title: 'Cannot reach the Activity service',
      description: 'Check your network connection and try again.',
    };
  }
  // Fall back to default formatting
  return null;
};

<ActivityFeed client={client} errorFormatter={errorFormatter} />
```

## Troubleshooting

**Components render but show no data**

Open the browser Network panel and look for requests to your `baseUrl`. A 401 response means the token is missing or expired. A 403 means the token does not have permission to list activities — check with your control plane administrator to verify the RBAC configuration.

**CORS errors in the browser**

The Activity API server needs to allow your portal's origin. This is typically configured in the API server's CORS settings or in the reverse proxy in front of it. The library sends `Content-Type: application/json` and `Authorization` headers, both of which must be in the allowed headers list.

**The scroll container does not scroll**

`ActivityFeed` and `EventsFeed` need the parent element to have a constrained height. Make sure the parent has `height: 100vh`, `height: 100%` with a constrained ancestor, or a fixed pixel height. A parent with no height constraint will cause the scroll container to expand to content height and never scroll.

**Monaco editor does not load**

The `PolicyEditor` and `CelEditor` components require `@monaco-editor/react` and `monaco-editor` as peer dependencies. If you see a blank editor panel, verify these packages are installed and that your bundler can resolve the Monaco web workers. The [Monaco Editor bundler documentation](https://github.com/microsoft/monaco-editor/blob/main/docs/integrate-esm.md) covers webpack and Vite configuration.
