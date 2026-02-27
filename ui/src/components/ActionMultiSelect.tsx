import { MultiCombobox, type MultiComboboxOption } from './ui/multi-combobox';
import { cn } from '../lib/utils';

export interface ActionMultiSelectProps {
  /** Current selected verbs */
  value: string[];
  /** Handler called when selection changes */
  onChange: (verbs: string[]) => void;
  /** Additional CSS class */
  className?: string;
  /** Whether the select is disabled */
  disabled?: boolean;
  /** Available verb options with counts */
  options: MultiComboboxOption[];
  /** Whether facets are still loading */
  isLoading?: boolean;
}

/**
 * ActionMultiSelect provides a multi-select dropdown for filtering by action/verb.
 * Supports multiple verb selection and displays counts from facet queries.
 */
export function ActionMultiSelect({
  value,
  onChange,
  className = '',
  disabled = false,
  options,
  isLoading = false,
}: ActionMultiSelectProps) {
  const displayPlaceholder = value.length === 0
    ? 'All actions'
    : `${value.length} action${value.length === 1 ? '' : 's'}`;

  return (
    <MultiCombobox
      options={options}
      values={value}
      onValuesChange={onChange}
      placeholder={displayPlaceholder}
      searchPlaceholder="Search actions..."
      emptyMessage="No actions found."
      disabled={disabled}
      loading={isLoading}
      className={cn('h-7 text-xs py-0', className)}
      maxDisplayed={3}
    />
  );
}
