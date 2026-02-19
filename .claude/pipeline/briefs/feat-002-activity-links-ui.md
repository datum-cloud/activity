# Discovery Brief: Activity Links UI

**Feature ID**: feat-002-activity-links-ui  
**Date**: 2026-02-17  
**Status**: Ready for Spec  

---

## Handoff

- **From**: product-discovery
- **To**: product-planner
- **Context Summary**: The Activity feed displays human-readable summaries of cluster changes. The backend already populates `spec.links` with marker text and resource references, and the UI component (`ActivityFeedSummary`) already renders these as clickable buttons. The remaining work is defining and implementing the click behavior - what happens when users click a resource link.
- **Decisions Made**:
  - Link parsing and rendering: Already implemented in `ActivityFeedSummary.tsx`
  - Link styling: Uses underlined text with primary color, hover state, and tooltip showing resource kind/name
  - Backend support: Complete - `link()` CEL function generates link data in ActivityPolicy rules
  - Click handler: Passed via `onResourceClick` prop, behavior TBD by consuming application
- **Open Questions**:
  - [BLOCKING] Click behavior: Should links navigate to resource detail, filter activities, or open a panel?
  - [BLOCKING] Resource URL construction: How are resource URLs built? Is there a central URL builder?
  - [NON-BLOCKING] Resource existence: Should we check if the resource still exists before navigation?
  - [NON-BLOCKING] External resources: How to handle links to resources outside the current context (different namespace, cluster)?
  - [NON-BLOCKING] Keyboard accessibility: Tab navigation between links in a summary
- **Platform Capabilities**:
  - **Quota**: Not applicable (UI-only feature)
  - **Insights**: Not applicable (UI-only feature)
  - **Telemetry**: Track link click events for UX analytics (non-blocking for MVP)
  - **Activity**: Not applicable (this IS the Activity UI)

---

## Problem Statement

Activity summaries like "alice deployed api-gateway" mention specific resources (users, deployments, pods) but these names are just plain text. Users cannot navigate directly from an activity to the resource it describes.

**Today's workflow**:
1. User sees "alice deployed api-gateway" in the activity feed
2. User mentally notes the deployment name
3. User opens a new browser tab or navigates away
4. User searches for or browses to the Deployments list
5. User finds "api-gateway" in the list
6. User clicks to view details

**Desired workflow**:
1. User sees "alice deployed api-gateway" with "api-gateway" as a clickable link
2. User clicks the link
3. User arrives at the deployment detail view

This is a core UX improvement that makes the Activity feed actionable rather than informational.

### Why this matters

The Activity feed exists to help users understand what changed and why. But understanding is only the first step - users often need to take action:

- **Incident response**: "Which pod is failing? Let me click through to see its logs."
- **Change review**: "Who is kubernetes-admin? Let me see their recent activity."
- **Troubleshooting**: "This ConfigMap was updated - let me see its current state."

Without clickable links, the Activity feed is a dead end. Users must context-switch to find the resources mentioned.

---

## User Stories

### As a platform operator investigating an incident

I want to click on resource names in activity summaries so that I can quickly navigate to the affected resource and see its current state, logs, and related activities.

**Acceptance criteria**:
- Resource names in summaries are visually distinct (appear clickable)
- Clicking a resource name opens the resource detail view
- Navigation preserves my current context (e.g., opens in same tab or panel)

### As a developer debugging a deployment failure

I want to click on the pod name mentioned in a "FailedScheduling" activity so that I can see the pod's events and status without searching for it manually.

**Acceptance criteria**:
- Pod links navigate to pod detail view
- Works for pods in any namespace I have access to
- Shows clear feedback if the pod no longer exists

### As a security auditor reviewing changes

I want to click on actor names in activity summaries so that I can see all activities performed by that actor and understand their access patterns.

**Acceptance criteria**:
- Actor names (users, service accounts) are clickable
- Clicking filters the activity feed to show only that actor's activities
- Alternative: navigates to an actor profile or identity view

---

## Use Cases

### Incident Investigation Workflow

**Scenario**: Production deployment is failing. SRE is reviewing the activity feed.

1. SRE filters activities to `spec.resource.kind == "Deployment"` 
2. Sees: "kubernetes-admin updated Deployment api-gateway"
3. Clicks "api-gateway" link to see current deployment state
4. Notices `replicas: 0` - someone scaled it down
5. Clicks "kubernetes-admin" to see who and what else they changed
6. Identifies the root cause in under 60 seconds

