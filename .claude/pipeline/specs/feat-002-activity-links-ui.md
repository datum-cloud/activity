# Product Specification: Activity Links UI

**Feature ID**: feat-002-activity-links-ui  
**Version**: 1.0  
**Date**: 2026-02-17  
**Status**: Ready for Design  

---

## Handoff

- **From**: product-planner
- **To**: product-designer
- **Context Summary**: This specification defines the click behavior and UX requirements for resource links in Activity feed summaries. The core rendering infrastructure exists; this spec focuses on completing the integration and ensuring a polished user experience.
- **Decisions Made**:
  - Click behavior: Navigate to resource history view for resource links
  - Actor links: Filter activities by actor (out of scope for v1)
  - URL construction: Use query parameters with ResourceRef fields
  - Resource existence: No pre-flight check; handle 404 gracefully
- **Open Questions**:
  - [NON-BLOCKING] Actor link behavior: Should actors filter or navigate to a profile?
  - [NON-BLOCKING] Analytics: Should we track link click events?

---

## 1. Feature Overview

### Summary

Activity summaries display human-readable descriptions of cluster changes, such as "alice deployed api-gateway". Resource names mentioned in these summaries should be clickable, allowing users to navigate directly to the resource's history view without manual searching.

### Current State

The implementation is substantially complete:

| Component | Status | Location |
|-----------|--------|----------|
| Link data population | Complete | Backend `spec.links` via `link()` CEL function |
| Link parsing algorithm | Complete | `ActivityFeedSummary.tsx` - handles overlaps, multiple occurrences |
| Link rendering | Complete | Renders as `<button>` with underline styling |
| Click handler interface | Complete | `onResourceClick(resource: ResourceRef)` prop |
| Example app integration | Complete | Navigates to `/resource-history` with query params |

### Remaining Work

1. Accessibility improvements (keyboard navigation, focus management)
2. Visual feedback refinement (loading states, hover transitions)
3. Edge case handling documentation
4. Testing requirements

---

## 2. Functional Requirements

### FR-1: Link Rendering in Summaries

**Requirement**: Resource names identified by ActivityPolicy link markers must render as visually distinct, interactive elements within summary text.

**Acceptance Criteria**:

| ID | Criterion | Status |
|----|-----------|--------|
| FR-1.1 | Links render inline within summary text flow | Implemented |
| FR-1.2 | Links display the marker text exactly as authored in the policy | Implemented |
| FR-1.3 | Multiple links in a single summary are independently clickable | Implemented |
| FR-1.4 | Overlapping markers (one marker is substring of another) resolve correctly | Implemented |
| FR-1.5 | Links are distinguishable from plain text (color + underline) | Implemented |

**Implementation Notes**:

The `parseSummaryWithLinks` function in `ActivityFeedSummary.tsx` handles:
- Sorting markers by length (longest first) to prevent partial matches
- Tracking replaced ranges to avoid overlapping replacements
- Building an array of text nodes and button elements

### FR-2: Click Behavior Definitions

**Requirement**: When a user clicks a resource link, they must be navigated to a view that shows that resource's details or history.

**Acceptance Criteria**:

| ID | Criterion | Status |
|----|-----------|--------|
| FR-2.1 | Clicking a resource link invokes `onResourceClick` with full `ResourceRef` | Implemented |
| FR-2.2 | Click events do not propagate to parent card (no double-navigation) | Implemented |
| FR-2.3 | Default behavior (if no handler): no navigation (graceful no-op) | Implemented |
| FR-2.4 | Handler receives all available resource identifiers (kind, name, namespace, uid, apiGroup) | Implemented |

**Current Implementation** (Example App):

```typescript
const handleResourceClick = (resource: ResourceRef) => {
  const params = new URLSearchParams();
  if (resource.uid) {
    params.set("uid", resource.uid);
  } else {
    if (resource.apiGroup) params.set("apiGroup", resource.apiGroup);
    if (resource.kind) params.set("kind", resource.kind);
    if (resource.namespace) params.set("namespace", resource.namespace);
    if (resource.name) params.set("name", resource.name);
  }
  navigate(`/resource-history?${params.toString()}`);
};
```

