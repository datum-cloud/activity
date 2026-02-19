# Technical Design: feat-002-activity-links-ui

## Handoff

- **From**: Plan agent
- **To**: frontend-dev
- **Status**: Implementation ready (minimal changes needed)

---

## Current Implementation Analysis

**File**: `ui/src/components/ActivityFeedSummary.tsx`

The link rendering is **already implemented** at lines 88-98:

```tsx
result.push(
  <button
    key={`link-${i}`}
    type="button"
    className="bg-transparent border-none p-0 cursor-pointer underline underline-offset-2 text-primary hover:text-primary/80"
    onClick={handleClick}
    title={`${range.link.resource.kind}: ${range.link.resource.name}`}
  >
    {range.link.marker}
  </button>
);
```

---

## Accessibility Gaps Identified

| Gap | WCAG | Issue |
|-----|------|-------|
| Missing focus ring | 2.4.7 | No `focus-visible` styles present |
| Missing aria-label | 4.1.2 | Screen readers only have `title`, not consistently announced |
| No rounded corners | N/A | Focus ring looks square without `rounded-sm` |

---

## Design System Pattern

Standard focus ring pattern from `ui/src/components/ui/button.tsx`:

```
focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
```

---

## Required Changes

### Before (lines 88-98):
```tsx
result.push(
  <button
    key={`link-${i}`}
    type="button"
    className="bg-transparent border-none p-0 cursor-pointer underline underline-offset-2 text-primary hover:text-primary/80"
    onClick={handleClick}
    title={`${range.link.resource.kind}: ${range.link.resource.name}`}
  >
    {range.link.marker}
  </button>
);
```

### After:
```tsx
result.push(
  <button
    key={`link-${i}`}
    type="button"
    className="bg-transparent border-none p-0 cursor-pointer underline underline-offset-2 text-primary hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 rounded-sm"
    onClick={handleClick}
    title={`${range.link.resource.kind}: ${range.link.resource.name}`}
    aria-label={`View ${range.link.resource.kind} ${range.link.resource.name}${range.link.resource.namespace ? ` in namespace ${range.link.resource.namespace}` : ''}`}
  >
    {range.link.marker}
  </button>
);
```

### Changes Explained

| Change | Rationale |
|--------|-----------|
| `focus-visible:outline-none` | Removes default browser outline |
| `focus-visible:ring-2` | Adds 2px focus ring (standard) |
| `focus-visible:ring-ring` | Uses design system ring color |
| `focus-visible:ring-offset-1` | Adds 1px offset (reduced for inline text) |
| `rounded-sm` | Rounds corners for focus ring appearance |
| `aria-label` | Provides full context for screen readers |

---

## Test Cases

### Unit Tests

1. `parseSummaryWithLinks returns plain text for undefined links`
2. `parseSummaryWithLinks returns plain text for empty links array`
3. `parseSummaryWithLinks handles single link correctly`
4. `parseSummaryWithLinks handles multiple non-overlapping links`
5. `parseSummaryWithLinks handles overlapping links (longer wins)`
6. `parseSummaryWithLinks handles duplicate markers`
7. `Click handler is called with correct ResourceRef`
8. `Click events do not propagate to parent`
9. `Links have accessible names (aria-label)`
10. `Links have visible focus indicators`

### Accessibility Tests (Manual)

1. Links are keyboard navigable (Tab key)
2. Focus ring is visible when focused via keyboard
3. Screen reader announces link purpose

---

## Work Breakdown

### frontend-dev Tasks

| Task | File | Estimate |
|------|------|----------|
| 1. Add focus ring + aria-label | `ui/src/components/ActivityFeedSummary.tsx` | 30 min |
| 2. Manual accessibility testing | N/A (VoiceOver, keyboard) | 30 min |

**Total Estimate**: ~1 hour

### Optional (v2)

| Task | File | Estimate |
|------|------|----------|
| Add test framework | `ui/package.json`, `ui/vitest.config.ts` | 30 min |
| Create test file | `ui/src/components/ActivityFeedSummary.test.tsx` | 2 hours |

---

## References

- Spec: `.claude/pipeline/specs/feat-002-activity-links-ui.md`
- Brief: `.claude/pipeline/briefs/feat-002-activity-links-ui.md`
- Design system button: `ui/src/components/ui/button.tsx`
