import { useEffect, useCallback } from 'react';
import type { PolicyPreviewPolicySpec } from '../types/policy';
import type { ResourceRef } from '../types/activity';
import { ActivityApiClient } from '../api/client';
import { usePolicyEditor, type UsePolicyEditorResult } from '../hooks/usePolicyEditor';
import { usePolicyPreview, type UsePolicyPreviewResult } from '../hooks/usePolicyPreview';
import { PolicyResourceForm } from './PolicyResourceForm';
import { PolicyRuleList } from './PolicyRuleList';
import { PolicyPreviewPanel } from './PolicyPreviewPanel';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Card, CardHeader, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Label } from './ui/label';
import { ApiErrorAlert } from './ApiErrorAlert';

export interface PolicyEditorProps {
  /** API client instance */
  client: ActivityApiClient;
  /** Policy name to edit (undefined for new policy) */
  policyName?: string;
  /** Callback when save succeeds */
  onSaveSuccess?: (policyName: string) => void;
  /** Callback when cancel is clicked */
  onCancel?: () => void;
  /** Handler for resource link clicks in preview */
  onResourceClick?: (resource: ResourceRef) => void;
  /** Additional CSS class */
  className?: string;
}

/**
 * PolicyEditor provides a full editor for creating/editing ActivityPolicies
 * with a preview panel for testing
 */
export function PolicyEditor({
  client,
  policyName,
  onSaveSuccess,
  onCancel,
  onResourceClick,
  className = '',
}: PolicyEditorProps) {
  // Editor state
  const editor: UsePolicyEditorResult = usePolicyEditor({
    client,
    initialPolicyName: policyName,
  });

  // Preview state
  const preview: UsePolicyPreviewResult = usePolicyPreview({ client });

  // Load existing policy on mount
  useEffect(() => {
    if (policyName) {
      editor.load(policyName).catch((err) => {
        console.error('Failed to load policy:', err);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [policyName]);

  // Handle save
  const handleSave = useCallback(
    async (dryRun: boolean = false) => {
      try {
        const result = await editor.save(dryRun);
        if (!dryRun && onSaveSuccess && result.metadata?.name) {
          onSaveSuccess(result.metadata.name);
        }
      } catch (err) {
        // Error is stored in editor.error
        console.error('Save failed:', err);
      }
    },
    [editor, onSaveSuccess]
  );

  // Handle preview
  const handleRunPreview = useCallback(() => {
    const policySpec: PolicyPreviewPolicySpec = {
      resource: editor.spec.resource,
      auditRules: editor.spec.auditRules,
      eventRules: editor.spec.eventRules,
    };

    // Derive kind labels
    const kindLabel =
      editor.spec.resource.kindLabel ||
      deriveKindLabel(editor.spec.resource.kind);
    const kindLabelPlural =
      editor.spec.resource.kindLabelPlural ||
      derivePluralLabel(kindLabel);

    preview.runPreview(policySpec, kindLabel, kindLabelPlural).catch((err) => {
      console.error('Preview failed:', err);
    });
  }, [editor.spec, preview]);

  // Validation
  const canSave =
    editor.name.trim() !== '' &&
    editor.spec.resource.apiGroup.trim() !== '' &&
    editor.spec.resource.kind.trim() !== '';

  return (
    <Card className={`rounded-xl ${className}`}>
      {/* Header */}
      <CardHeader className="flex flex-row justify-between items-center p-6 border-b border-border space-y-0">
        <div className="flex items-center gap-4">
          {editor.isNew ? (
            <div className="flex flex-col gap-1">
              <Label htmlFor="policy-name" className="text-xs text-muted-foreground">
                Policy Name
              </Label>
              <Input
                id="policy-name"
                type="text"
                className="w-[300px] text-base font-medium"
                value={editor.name}
                onChange={(e) => editor.setName(e.target.value)}
                placeholder="e.g., httpproxy-policy"
              />
            </div>
          ) : (
            <h2 className="m-0 text-2xl font-semibold text-foreground">{editor.name}</h2>
          )}
          {editor.isDirty && (
            <Badge variant="warning">
              Unsaved changes
            </Badge>
          )}
        </div>

        <div className="flex gap-3">
          {onCancel && (
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={editor.isSaving}
            >
              Cancel
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            onClick={() => handleSave(true)}
            disabled={!canSave || editor.isSaving}
            title="Validate without saving"
          >
            Validate
          </Button>
          <Button
            type="button"
            onClick={() => handleSave(false)}
            disabled={!canSave || editor.isSaving || !editor.isDirty}
            className="bg-[#BF9595] text-[#0C1D31] border-[#BF9595] hover:bg-[#A88080] hover:border-[#A88080]"
          >
            {editor.isSaving ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-border border-t-[#BF9595] rounded-full animate-spin" />
                Saving...
              </>
            ) : (
              'Save Policy'
            )}
          </Button>
        </div>
      </CardHeader>

      {/* Error Display */}
      <ApiErrorAlert error={editor.error} className="mx-6 mt-4" />

      {/* Loading State */}
      {editor.isLoading && (
        <div className="flex items-center justify-center gap-3 py-12 text-muted-foreground">
          <span className="w-5 h-5 border-[3px] border-border border-t-[#BF9595] rounded-full animate-spin" />
          Loading policy...
        </div>
      )}

      {/* Main Content */}
      {!editor.isLoading && (
        <CardContent className="grid grid-cols-1 xl:grid-cols-2 gap-6 p-6">
          {/* Left Panel: Policy Form */}
          <div className="flex flex-col gap-6">
            <PolicyResourceForm
              resource={editor.spec.resource}
              onChange={editor.setResource}
              client={client}
            />

            <PolicyRuleList
              auditRules={editor.spec.auditRules || []}
              eventRules={editor.spec.eventRules || []}
              previewResult={preview.result}
              onAuditRulesChange={editor.setAuditRules}
              onEventRulesChange={editor.setEventRules}
              onAddAuditRule={editor.addAuditRule}
              onAddEventRule={editor.addEventRule}
            />
          </div>

          {/* Right Panel: Preview */}
          <div className="sticky top-4 self-start">
            <PolicyPreviewPanel
              inputs={preview.inputs}
              selectedIndices={preview.selectedIndices}
              result={preview.result}
              isLoading={preview.isLoading}
              error={preview.error}
              onInputsChange={preview.setInputs}
              onToggleSelection={preview.toggleSelection}
              onSelectAll={preview.selectAll}
              onDeselectAll={preview.deselectAll}
              onRunPreview={handleRunPreview}
              onResourceClick={onResourceClick}
              client={client}
              policyResource={editor.spec.resource}
              hasSelection={preview.hasSelection}
            />
          </div>
        </CardContent>
      )}
    </Card>
  );
}

// Helper functions (duplicated from PolicyResourceForm for standalone use)
function deriveKindLabel(kind: string): string {
  if (!kind) return '';
  return kind
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .trim();
}

function derivePluralLabel(label: string): string {
  if (!label) return '';
  const trimmed = label.trim();
  if (trimmed.endsWith('y')) {
    return trimmed.slice(0, -1) + 'ies';
  } else if (
    trimmed.endsWith('s') ||
    trimmed.endsWith('x') ||
    trimmed.endsWith('z') ||
    trimmed.endsWith('ch') ||
    trimmed.endsWith('sh')
  ) {
    return trimmed + 'es';
  } else {
    return trimmed + 's';
  }
}
