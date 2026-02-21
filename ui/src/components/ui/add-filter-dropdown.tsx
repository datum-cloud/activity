import * as React from 'react';
import { Plus } from 'lucide-react';
import * as Popover from '@radix-ui/react-popover';
import { cn } from '../../lib/utils';

export interface FilterOption {
  id: string;
  label: string;
  icon?: React.ReactNode;
}

export interface AddFilterDropdownProps {
  /** Available filter types that can be added */
  availableFilters: FilterOption[];
  /** IDs of filters that are already active */
  activeFilterIds: string[];
  /** Handler called when a filter is selected */
  onAddFilter: (filterId: string) => void;
  /** Whether any filters are currently active */
  hasActiveFilters?: boolean;
  /** Whether the dropdown is disabled */
  disabled?: boolean;
  /** Additional class name */
  className?: string;
}

/**
 * AddFilterDropdown - Shows "+ Add Filters" button that opens a dropdown of available filters
 * Already-active filters are dimmed/disabled in the list
 */
export function AddFilterDropdown({
  availableFilters,
  activeFilterIds,
  onAddFilter,
  hasActiveFilters = false,
  disabled = false,
  className,
}: AddFilterDropdownProps) {
  const [open, setOpen] = React.useState(false);

  const handleFilterClick = React.useCallback(
    (filterId: string) => {
      onAddFilter(filterId);
      setOpen(false);
    },
    [onAddFilter]
  );

  // Determine if a filter is active
  const isFilterActive = (filterId: string) => activeFilterIds.includes(filterId);

  // Get button label
  const buttonLabel = hasActiveFilters ? '+ Filters' : '+ Add Filters';

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            'flex h-10 items-center gap-1.5 rounded-md border border-dashed border-border bg-background px-3 text-sm',
            'text-muted-foreground hover:text-foreground hover:border-foreground/50 transition-colors',
            'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
            'disabled:cursor-not-allowed disabled:opacity-50',
            className
          )}
        >
          <Plus className="h-4 w-4" />
          <span className="font-medium">{buttonLabel}</span>
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className={cn(
            'z-50 min-w-[180px] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
            'data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2'
          )}
          sideOffset={4}
          align="start"
        >
          <div className="p-1">
            {availableFilters.map((filter) => {
              const active = isFilterActive(filter.id);
              return (
                <button
                  key={filter.id}
                  type="button"
                  onClick={() => !active && handleFilterClick(filter.id)}
                  disabled={active}
                  className={cn(
                    'relative flex w-full items-center gap-2 rounded-sm px-3 py-2 text-sm outline-none transition-colors',
                    active
                      ? 'cursor-not-allowed opacity-40'
                      : 'cursor-pointer hover:bg-accent hover:text-accent-foreground'
                  )}
                >
                  {filter.icon && <span className="text-muted-foreground">{filter.icon}</span>}
                  <span>{filter.label}</span>
                  {active && (
                    <span className="ml-auto text-xs text-muted-foreground">(active)</span>
                  )}
                </button>
              );
            })}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
