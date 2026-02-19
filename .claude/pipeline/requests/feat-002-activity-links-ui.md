# Feature Request: feat-002-activity-links-ui

## Summary

Implement clickable resource links in Activity summaries. The backend already provides `spec.links` with marker text and resource references, but the UI renders summaries as plain text without actionable links.

## Context

The `link()` CEL function in ActivityPolicy rules generates clickable references in activity summaries. For example:

```yaml
summary: "{{ link(actor, actorRef) }} deployed {{ link(audit.objectRef.name, audit.objectRef) }}"
```

This produces an activity with:
```json
{
  "spec": {
    "summary": "kubernetes-admin deployed api-gateway",
    "links": [
      {
        "marker": "kubernetes-admin",
        "resource": {"kind": "User", "name": "kubernetes-admin"}
      },
      {
        "marker": "api-gateway",
        "resource": {"apiGroup": "apps", "kind": "Deployment", "name": "api-gateway", "namespace": "default"}
      }
    ]
  }
}
```

The backend correctly generates these links, but the UI (`ActivityFeedSummary` component) renders the summary as plain text without making the markers clickable.

## Current Behavior

- Activity summaries display as plain text
- Only the top-level resource (from `spec.resource`) is clickable
- Inline references to actors, related resources, and other objects are not interactive
- Users cannot navigate directly to linked resources

## Requested Outcome

- Parse `activity.spec.links` array when rendering summaries
- Identify link markers within the summary text
- Replace markers with clickable elements (styled distinctly)
- On click, either:
  - Navigate to resource detail view, OR
  - Filter activities by the linked resource, OR
  - Open resource in a modal/panel
- Support all resource types (User, ServiceAccount, Deployment, Pod, etc.)
- Handle edge cases (missing links array, markers not found in text)

## Affected Components

- `ui/src/components/ActivityFeedSummary.tsx` - Main component to modify
- `ui/src/components/ActivityFeedItem.tsx` - May need click handler updates
- `ui/src/types/activity.ts` - Verify ActivityLink type is complete

## Backend Support

The backend fully supports this feature:
- `spec.links` field is populated by the activity processor
- `ActivityLink` type defined in `pkg/apis/activity/v1alpha1/types_activity.go`
- Link data includes: marker (string), resource (apiGroup, kind, name, namespace)

## Design Considerations

1. **Link Styling**: How should links appear? Underlined, colored, with icons?
2. **Click Behavior**: Navigate away, filter in place, or open panel?
3. **Resource Resolution**: Should we show resource status/existence?
4. **Accessibility**: Keyboard navigation, screen reader support

## Priority

HIGH - This is a core UX improvement that makes the Activity feed significantly more useful for navigation and investigation workflows.

## Effort Estimate

Medium - Primarily frontend work in a single component, but needs careful handling of text parsing and click behaviors.
