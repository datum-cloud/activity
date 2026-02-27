import * as React from 'react';
import { Check, ChevronsUpDown, X } from 'lucide-react';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from 'cmdk';
import * as Popover from '@radix-ui/react-popover';
import { cn } from '../../lib/utils';

export interface MultiComboboxOption {
  value: string;
  label: string;
  count?: number;
}

export interface MultiComboboxProps {
  options: MultiComboboxOption[];
  values: string[];
  onValuesChange: (values: string[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
  /** Maximum number of selections to show in the trigger before collapsing */
  maxDisplayed?: number;
}

/**
 * Multi-select combobox component with type-ahead search and fuzzy matching.
 * Built on cmdk for search functionality and Radix Popover for positioning.
 */
export function MultiCombobox({
  options,
  values,
  onValuesChange,
  placeholder = 'Select...',
  searchPlaceholder = 'Search...',
  emptyMessage = 'No results found.',
  disabled = false,
  loading = false,
  className,
  maxDisplayed = 2,
}: MultiComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');

  // Find selected options for display
  const selectedOptions = options.filter((opt) => values.includes(opt.value));

  const displayValue = React.useMemo(() => {
    if (loading) return 'Loading...';
    if (selectedOptions.length === 0) return placeholder;
    if (selectedOptions.length <= maxDisplayed) {
      return selectedOptions.map((opt) => opt.label).join(', ');
    }
    return `${selectedOptions.slice(0, maxDisplayed).map((opt) => opt.label).join(', ')} +${selectedOptions.length - maxDisplayed} more`;
  }, [loading, selectedOptions, placeholder, maxDisplayed]);

  const handleSelect = React.useCallback(
    (selectedValue: string) => {
      if (values.includes(selectedValue)) {
        // Remove from selection
        onValuesChange(values.filter((v) => v !== selectedValue));
      } else {
        // Add to selection
        onValuesChange([...values, selectedValue]);
      }
    },
    [onValuesChange, values]
  );

  const handleClear = React.useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onValuesChange([]);
    },
    [onValuesChange]
  );

  const handleRemove = React.useCallback(
    (e: React.MouseEvent, valueToRemove: string) => {
      e.stopPropagation();
      onValuesChange(values.filter((v) => v !== valueToRemove));
    },
    [onValuesChange, values]
  );

  // Custom fuzzy filter function
  const filterOptions = React.useCallback(
    (optionValue: string, searchQuery: string): number => {
      if (!searchQuery) return 1;

      const option = options.find((o) => o.value === optionValue);
      const label = option?.label || optionValue;
      const lowerLabel = label.toLowerCase();
      const lowerSearch = searchQuery.toLowerCase();

      // Exact match
      if (lowerLabel === lowerSearch) return 1;

      // Starts with
      if (lowerLabel.startsWith(lowerSearch)) return 0.9;

      // Contains
      if (lowerLabel.includes(lowerSearch)) return 0.8;

      // Fuzzy match - check if all search chars appear in order
      let searchIdx = 0;
      for (let i = 0; i < lowerLabel.length && searchIdx < lowerSearch.length; i++) {
        if (lowerLabel[i] === lowerSearch[searchIdx]) {
          searchIdx++;
        }
      }
      if (searchIdx === lowerSearch.length) return 0.6;

      return 0;
    },
    [options]
  );

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-haspopup="listbox"
          disabled={disabled || loading}
          className={cn(
            'flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background',
            'placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
            'disabled:cursor-not-allowed disabled:opacity-50',
            'whitespace-nowrap',
            className
          )}
        >
          <span className="truncate text-left flex-1">
            {displayValue}
          </span>
          <div className="flex items-center gap-1 ml-2">
            {values.length > 0 && !disabled && (
              <span
                role="button"
                tabIndex={0}
                onClick={handleClear}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    handleClear(e as unknown as React.MouseEvent);
                  }
                }}
                className="rounded-sm opacity-50 hover:opacity-100 cursor-pointer"
              >
                <X className="h-3 w-3" />
              </span>
            )}
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
          </div>
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className={cn(
            'z-50 min-w-[var(--radix-popover-trigger-width)] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
            'data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2'
          )}
          sideOffset={4}
          align="start"
        >
          <Command
            filter={filterOptions}
            className="w-full"
          >
            <div className="flex items-center border-b px-3">
              <CommandInput
                placeholder={searchPlaceholder}
                value={search}
                onValueChange={setSearch}
                className="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
            {/* Selected items chips */}
            {values.length > 0 && (
              <div className="flex flex-wrap gap-1 p-2 border-b">
                {selectedOptions.map((option) => (
                  <span
                    key={option.value}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-secondary text-secondary-foreground text-xs"
                  >
                    {option.label}
                    <button
                      type="button"
                      onClick={(e) => handleRemove(e, option.value)}
                      className="rounded-sm hover:bg-secondary-foreground/20"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <CommandList className="max-h-[300px] overflow-y-auto p-1">
              <CommandEmpty className="py-6 text-center text-sm text-muted-foreground">
                {emptyMessage}
              </CommandEmpty>
              <CommandGroup>
                {options.map((option) => (
                  <CommandItem
                    key={option.value}
                    value={option.value}
                    onSelect={() => handleSelect(option.value)}
                    className={cn(
                      'relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none',
                      'data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground',
                      'hover:bg-accent hover:text-accent-foreground'
                    )}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        values.includes(option.value) ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    <span className="flex-1 truncate">{option.label}</span>
                    {option.count !== undefined && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        ({option.count})
                      </span>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