### FR-3: Resource Type Handling

**Requirement**: Links must work correctly for all Kubernetes resource types that can be referenced in ActivityPolicy rules.

**Supported Resource Types**:

| Category | Resource Types | Navigation Target |
|----------|---------------|-------------------|
| Core | Pod, Service, ConfigMap, Secret, Namespace, ServiceAccount | Resource History |
| Workloads | Deployment, ReplicaSet, StatefulSet, DaemonSet, Job, CronJob | Resource History |
| Networking | Ingress, NetworkPolicy, Gateway, HTTPRoute | Resource History |
| RBAC | Role, ClusterRole, RoleBinding, ClusterRoleBinding | Resource History |
| Custom Resources | Any CRD with apiGroup | Resource History |

**Acceptance Criteria**:

| ID | Criterion | Status |
|----|-----------|--------|
| FR-3.1 | Core Kubernetes resources link correctly | Implemented |
| FR-3.2 | Custom resources (with apiGroup) link correctly | Implemented |
| FR-3.3 | Cluster-scoped resources (no namespace) link correctly | Implemented |
| FR-3.4 | Resources with UIDs use UID for precise matching | Implemented |

### FR-4: Edge Cases

**Requirement**: The system must handle edge cases gracefully without breaking the UI.

**Edge Case Matrix**:

| Edge Case | Expected Behavior | Status |
|-----------|-------------------|--------|
| Summary contains no links | Render as plain text | Implemented |
| `links` array is empty | Render as plain text | Implemented |
| `links` array is undefined | Render as plain text | Implemented |
| Marker text appears multiple times | All occurrences become links | Implemented |
| Marker text is substring of summary | Only exact marker matches link | Implemented |
| Two markers overlap | Longer marker takes precedence | Implemented |
| Resource no longer exists | Show "Resource not found" in history view | Handled by target view |
| Very long marker text | Truncate with ellipsis in tooltip only | Not implemented (v2) |
| Special characters in marker | Render escaped/safe | Implemented (React handles) |

---

## 3. Non-Functional Requirements

### NFR-1: Performance

| ID | Requirement | Target | Validation |
|----|-------------|--------|------------|
| NFR-1.1 | Link parsing must not cause visible re-renders on hover | <16ms parse time | Manual testing |
| NFR-1.2 | Click-to-navigation latency | <100ms | Performance timing |
| NFR-1.3 | Large summaries (20+ links) must render without jank | 60fps maintained | DevTools profiler |

**Implementation Notes**:
- `parseSummaryWithLinks` runs once per render (not on hover)
- Link state is derived from props, not local state
- No expensive DOM operations in click handlers

### NFR-2: Accessibility

| ID | Requirement | WCAG | Status |
|----|-------------|------|--------|
| NFR-2.1 | Links must be keyboard accessible (Tab navigation) | 2.1.1 | Partial |
| NFR-2.2 | Links must have focus indicators | 2.4.7 | Needs work |
| NFR-2.3 | Links must have accessible name (title attribute) | 1.1.1 | Implemented |
| NFR-2.4 | Links must announce purpose to screen readers | 4.1.2 | Needs work |
| NFR-2.5 | Click target must be at least 24x24 CSS pixels | 2.5.8 | Needs verification |

**Current Implementation**:
```tsx
<button
  type="button"
  className="bg-transparent border-none p-0 cursor-pointer underline ..."
  onClick={handleClick}
  title={`${range.link.resource.kind}: ${range.link.resource.name}`}
>
```

**Required Changes**:
1. Add visible focus ring styles (`:focus-visible`)
2. Add `aria-label` for screen reader context
3. Verify touch target size on mobile

### NFR-3: Mobile Responsiveness

| ID | Requirement | Breakpoint | Status |
|----|-------------|------------|--------|
| NFR-3.1 | Links remain tappable on mobile | <768px | Needs verification |
| NFR-3.2 | Touch targets meet minimum size | 44x44px | Needs verification |
| NFR-3.3 | Long link text wraps appropriately | All | Implemented |
| NFR-3.4 | No horizontal scroll from link overflow | All | Implemented |

---

## 4. User Experience

### UX-1: Link Styling

**Visual Design**:

