import { Button } from './ui/button';
import { cn } from '../lib/utils';

export type ActionOption = 'all' | 'create' | 'update' | 'delete' | 'get' | 'list' | 'watch';

export interface ActionToggleProps {
  /** Current selected value */
  value: ActionOption;
  /** Handler called when selection changes */
  onChange: (value: ActionOption) => void;
  /** Additional CSS class */
  className?: string;
  /** Whether the toggle is disabled */
  disabled?: boolean;
}

/**
 * Options for the action toggle
 */
const OPTIONS: { value: ActionOption; label: string; description: string }[] = [
  {
    value: 'all',
    label: 'All',
    description: 'Show all actions',
  },
  {
    value: 'create',
    label: 'Create',
    description: 'Show only create actions',
  },
  {
    value: 'update',
    label: 'Update',
    description: 'Show update and patch actions',
  },
  {
    value: 'delete',
    label: 'Delete',
    description: 'Show only delete actions',
  },
  {
    value: 'get',
    label: 'Get',
    description: 'Show only get actions',
  },
  {
    value: 'list',
    label: 'List',
    description: 'Show only list actions',
  },
  {
    value: 'watch',
    label: 'Watch',
    description: 'Show only watch actions',
  },
];

/**
 * ActionToggle provides a segmented control for filtering by action/verb
 */
export function ActionToggle({
  value,
  onChange,
  className = '',
  disabled = false,
}: ActionToggleProps) {
  return (
    <div
      className={cn('inline-flex border border-input rounded-md overflow-hidden', className)}
      role="group"
      aria-label="Filter by action"
    >
      {OPTIONS.map((option, index) => (
        <Button
          key={option.value}
          type="button"
          variant="ghost"
          className={cn(
            'rounded-none px-2 h-7 text-xs font-medium transition-all duration-200',
            index < OPTIONS.length - 1 && 'border-r border-input',
            value === option.value
              ? 'bg-[#BF9595] text-[#0C1D31] hover:bg-[#BF9595]/90'
              : 'bg-muted text-foreground hover:bg-muted/80'
          )}
          onClick={() => onChange(option.value)}
          disabled={disabled}
          aria-pressed={value === option.value}
          title={option.description}
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
}
