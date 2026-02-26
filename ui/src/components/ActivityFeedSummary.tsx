import type { ActivityLink, ResourceRef, ResourceLinkResolver, ResourceLinkContext } from '../types/activity';

export interface ResourceLinkClickHandler {
  (resource: ResourceRef): void;
}

export interface ActivityFeedSummaryProps {
  /** The summary text to render */
  summary: string;
  /** Links within the summary to make clickable */
  links?: ActivityLink[];
  /** Handler called when a resource link is clicked (deprecated: use resourceLinkResolver) */
  onResourceClick?: ResourceLinkClickHandler;
  /** Function that resolves resource references to URLs (renders as <a> tags) */
  resourceLinkResolver?: ResourceLinkResolver;
  /** Context for resolving resource links (includes tenant information) */
  resourceLinkContext?: ResourceLinkContext;
  /** Additional CSS class */
  className?: string;
}

/**
 * Parse summary text and replace marker strings with clickable links
 */
function parseSummaryWithLinks(
  summary: string,
  links: ActivityLink[] | undefined,
  onResourceClick?: ResourceLinkClickHandler,
  resourceLinkResolver?: ResourceLinkResolver,
  resourceLinkContext?: ResourceLinkContext
): (string | JSX.Element)[] {
  if (!links || links.length === 0) {
    return [summary];
  }

  // Sort links by marker length (longest first) to avoid partial matches
  const sortedLinks = [...links].sort((a, b) => b.marker.length - a.marker.length);

  // Track positions that have been replaced
  interface ReplacedRange {
    start: number;
    end: number;
    link: ActivityLink;
  }

  const replacedRanges: ReplacedRange[] = [];

  // Find all marker positions
  for (const link of sortedLinks) {
    let searchStart = 0;
    let pos = summary.indexOf(link.marker, searchStart);

    while (pos !== -1) {
      const end = pos + link.marker.length;

      // Check if this range overlaps with any existing range
      const overlaps = replacedRanges.some(
        (range) => pos < range.end && end > range.start
      );

      if (!overlaps) {
        replacedRanges.push({ start: pos, end, link });
      }

      searchStart = pos + 1;
      pos = summary.indexOf(link.marker, searchStart);
    }
  }

  // Sort ranges by start position
  replacedRanges.sort((a, b) => a.start - b.start);

  // Build the result array
  const result: (string | JSX.Element)[] = [];
  let lastEnd = 0;

  for (let i = 0; i < replacedRanges.length; i++) {
    const range = replacedRanges[i];

    // Add text before this marker
    if (range.start > lastEnd) {
      result.push(summary.substring(lastEnd, range.start));
    }

    // If resourceLinkResolver is provided, render as <a> tag
    if (resourceLinkResolver) {
      const url = resourceLinkResolver(range.link.resource, resourceLinkContext);
      if (url) {
        result.push(
          <a
            key={`link-${i}`}
            href={url}
            className="underline underline-offset-2 text-primary hover:text-primary/80"
            title={`${range.link.resource.kind}: ${range.link.resource.name}`}
            onClick={(e) => e.stopPropagation()}
          >
            {range.link.marker}
          </a>
        );
      } else {
        // Resolver returned undefined, render as plain text
        result.push(range.link.marker);
      }
    } else {
      // Fallback to button with onResourceClick handler for backward compatibility
      const handleClick = onResourceClick
        ? (e: React.MouseEvent) => {
            e.preventDefault();
            e.stopPropagation();
            onResourceClick(range.link.resource);
          }
        : undefined;

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
    }

    lastEnd = range.end;
  }

  // Add any remaining text
  if (lastEnd < summary.length) {
    result.push(summary.substring(lastEnd));
  }

  return result;
}

/**
 * ActivityFeedSummary renders an activity summary with clickable resource links
 */
export function ActivityFeedSummary({
  summary,
  links,
  onResourceClick,
  resourceLinkResolver,
  resourceLinkContext,
  className = '',
}: ActivityFeedSummaryProps) {
  const parsedContent = parseSummaryWithLinks(summary, links, onResourceClick, resourceLinkResolver, resourceLinkContext);

  return (
    <span className={`text-[0.9375rem] text-foreground leading-normal break-words ${className}`}>
      {parsedContent}
    </span>
  );
}
