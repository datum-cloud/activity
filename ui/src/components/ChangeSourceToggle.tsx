import type { ChangeSource } from '../types/activity';
import { Button } from './ui/button';
import { cn } from '../lib/utils';

export type ChangeSourceOption = ChangeSource | 'all';

export interface ChangeSourceToggleProps {
  /** Current selected value */
  value: ChangeSourceOption;
  /** Handler called when selection changes */
  onChange: (value: ChangeSourceOption) => void;
  /** Additional CSS class */
  className?: string;
  /** Whether the toggle is disabled */
  disabled?: boolean;
}

/**
 * Options for the change source toggle
 */
const OPTIONS: { value: ChangeSourceOption; label: string; description: string }[] = [
  {
    value: 'all',
    label: 'All',
    description: 'Show all activities',
  },
  {
    value: 'human',
    label: 'Human',
    description: 'Show only human-initiated activities',
  },
  {
    value: 'system',
    label: 'System',
    description: 'Show only system-initiated activities',
  },
];

/**
 * ChangeSourceToggle provides a segmented control for filtering by change source
 */
export function ChangeSourceToggle({
  value,
  onChange,
  className = '',
  disabled = false,
}: ChangeSourceToggleProps) {
  return (
    <div
      className={cn('inline-flex border border-input rounded-md overflow-hidden', className)}
      role="group"
      aria-label="Filter by change source"
    >
      {OPTIONS.map((option, index) => (
        <Button
          key={option.value}
          type="button"
          variant="ghost"
          className={cn(
            'rounded-none px-3 py-1 text-xs font-medium transition-all duration-200',
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
