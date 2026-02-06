import type { ActivityPolicyRule, PolicyPreviewStatus } from '../types/policy';
import { PolicyRuleEditor } from './PolicyRuleEditor';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs';
import { Button } from './ui/button';
import { Badge } from './ui/badge';

export interface PolicyRuleListProps {
  /** Audit rules */
  auditRules: ActivityPolicyRule[];
  /** Event rules */
  eventRules: ActivityPolicyRule[];
  /** Preview result for highlighting matched rule */
  previewResult?: PolicyPreviewStatus | null;
  /** Callback when audit rules change */
  onAuditRulesChange: (rules: ActivityPolicyRule[]) => void;
  /** Callback when event rules change */
  onEventRulesChange: (rules: ActivityPolicyRule[]) => void;
  /** Callback to add a new audit rule */
  onAddAuditRule: () => void;
  /** Callback to add a new event rule */
  onAddEventRule: () => void;
  /** Additional CSS class */
  className?: string;
}

/**
 * PolicyRuleList displays and manages both audit and event rules with tabs
 */
export function PolicyRuleList({
  auditRules,
  eventRules,
  previewResult,
  onAuditRulesChange,
  onEventRulesChange,
  onAddAuditRule,
  onAddEventRule,
  className = '',
}: PolicyRuleListProps) {
  // Determine which rule is highlighted from preview
  const highlightedAuditIndex =
    previewResult?.matched &&
    previewResult.matchedRuleType === 'audit' &&
    previewResult.matchedRuleIndex !== undefined
      ? previewResult.matchedRuleIndex
      : -1;

  const highlightedEventIndex =
    previewResult?.matched &&
    previewResult.matchedRuleType === 'event' &&
    previewResult.matchedRuleIndex !== undefined
      ? previewResult.matchedRuleIndex
      : -1;

  // Handle audit rule changes
  const handleAuditRuleChange = (index: number, rule: ActivityPolicyRule) => {
    const newRules = [...auditRules];
    newRules[index] = rule;
    onAuditRulesChange(newRules);
  };

  const handleAuditRuleDelete = (index: number) => {
    const newRules = auditRules.filter((_, i) => i !== index);
    onAuditRulesChange(newRules);
  };

  // Handle event rule changes
  const handleEventRuleChange = (index: number, rule: ActivityPolicyRule) => {
    const newRules = [...eventRules];
    newRules[index] = rule;
    onEventRulesChange(newRules);
  };

  const handleEventRuleDelete = (index: number) => {
    const newRules = eventRules.filter((_, i) => i !== index);
    onEventRulesChange(newRules);
  };

  return (
    <div className={`bg-muted rounded-lg overflow-hidden ${className}`}>
      <Tabs defaultValue="audit" className="w-full">
        <TabsList className="w-full rounded-none border-b border-input bg-muted h-auto p-0">
          <TabsTrigger
            value="audit"
            className="flex-1 gap-2 py-3 px-4 rounded-none data-[state=active]:bg-background data-[state=active]:border-b-2 data-[state=active]:border-[#BF9595] data-[state=active]:shadow-none"
          >
            Audit Rules
            <Badge
              variant="secondary"
              className="data-[state=active]:bg-[#BF9595] data-[state=active]:text-white"
            >
              {auditRules.length}
            </Badge>
            {highlightedAuditIndex >= 0 && (
              <span className="text-emerald-600 font-bold" title="Rule matched in preview">
                ✓
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger
            value="event"
            className="flex-1 gap-2 py-3 px-4 rounded-none data-[state=active]:bg-background data-[state=active]:border-b-2 data-[state=active]:border-[#BF9595] data-[state=active]:shadow-none"
          >
            Event Rules
            <Badge
              variant="secondary"
              className="data-[state=active]:bg-[#BF9595] data-[state=active]:text-white"
            >
              {eventRules.length}
            </Badge>
            {highlightedEventIndex >= 0 && (
              <span className="text-emerald-600 font-bold" title="Rule matched in preview">
                ✓
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="audit" className="mt-0 p-4 bg-background">
          {auditRules.map((rule, index) => (
            <PolicyRuleEditor
              key={index}
              rule={rule}
              index={index}
              ruleType="audit"
              isHighlighted={index === highlightedAuditIndex}
              onChange={(newRule) => handleAuditRuleChange(index, newRule)}
              onDelete={() => handleAuditRuleDelete(index)}
            />
          ))}
          {auditRules.length === 0 && (
            <div className="text-center py-8 px-8 text-muted-foreground">
              <p className="mb-2">No audit rules defined.</p>
              <p className="text-sm">
                Audit rules match Kubernetes API audit events (create, update, delete, etc.)
                and generate activity summaries.
              </p>
            </div>
          )}
          <Button
            type="button"
            variant="outline"
            className="w-full py-3 mt-4 border-2 border-dashed border-input bg-muted hover:bg-[#EFEFED] hover:border-[#BF9595] hover:text-foreground"
            onClick={onAddAuditRule}
          >
            + Add Audit Rule
          </Button>
        </TabsContent>

        <TabsContent value="event" className="mt-0 p-4 bg-background">
          {eventRules.map((rule, index) => (
            <PolicyRuleEditor
              key={index}
              rule={rule}
              index={index}
              ruleType="event"
              isHighlighted={index === highlightedEventIndex}
              onChange={(newRule) => handleEventRuleChange(index, newRule)}
              onDelete={() => handleEventRuleDelete(index)}
            />
          ))}
          {eventRules.length === 0 && (
            <div className="text-center py-8 px-8 text-muted-foreground">
              <p className="mb-2">No event rules defined.</p>
              <p className="text-sm">
                Event rules match Kubernetes Events (Ready, Failed, Progressing, etc.)
                and generate activity summaries from controller status updates.
              </p>
            </div>
          )}
          <Button
            type="button"
            variant="outline"
            className="w-full py-3 mt-4 border-2 border-dashed border-input bg-muted hover:bg-[#EFEFED] hover:border-[#BF9595] hover:text-foreground"
            onClick={onAddEventRule}
          >
            + Add Event Rule
          </Button>
        </TabsContent>
      </Tabs>
    </div>
  );
}
