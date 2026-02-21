import { Button } from './ui/button';
import { cn } from '../lib/utils';
import type { K8sEventType } from '../types/k8s-event';

export type EventTypeOption = K8sEventType | 'all';

export interface EventTypeToggleProps {
  /** Current selected value */
  value: EventTypeOption;
  /** Handler called when selection changes */
  onChange: (value: EventTypeOption) => void;
  /** Additional CSS class */
  className?: string;
  /** Whether the toggle is disabled */
  disabled?: boolean;
}

/**
 * Options for the event type toggle
 */
const OPTIONS: { value: EventTypeOption; label: string; description: string }[] = [
  {
    value: 'all',
    label: 'All',
    description: 'Show all events',
  },
  {
    value: 'Normal',
    label: 'Normal',
    description: 'Show only normal events',
  },
  {
    value: 'Warning',
    label: 'Warning',
    description: 'Show only warning events',
  },
];

/**
 * EventTypeToggle provides a segmented control for filtering by event type
 */
export function EventTypeToggle({
  value,
  onChange,
  className = '',
  disabled = false,
}: EventTypeToggleProps) {
  return (
    <div
      className={cn('inline-flex border border-input rounded-md overflow-hidden', className)}
      role="group"
      aria-label="Filter by event type"
    >
      {OPTIONS.map((option, index) => (
        <Button
          key={option.value}
          type="button"
          variant="ghost"
          className={cn(
            'rounded-none px-4 py-2 text-sm font-medium transition-all duration-200',
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