| State | Text Color | Underline | Background | Cursor |
|-------|------------|-----------|------------|--------|
| Default | `text-primary` | Solid underline | Transparent | Pointer |
| Hover | `text-primary/80` | Solid underline | Transparent | Pointer |
| Focus | `text-primary` | Solid underline | Focus ring | - |
| Active | `text-primary/70` | Solid underline | Transparent | Pointer |

**Current CSS**:
```css
.bg-transparent.border-none.p-0.cursor-pointer.underline.underline-offset-2.text-primary.hover:text-primary/80
```

**Required Additions**:
```css
focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
```

### UX-2: Click Feedback

| Interaction | Feedback |
|-------------|----------|
| Click | Immediate navigation (no loading state in link itself) |
| Navigation in progress | Target page shows loading indicator |
| Resource not found | Target page shows "Resource not found" message with back button |

**Design Decision**: Click feedback is handled by the navigation target, not the link itself. This avoids complex loading state management in inline buttons.

### UX-3: Hover States

| Element | Hover Behavior |
|---------|----------------|
| Link text | Color lightens (`primary/80`) |
| Tooltip | Shows `{Kind}: {Name}` after 300ms delay |
| Parent card | Card hover effect still applies (no interference) |

**Tooltip Content Format**:
```
{Kind}: {Name}
```
Examples:
- `Deployment: api-gateway`
- `ConfigMap: database-config`
- `ClusterRole: admin`

---

## 5. Technical Approach

### 5.1 Component Architecture

```
ActivityFeed
  └─ ActivityFeedItem
       └─ ActivityFeedSummary  ← Link rendering happens here
            └─ <button> elements for each link
```

**Data Flow**:
1. `ActivityFeed` receives `onResourceClick` prop from consuming app
2. Passes it down through `ActivityFeedItem` to `ActivityFeedSummary`
3. `ActivityFeedSummary` calls handler with `ResourceRef` on click

### 5.2 Component Changes Required

#### ActivityFeedSummary.tsx

**Current Implementation**: Complete, but accessibility needs improvement.

**Changes Required**:

```diff
  result.push(
    <button
      key={`link-${i}`}
      type="button"
-     className="bg-transparent border-none p-0 cursor-pointer underline underline-offset-2 text-primary hover:text-primary/80"
+     className="bg-transparent border-none p-0 cursor-pointer underline underline-offset-2 text-primary hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 rounded-sm"
      onClick={handleClick}
      title={`${range.link.resource.kind}: ${range.link.resource.name}`}
+     aria-label={`View ${range.link.resource.kind} ${range.link.resource.name}${range.link.resource.namespace ? ` in namespace ${range.link.resource.namespace}` : ''}`}
    >
      {range.link.marker}
    </button>
  );
```

### 5.3 Click Handler Implementation

**Library Responsibility** (ActivityFeedSummary):
- Parse links from props
- Render interactive buttons
- Call `onResourceClick(resource)` with full `ResourceRef`
- Prevent event propagation

**Consumer Responsibility** (Example App / Portal):
- Implement `onResourceClick` handler
- Build navigation URL from `ResourceRef`
- Execute navigation (React Router, Next.js router, etc.)

**Example Implementation** (already in example app):

```typescript
// ui/example/app/routes/activity-feed.tsx
const handleResourceClick = (resource: ResourceRef) => {
  const params = new URLSearchParams();
  if (resource.uid) {
    params.set("uid", resource.uid);
  } else {
    if (resource.apiGroup) params.set("apiGroup", resource.apiGroup);
    if (resource.kind) params.set("kind", resource.kind);
    if (resource.namespace) params.set("namespace", resource.namespace);
    if (resource.name) params.set("name", resource.name);
  }
  navigate(`/resource-history?${params.toString()}`);
};
```

### 5.4 URL/Route Construction

**Pattern Used**: Query parameters with ResourceRef fields

```
/resource-history?uid=<uid>
/resource-history?apiGroup=<group>&kind=<kind>&namespace=<ns>&name=<name>
```

**Priority**:
1. If `uid` is available, use it (exact match)
2. Otherwise, use combination of apiGroup + kind + namespace + name