**Without links**: Same investigation requires 3+ tab switches, manual searches, and 5-10 minutes.

### Audit Trail Navigation

**Scenario**: Compliance review requires tracing all changes to a specific ConfigMap.

1. Auditor searches activities for the ConfigMap name
2. Sees 12 activities mentioning "database-config"
3. Clicks on "database-config" in any activity summary
4. Arrives at ConfigMap detail view showing:
   - Current YAML content
   - Activity timeline for this specific resource
   - Related resources (pods that mount this ConfigMap)

**Value**: Single-click navigation from any mention to the canonical resource view.

### Resource Relationship Exploration

**Scenario**: Developer wants to understand dependencies.

1. Developer views a Deployment's activity timeline
2. Sees: "deployment-controller updated ReplicaSet api-gateway-7f4c8b9"
3. Clicks on "api-gateway-7f4c8b9" to see the ReplicaSet
4. Sees the ReplicaSet's activity timeline showing pod creations
5. Clicks through to specific pods

**Value**: Navigate the Kubernetes resource graph through activity relationships.

---

## Success Metrics

### User Engagement

| Metric | Target | Measurement |
|--------|--------|-------------|
| Link click rate | >10% of activity views result in a link click | Click events / activity impressions |
| Time to resource detail | <2 seconds from activity view to resource detail | Navigation timing |
| Reduced search usage | 25% fewer searches when activity feed is open | Search query analysis |

### Task Completion

| Metric | Target | Measurement |
|--------|--------|-------------|
| Incident MTTR | 15% reduction when using activity feed | Incident duration tracking |
| Audit completion time | 30% faster for compliance reviews | Task timing studies |

### Technical Health

| Metric | Target | Measurement |
|--------|--------|-------------|
| Link rendering success | 100% of valid links render correctly | Error rate monitoring |
| Navigation success | >95% of clicks reach the target resource | 404/error tracking |
| Accessibility compliance | WCAG 2.1 AA for link interactions | Automated testing |

---

## Scope Boundaries

### In Scope for v1

1. **Click handler implementation**: Define `onResourceClick` behavior in the consuming application
2. **Resource URL construction**: Build URLs for supported resource types
3. **In-app navigation**: Navigate to resource detail views within the portal
4. **Supported resource types**: 
   - Core resources: Pod, Service, ConfigMap, Secret, Namespace
   - Workloads: Deployment, ReplicaSet, StatefulSet, DaemonSet, Job, CronJob
   - Networking: Ingress, NetworkPolicy
   - Custom resources: Any with a registered detail view
5. **Actor links**: Click to filter activities by actor
6. **Error handling**: Graceful handling when target resource doesn't exist
7. **Visual feedback**: Hover states, loading states, focus indicators

### Explicitly Out of Scope

1. **Resource preview on hover**: Show resource summary without navigating (defer to v2)
2. **Cross-cluster navigation**: Links to resources in other clusters
3. **Resource existence checks**: Real-time validation that linked resources still exist
4. **Deep linking into resource detail**: Specific tab or section within resource detail
5. **Edit/delete actions from links**: Links are read-only navigation
6. **Custom link handlers**: Plugin system for third-party resource types
7. **Link analytics dashboard**: Tracking which links are clicked most

---

## Dependencies

### Already Complete

| Dependency | Status | Location |
|------------|--------|----------|
| Backend `spec.links` population | Complete | `pkg/apis/activity/v1alpha1/types_activity.go` |
| `link()` CEL function | Complete | ActivityPolicy CEL environment |
| `ActivityFeedSummary` component | Complete | `ui/src/components/ActivityFeedSummary.tsx` |
| `ActivityLink` TypeScript type | Complete | `ui/src/types/activity.ts` |
| `onResourceClick` prop interface | Complete | `ResourceLinkClickHandler` type |

### Required for v1

| Dependency | Owner | Status |
|------------|-------|--------|
| Resource URL builder utility | UI team | Not started |
| Router integration (React Router or Next.js) | App team | Depends on portal architecture |
| Resource detail views exist | UI team | Partial (varies by resource type) |

### Optional Enhancements

