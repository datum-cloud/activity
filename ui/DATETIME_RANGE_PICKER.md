# DateTimeRangePicker Component

The `DateTimeRangePicker` component provides an intuitive interface for selecting time ranges for audit log queries. It supports both preset ranges and custom date/time selection.

## Features

- **Preset Ranges**: Quick selection of common time ranges
  - Last 15 minutes
  - Last 1 hour
  - Last 6 hours
  - Last 24 hours
  - Last 7 days
  - Last 30 days
  - Today
  - Custom range

- **Custom Range**: Manual selection of start and end times using datetime-local inputs
- **Automatic Integration**: Works seamlessly with the `SimpleQueryBuilder` component
- **Type-Safe**: Full TypeScript support with exported types

## Integration

The `DateTimeRangePicker` is now automatically integrated into the `SimpleQueryBuilder` component. When users select a time range, it:

1. Updates the internal state
2. Automatically adds timestamp filters to the CEL query
3. Includes `startTime` and `endTime` in the `AuditLogQuerySpec`

### Example CEL Filter Generation

When a user selects "Last 24 hours" and adds a filter for `verb == "delete"`, the generated CEL filter will be:

```cel
verb == "delete" && stageTimestamp >= timestamp("2024-12-10T13:00:00.000Z") && stageTimestamp <= timestamp("2024-12-11T13:00:00.000Z")
```

The `startTime` and `endTime` are also included in the query spec for API consumption.

## Usage as Standalone Component

You can also use the `DateTimeRangePicker` as a standalone component:

```tsx
import { DateTimeRangePicker, type DateTimeRange } from '@miloapis/activity-ui';
import '@miloapis/activity-ui/dist/datetime-range-picker-styles.css';

function MyComponent() {
  const handleTimeRangeChange = (range: DateTimeRange) => {
    console.log('Start:', range.start);
    console.log('End:', range.end);
    // Both are ISO 8601 strings
  };

  return (
    <DateTimeRangePicker onChange={handleTimeRangeChange} />
  );
}
```

## CSS Styling

The component comes with pre-built styles in `datetime-range-picker-styles.css`. The styles include:

- Light mode default theme
- Dark mode support (via `prefers-color-scheme`)
- Responsive design for mobile devices
- Accessible focus states and button interactions

### Custom Styling

You can override the default styles by targeting these CSS classes:

- `.datetime-range-picker` - Main container
- `.preset-buttons` - Container for preset buttons
- `.preset-button` - Individual preset button
- `.preset-button.active` - Active preset button
- `.custom-range-inputs` - Container for custom datetime inputs
- `.datetime-input` - Individual datetime input field
- `.apply-custom-button` - Apply custom range button

## API Changes

The `AuditLogQuerySpec` type has been updated to include optional `startTime` and `endTime` fields:

```typescript
export interface AuditLogQuerySpec {
  filter?: string;
  limit?: number;
  continueAfter?: string;
  startTime?: string;  // ISO 8601 timestamp
  endTime?: string;    // ISO 8601 timestamp
}
```

These fields are now **required** by the Activity backend when creating queries.

## Technical Details

- Built with React hooks (`useState`, `useEffect`)
- Uses `date-fns` for date manipulation and formatting
- Fully typed with TypeScript
- Generates ISO 8601 timestamps compatible with CEL's `timestamp()` function
- Auto-applies default time range (Last 24 hours) on mount