**Why Query Params**:
- Flexible: supports partial matching
- Extensible: easy to add new fields
- Debuggable: visible in URL bar
- Bookmarkable: users can share links

---

## 6. Acceptance Criteria

### Definition of Done

| Category | Criterion | Verification |
|----------|-----------|--------------|
| **Functional** | Resource links render in all activity summaries with links | Visual inspection |
| **Functional** | Clicking a link navigates to resource history | Manual testing |
| **Functional** | Multiple links in one summary work independently | Manual testing |
| **Functional** | Overlapping markers resolve correctly | Unit test |
| **Accessibility** | Links are keyboard navigable (Tab) | Manual testing |
| **Accessibility** | Focus indicators are visible | Visual inspection |
| **Accessibility** | Screen readers announce link purpose | VoiceOver/NVDA testing |
| **Performance** | No re-renders on hover | React DevTools |
| **Performance** | Click-to-navigation < 100ms | Performance timing |
| **Mobile** | Links are tappable on mobile | Device testing |
| **Edge Cases** | Empty links array renders plain text | Unit test |
| **Edge Cases** | Deleted resources show appropriate message | Manual testing |

### Test Plan

**Unit Tests** (Jest + React Testing Library):
- [ ] `parseSummaryWithLinks` returns plain text for undefined links
- [ ] `parseSummaryWithLinks` returns plain text for empty links array
- [ ] `parseSummaryWithLinks` handles single link correctly
- [ ] `parseSummaryWithLinks` handles multiple non-overlapping links
- [ ] `parseSummaryWithLinks` handles overlapping links (longer wins)
- [ ] `parseSummaryWithLinks` handles duplicate markers
- [ ] Click handler is called with correct ResourceRef
- [ ] Click events do not propagate to parent

**Accessibility Tests** (axe-core):
- [ ] No accessibility violations on activity feed with links
- [ ] Links have accessible names
- [ ] Focus order is logical

**Integration Tests** (Playwright):
- [ ] Navigate from activity feed to resource history via link click
- [ ] Back button returns to activity feed
- [ ] Deep link URL is correct

---

## 7. Out of Scope (v2)

The following items are explicitly deferred to a future version:

| Item | Reason | Priority |
|------|--------|----------|
| Resource preview on hover | Requires tooltip component with async data loading | Medium |
| Actor links (filter by actor) | Different click behavior than resource links | Medium |
| Cross-cluster navigation | Multi-cluster architecture not defined | Low |
| Resource existence pre-check | Adds latency, limited user value | Low |
| Deep linking into resource tabs | Requires knowledge of resource detail page structure | Low |
| Link analytics tracking | Not required for MVP functionality | Low |
| Custom link handlers (plugins) | No plugin architecture exists | Low |
| Configurable URL patterns | Example app pattern works; portals can override | Low |

---

## Appendix A: ResourceRef Interface

```typescript
interface ResourceRef {
  /** API group (e.g., "apps", "networking.k8s.io", "") */
  apiGroup: string;
  /** API version (optional, e.g., "v1", "v1beta1") */
  apiVersion?: string;
  /** Resource kind (e.g., "Deployment", "Pod", "ConfigMap") */
  kind: string;
  /** Resource name */
  name: string;
  /** Namespace (undefined for cluster-scoped resources) */
  namespace?: string;
  /** Resource UID (most precise identifier) */
  uid?: string;
}
```

## Appendix B: ActivityLink Interface

```typescript
interface ActivityLink {
  /** Text substring in summary that should be linked */
  marker: string;
  /** The resource to link to when the marker is clicked */
  resource: ResourceRef;
}
```

## Appendix C: File References

| File | Purpose |
|------|---------|
| `ui/src/components/ActivityFeedSummary.tsx` | Link parsing and rendering |
| `ui/src/components/ActivityFeedItem.tsx` | Passes onResourceClick to summary |
| `ui/src/components/ActivityFeed.tsx` | Top-level feed component |
| `ui/src/types/activity.ts` | ResourceRef and ActivityLink types |
| `ui/example/app/routes/activity-feed.tsx` | Example integration |
| `ui/example/app/routes/resource-history.tsx` | Navigation target |