| Dependency | Owner | Status |
|------------|-------|--------|
| Click analytics tracking | Platform team | Not started |
| Keyboard navigation (roving tabindex) | UI team | Not started |

---

## Risks and Mitigations

### Technical Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Resource types without detail views | High | Medium | Fallback to filtered activity list for unknown types |
| Marker text appears multiple times in summary | Low | Low | Already handled - algorithm processes all occurrences |
| Marker text substring of another marker | Medium | Low | Already handled - sorted by length, processed longest first |
| Click conflicts with card selection | Medium | Medium | `stopPropagation()` already implemented |

### UX Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Users don't realize text is clickable | Medium | High | Clear visual affordance (underline, color, hover state) |
| Navigation disrupts workflow | Medium | Medium | Consider opening in panel/modal instead of full navigation |
| Too many links make summary hard to read | Low | Low | ActivityPolicy authors control link density |
| Deleted resources lead to 404 | High | Medium | Show "Resource not found" message with back button |

### Integration Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Portal router architecture unknown | Medium | High | Abstract URL building to allow pluggable routing |
| Different portals have different resource URLs | Medium | Medium | URL builder is configurable per-deployment |

---

## Platform Capability Assessment

### Quota

**Not applicable.** This is a UI-only feature that doesn't introduce new resource types, storage, or API calls beyond existing activity queries.

### Insights

**Not applicable.** The Activity system itself IS the insights source. Link click behavior doesn't generate data that the platform needs to observe.

### Telemetry

**Low priority for MVP.** Consider tracking:

- `activity.link.clicked` - Event when user clicks a resource link
  - Labels: `resource_kind`, `destination_type` (detail_view, filtered_list, not_found)
- `activity.link.navigation_duration` - Time from click to destination rendered

This is useful for UX optimization but not required for the feature to function.

### Activity

**Not applicable.** Clicking links in the Activity UI is a read-only operation. It doesn't modify resources, so there's nothing to log to the Activity stream.

---

## Technical Notes

### Existing Implementation Analysis

The `ActivityFeedSummary` component already implements:

1. **Link parsing**: Scans summary text for marker strings
2. **Overlap handling**: Sorts markers by length (longest first) to avoid partial matches
3. **Multiple occurrences**: Finds all instances of each marker
4. **Click handling**: Calls `onResourceClick(resource)` with full `ResourceRef`
5. **Accessibility**: Uses `<button>` elements with `title` attribute
6. **Styling**: Underlined primary color text with hover state

**What remains**: The consuming application must implement `onResourceClick` to actually navigate.

### ResourceRef Structure

```typescript
interface ResourceRef {
  apiGroup: string;
  apiVersion?: string;
  kind: string;
  name: string;
  namespace?: string;
  uid?: string;
}
```

This contains everything needed to construct a resource URL. The implementation must:

1. Map `apiGroup/kind` to a URL path segment (e.g., `apps/Deployment` -> `/deployments`)
2. Include namespace in path if present
3. Append resource name
4. Handle cluster-scoped resources (no namespace)

### Suggested URL Pattern

```
/resources/{namespace}/{kind}/{name}
# or for cluster-scoped:
/resources/_/{kind}/{name}
```

Or if the portal uses resource-specific routes:

```
/workloads/deployments/{namespace}/{name}
/config/configmaps/{namespace}/{name}
/rbac/clusterroles/{name}
```

The URL builder should be configurable to support either pattern.

---

## Recommendation

**Proceed to spec.** The backend and UI component work is complete. This feature requires:

1. **URL builder utility** (Small, well-defined scope)
2. **Router integration** (Depends on portal architecture)
3. **Actor link behavior decision** (Filter vs. navigate)

### Decision Needed Before Spec

The product team should decide on the primary click behavior:

| Option | Pros | Cons |
|--------|------|------|
| **Navigate to resource detail** | Direct, matches user expectation | Leaves activity context |
| **Open resource in panel/modal** | Preserves activity context | More complex UI state |
| **Filter activities by resource** | Stays in activity context | Doesn't show resource current state |

**Recommendation**: Navigate to resource detail for resource links, filter for actor links. This matches common patterns and user mental models.

### Next Steps

1. Product-planner: Create implementation spec with URL builder design
2. Design: Confirm link styling meets accessibility standards
3. Engineering: Implement `onResourceClick` handler in portal application
