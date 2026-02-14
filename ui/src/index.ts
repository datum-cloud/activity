// Components - Audit Log Query (existing)
export { FilterBuilder } from './components/FilterBuilder';
export { FilterBuilderWithAutocomplete } from './components/FilterBuilderWithAutocomplete';
export { SimpleQueryBuilder } from './components/SimpleQueryBuilder';
export { AuditEventViewer } from './components/AuditEventViewer';
export { AuditLogQueryComponent } from './components/AuditLogQueryComponent';
export { DateTimeRangePicker } from './components/DateTimeRangePicker';
export type { DateTimeRange, DateTimeRangePickerProps } from './components/DateTimeRangePicker';

// Components - Activity Feed (new)
export { ActivityFeed } from './components/ActivityFeed';
export type { ActivityFeedProps } from './components/ActivityFeed';
export { ActivityFeedItem } from './components/ActivityFeedItem';
export type { ActivityFeedItemProps } from './components/ActivityFeedItem';
export { ActivityFeedSummary } from './components/ActivityFeedSummary';
export type { ActivityFeedSummaryProps, ResourceLinkClickHandler } from './components/ActivityFeedSummary';
export { ActivityFeedFilters } from './components/ActivityFeedFilters';
export type { ActivityFeedFiltersProps } from './components/ActivityFeedFilters';
export { ChangeSourceToggle } from './components/ChangeSourceToggle';
export type { ChangeSourceToggleProps, ChangeSourceOption } from './components/ChangeSourceToggle';
export { ResourceHistoryView } from './components/ResourceHistoryView';
export type { ResourceHistoryViewProps, ResourceFilter } from './components/ResourceHistoryView';
export { ActivityExpandedDetails } from './components/ActivityExpandedDetails';
export type { ActivityExpandedDetailsProps } from './components/ActivityExpandedDetails';

// Components - Policy Authoring (new)
export { PolicyList } from './components/PolicyList';
export type { PolicyListProps } from './components/PolicyList';
export { PolicyEditor } from './components/PolicyEditor';
export type { PolicyEditorProps } from './components/PolicyEditor';
export { PolicyPreviewPanel } from './components/PolicyPreviewPanel';
export type { PolicyPreviewPanelProps } from './components/PolicyPreviewPanel';
export { PolicyPreviewResult } from './components/PolicyPreviewResult';
export type { PolicyPreviewResultProps } from './components/PolicyPreviewResult';
export { PolicyRuleList } from './components/PolicyRuleList';
export type { PolicyRuleListProps } from './components/PolicyRuleList';
export { PolicyRuleEditor } from './components/PolicyRuleEditor';
export type { PolicyRuleEditorProps } from './components/PolicyRuleEditor';
export { PolicyResourceForm } from './components/PolicyResourceForm';
export type { PolicyResourceFormProps } from './components/PolicyResourceForm';
export { SampleInputTemplates, AUDIT_TEMPLATES, EVENT_TEMPLATES } from './components/SampleInputTemplates';
export type { SampleInputTemplatesProps } from './components/SampleInputTemplates';

// UI Components (shadcn/ui based)
export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
} from './components/ui/select';

export { Button, buttonVariants } from './components/ui/button';
export type { ButtonProps } from './components/ui/button';

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
} from './components/ui/card';

export { Badge, badgeVariants } from './components/ui/badge';
export type { BadgeProps } from './components/ui/badge';

export { Alert, AlertTitle, AlertDescription } from './components/ui/alert';

export { Checkbox } from './components/ui/checkbox';

export { Textarea } from './components/ui/textarea';
export type { TextareaProps } from './components/ui/textarea';

export { Input } from './components/ui/input';
export type { InputProps } from './components/ui/input';

export { Label } from './components/ui/label';
export type { LabelProps } from './components/ui/label';

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from './components/ui/dialog';

export { Tabs, TabsList, TabsTrigger, TabsContent } from './components/ui/tabs';

export { Separator } from './components/ui/separator';

export { Combobox } from './components/ui/combobox';
export type { ComboboxProps, ComboboxOption } from './components/ui/combobox';

export { MultiCombobox } from './components/ui/multi-combobox';
export type { MultiComboboxProps, MultiComboboxOption } from './components/ui/multi-combobox';

export { TimeRangeDropdown } from './components/ui/time-range-dropdown';
export type { TimeRangeDropdownProps, TimeRangePreset } from './components/ui/time-range-dropdown';

// Utilities
export { cn } from './lib/utils';

// Hooks - Audit Log Query (existing)
export { useAuditLogQuery } from './hooks/useAuditLogQuery';
export { useAuditLogFacets } from './hooks/useAuditLogFacets';
export type {
  UseAuditLogFacetsResult,
  AuditLogTimeRange,
} from './hooks/useAuditLogFacets';

// Hooks - Activity Feed (new)
export { useActivityFeed } from './hooks/useActivityFeed';
export type {
  UseActivityFeedOptions,
  UseActivityFeedResult,
  ActivityFeedFilters as ActivityFeedFilterState,
  TimeRange,
} from './hooks/useActivityFeed';
export { useFacets } from './hooks/useFacets';
export type { UseFacetsResult } from './hooks/useFacets';

// Hooks - Policy Authoring (new)
export { usePolicyList } from './hooks/usePolicyList';
export type {
  UsePolicyListOptions,
  UsePolicyListResult,
} from './hooks/usePolicyList';
export { usePolicyEditor } from './hooks/usePolicyEditor';
export type {
  UsePolicyEditorOptions,
  UsePolicyEditorResult,
} from './hooks/usePolicyEditor';
export { usePolicyPreview } from './hooks/usePolicyPreview';
export type {
  UsePolicyPreviewOptions,
  UsePolicyPreviewResult,
} from './hooks/usePolicyPreview';

// API Client
export { ActivityApiClient } from './api/client';
export type { ApiClientConfig } from './api/client';

// Types - Audit Log (existing)
export type {
  Event,
  ObjectReference,
  UserInfo,
  QueryPhase,
  AuditLogQuerySpec,
  AuditLogQueryStatus,
  AuditLogQuery,
  AuditLog,
  FilterField,
} from './types';

export { FILTER_FIELDS } from './types';

// Types - Activity (new)
export type {
  Activity,
  ActivitySpec,
  ActivityList,
  ActivityListParams,
  ActivityLink,
  ResourceRef,
  Actor,
  ActorType,
  ChangeSource,
  OriginType,
  TenantType,
  Tenant,
  FieldChange,
  ActivityOrigin,
  ActivityFacetQuery,
  ActivityFacetQuerySpec,
  ActivityFacetQueryStatus,
  FacetSpec,
  FacetResult,
  FacetValue,
  ActivityFilterField,
  WatchEvent,
  WatchEventType,
  WatchErrorStatus,
} from './types/activity';

export { ACTIVITY_FILTER_FIELDS } from './types/activity';

// Types - Policy Authoring (new)
export type {
  ActivityPolicy,
  ActivityPolicySpec,
  ActivityPolicyStatus,
  ActivityPolicyRule,
  ActivityPolicyResource,
  ActivityPolicyList,
  Condition,
  PolicyPreview,
  PolicyPreviewSpec,
  PolicyPreviewInput,
  PolicyPreviewInputType,
  PolicyPreviewStatus,
  PolicyPreviewPolicySpec,
  KubernetesEvent,
  PolicyGroup,
  SampleInputTemplate,
  PolicyFilterField,
} from './types/policy';

export { POLICY_FILTER_FIELDS } from './types/policy';
