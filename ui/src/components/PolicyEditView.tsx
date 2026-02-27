import { useEffect, useCallback, useState, useRef } from 'react';
import type { PolicyPreviewPolicySpec, Condition } from '../types/policy';
import type { ResourceRef, ErrorFormatter } from '../types/activity';
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
import { Alert, AlertDescription } from './ui/alert';
import { AlertTriangle, AlertCircle, Trash2, Copy, Check } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './ui/tooltip';

export interface PolicyEditViewProps {
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
  /** Custom error formatter for customizing error messages */
  errorFormatter?: ErrorFormatter;
}

/**
 * PolicyEditView provides an editor for creating/editing ActivityPolicies
 * with Editor and Preview tabs (Activity tab is in the separate detail view)
 */
export function PolicyEditView({
  client,
  policyName,
  onSaveSuccess,
  onCancel,
  onResourceClick,
  className = '',
  errorFormatter,
}: PolicyEditViewProps) {
  // Editor state
  const editor: UsePolicyEditorResult = usePolicyEditor({
    client,
    initialPolicyName: policyName,
  });

  // Preview state
  const preview: UsePolicyPreviewResult = usePolicyPreview({ client });

  // Delete confirmation state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Copy state
  const [isCopied, setIsCopied] = useState(false);

  // Track active tab
  const [activeTab, setActiveTab] = useState<string>('preview');

  // Track if we've auto-loaded audit logs and auto-previewed for the current resource
  const autoLoadedResourceRef = useRef<string>('');
  const autoPreviewedInputsRef = useRef<number>(0);

  // Track audit log loading state
  const [isLoadingAuditLogs, setIsLoadingAuditLogs] = useState(false);

  // Track pagination state for audit logs
  const [continueAfter, setContinueAfter] = useState<string | null>(null);
  const [hasMoreInputs, setHasMoreInputs] = useState(false);
  const [isLoadingMoreInputs, setIsLoadingMoreInputs] = useState(false);

  // Load existing policy on mount
  useEffect(() => {
    if (policyName) {
      editor.load(policyName).catch((err) => {
        console.error('Failed to load policy:', err);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [policyName]);

  // Auto-load audit logs when resource apiGroup and kind are available
  useEffect(() => {
    const apiGroup = editor.spec.resource.apiGroup;
    const kind = editor.spec.resource.kind;

    // Check if we have enough info to query (apiGroup can be empty string for core resources)
    if (kind.trim() === '') {
      return; // Need at least a kind
    }

    // Create a resource key to track whether we've already loaded for this resource
    const resourceKey = `${apiGroup}:${kind}`;

    // Skip if we've already auto-loaded for this resource
    if (autoLoadedResourceRef.current === resourceKey) {
      return;
    }

    // Build CEL filter for the resource type
    const filters: string[] = [];

    // Filter by API group if present (empty string means core API group)
    if (apiGroup !== '') {
      filters.push(`objectRef.apiGroup == '${apiGroup}'`);
    }

    // Use a contains match on the resource name to handle pluralization
    // e.g., "httpproxy" would match "httpproxies"
    const kindLower = kind.toLowerCase();
    filters.push(`objectRef.resource.contains('${kindLower}')`);

    const filter = filters.join(' && ');

    // Execute query to fetch audit logs
    const fetchAuditLogs = async () => {
      setIsLoadingAuditLogs(true);
      try {
        const queryName = `policy-preview-${Date.now()}`;

        // Calculate time range - last 24 hours
        const endTime = new Date();
        const startTime = new Date(endTime.getTime() - 24 * 60 * 60 * 1000);

        const spec = {
          filter,
          limit: 10, // Get a reasonable sample for preview
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
        };

        const result = await client.createQuery(queryName, spec);
        const events = result.status?.results || [];
        const cursor = result.status?.continue;

        if (events.length > 0) {
          preview.setAuditInputs(events);
          autoLoadedResourceRef.current = resourceKey;
          setContinueAfter(cursor || null);
          setHasMoreInputs(!!cursor);
        } else {
          console.log('No audit logs found matching filter:', filter);
          setContinueAfter(null);
          setHasMoreInputs(false);
        }
      } catch (err) {
        console.error('Failed to load audit logs for preview:', err);
        // Don't show error to user - this is an automatic background operation
      } finally {
        setIsLoadingAuditLogs(false);
      }
    };

    fetchAuditLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor.spec.resource.apiGroup, editor.spec.resource.kind]);

  // Load more audit logs using pagination cursor
  const loadMoreInputs = useCallback(async () => {
    if (!continueAfter || isLoadingMoreInputs) {
      return;
    }

    const apiGroup = editor.spec.resource.apiGroup;
    const kind = editor.spec.resource.kind;

    if (kind.trim() === '') {
      return;
    }

    // Build the same filter as the initial load
    const filters: string[] = [];
    if (apiGroup !== '') {
      filters.push(`objectRef.apiGroup == '${apiGroup}'`);
    }
    const kindLower = kind.toLowerCase();
    filters.push(`objectRef.resource.contains('${kindLower}')`);
    const filter = filters.join(' && ');

    setIsLoadingMoreInputs(true);
    try {
      const queryName = `policy-preview-more-${Date.now()}`;

      // Calculate time range - last 24 hours
      const endTime = new Date();
      const startTime = new Date(endTime.getTime() - 24 * 60 * 60 * 1000);

      const spec = {
        filter,
        limit: 10,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        continue: continueAfter, // Use the cursor from the previous query
      };

      const result = await client.createQuery(queryName, spec);
      const events = result.status?.results || [];
      const cursor = result.status?.continue;

      if (events.length > 0) {
        // Append new events to existing inputs
        events.forEach((event) => {
          preview.addInput({ type: 'audit', audit: event });
        });
        setContinueAfter(cursor || null);
        setHasMoreInputs(!!cursor);
      } else {
        setContinueAfter(null);
        setHasMoreInputs(false);
      }
    } catch (err) {
      console.error('Failed to load more audit logs:', err);
    } finally {
      setIsLoadingMoreInputs(false);
    }
  }, [continueAfter, isLoadingMoreInputs, editor.spec.resource.apiGroup, editor.spec.resource.kind, client, preview]);

  // Auto-run preview when preview inputs are loaded
  useEffect(() => {
    // Only auto-run if we have inputs and a valid policy spec
    if (preview.inputs.length === 0) {
      return;
    }

    // Skip if we've already auto-previewed for the current number of inputs
    // This prevents re-running when the same inputs are selected/deselected
    if (autoPreviewedInputsRef.current === preview.inputs.length) {
      return;
    }

    // Check if we have a valid policy to preview
    if (!editor.spec.resource.kind.trim()) {
      return;
    }

    // Check if we have at least one rule to preview
    const hasRules = (editor.spec.auditRules?.length || 0) > 0 || (editor.spec.eventRules?.length || 0) > 0;
    if (!hasRules) {
      console.log('Skipping auto-preview - no rules defined yet');
      return;
    }

    // Auto-run preview
    const policySpec: PolicyPreviewPolicySpec = {
      resource: editor.spec.resource,
      auditRules: editor.spec.auditRules,
      eventRules: editor.spec.eventRules,
    };

    console.log('Auto-running preview with', preview.inputs.length, 'inputs');
    preview.runPreview(policySpec).then(() => {
      autoPreviewedInputsRef.current = preview.inputs.length;
    }).catch((err) => {
      console.error('Auto-preview failed:', err);
      // Don't show error to user - this is an automatic background operation
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preview.inputs, editor.spec.auditRules, editor.spec.eventRules]);

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

    preview.runPreview(policySpec).catch((err) => {
      console.error('Preview failed:', err);
    });
  }, [editor.spec, preview]);

  // Handle delete
  const handleDelete = useCallback(async () => {
    if (!policyName) return;

    setIsDeleting(true);
    try {
      await client.deletePolicy(policyName);
      setShowDeleteDialog(false);
      if (onSaveSuccess) {
        // Navigate away after successful delete
        onSaveSuccess('');
      }
    } catch (err) {
      console.error('Failed to delete policy:', err);
    } finally {
      setIsDeleting(false);
    }
  }, [client, policyName, onSaveSuccess]);

  // Handle copy resource name
  const handleCopyResourceName = useCallback(async () => {
    if (editor.name) {
      try {
        await navigator.clipboard.writeText(editor.name);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
      } catch (err) {
        console.error('Failed to copy resource name:', err);
      }
    }
  }, [editor.name]);

  // Validation
  const canSave =
    editor.name.trim() !== '' &&
    editor.spec.resource.apiGroup.trim() !== '' &&
    editor.spec.resource.kind.trim() !== '';

  // Get policy status from conditions
  const getPolicyStatus = (): {
    status: 'ready' | 'error' | 'pending' | 'unknown';
    message?: string;
  } | null => {
    if (!editor.policy || editor.isNew) {
      return null; // No status for new policies
    }

    const conditions = editor.policy.status?.conditions;
    if (!conditions || conditions.length === 0) {
      return null;
    }

    const readyCondition = conditions.find((c: Condition) => c.type === 'Ready');
    if (!readyCondition) {
      return null;
    }

    if (readyCondition.status === 'True') {
      return { status: 'ready', message: readyCondition.message || 'All rules compiled successfully' };
    } else if (readyCondition.status === 'False') {
      return { status: 'error', message: readyCondition.message || readyCondition.reason || 'Rule compilation failed' };
    }

    return { status: 'pending', message: readyCondition.message || 'Status unknown' };
  };

  const policyStatus = getPolicyStatus();
  const isUnhealthy = policyStatus && policyStatus.status !== 'ready';

  return (
    <TooltipProvider delayDuration={0}>
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
              <div className="flex flex-col gap-1">
                <h2 className="m-0 text-xl font-semibold text-foreground leading-tight">
                  {editor.spec.resource.kind || 'Untitled Policy'}
                </h2>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {editor.spec.resource.apiGroup && (
                    <>
                      <span>API Group: {editor.spec.resource.apiGroup}</span>
                      <span className="text-muted-foreground/50">•</span>
                    </>
                  )}
                  <span>Resource: {editor.name}</span>
                  <Tooltip delayDuration={500}>
                    <TooltipTrigger asChild>
                      <button
                        onClick={handleCopyResourceName}
                        className="inline-flex items-center justify-center p-0.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-opacity cursor-pointer"
                        aria-label="Copy resource name"
                      >
                        {isCopied ? (
                          <Check className="h-3 w-3 text-green-600 dark:text-green-400" />
                        ) : (
                          <Copy className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                        )}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs">Click to copy</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </div>
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
              size="sm"
              onClick={onCancel}
              disabled={editor.isSaving}
              className="h-7 text-xs"
            >
              Cancel
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleSave(true)}
            disabled={!canSave || editor.isSaving}
            title="Validate without saving"
            className="h-7 text-xs"
          >
            Validate
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => handleSave(false)}
            disabled={!canSave || editor.isSaving || !editor.isDirty}
            className="bg-[#BF9595] text-[#0C1D31] border-[#BF9595] hover:bg-[#A88080] hover:border-[#A88080] h-7 text-xs"
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
      <ApiErrorAlert error={editor.error} className="mx-6 mt-4" errorFormatter={errorFormatter} />

      {/* Policy Health Status Banner */}
      {isUnhealthy && policyStatus && (
        <Alert
          variant={policyStatus.status === 'error' ? 'destructive' : 'warning'}
          className="mx-6 mt-4"
        >
          {policyStatus.status === 'error' ? (
            <AlertCircle className="h-4 w-4" />
          ) : (
            <AlertTriangle className="h-4 w-4" />
          )}
          <AlertDescription>
            <strong>
              {policyStatus.status === 'error' ? 'Policy Error: ' : 'Policy Pending: '}
            </strong>
            {policyStatus.message}
          </AlertDescription>
        </Alert>
      )}

      {/* Loading State */}
      {editor.isLoading && (
        <div className="flex items-center justify-center gap-3 py-12 text-muted-foreground">
          <span className="w-5 h-5 border-[3px] border-border border-t-[#BF9595] rounded-full animate-spin" />
          Loading policy...
        </div>
      )}

      {/* Main Content */}
      {!editor.isLoading && (
        <CardContent className="p-6">
          {/* Menu bar navigation */}
          <div className="flex items-center gap-4 mb-6 text-sm">
            <button
              onClick={() => setActiveTab('editor')}
              className={`px-0 py-1 transition-colors ${
                activeTab === 'editor'
                  ? 'text-foreground border-b-2 border-[#BF9595] font-medium'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Editor
            </button>
            <span className="text-muted-foreground/30">|</span>
            <button
              onClick={() => setActiveTab('preview')}
              className={`px-0 py-1 transition-colors ${
                activeTab === 'preview'
                  ? 'text-foreground border-b-2 border-[#BF9595] font-medium'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Preview
            </button>
          </div>

          {/* Editor View */}
          {activeTab === 'editor' && (
            <div className="flex flex-col gap-6">
              <PolicyResourceForm
                resource={editor.spec.resource}
                onChange={editor.setResource}
                client={client}
                isEditMode={!editor.isNew}
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

              {/* Danger Zone - Delete Policy (only for existing policies) */}
              {!editor.isNew && (
                <div className="mt-8 pt-6 border-t border-border">
                  <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6">
                    <div className="flex items-start gap-4">
                      <div className="flex-1">
                        <h3 className="text-base font-semibold text-foreground mb-2 flex items-center gap-2">
                          <AlertTriangle className="h-5 w-5 text-destructive" />
                          Danger Zone
                        </h3>
                        <p className="text-sm text-muted-foreground mb-4">
                          Deleting this policy will stop translating audit logs and events for{' '}
                          <strong className="text-foreground">
                            {editor.spec.resource.kind}
                          </strong>{' '}
                          resources. Existing activities will be preserved, but no new activities will be generated.
                        </p>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => setShowDeleteDialog(true)}
                          className="h-8 text-xs"
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                          Delete Policy
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Preview View */}
          {activeTab === 'preview' && (
            <PolicyPreviewPanel
              result={preview.result}
              inputs={preview.inputs}
              isLoading={preview.isLoading}
              error={preview.error}
              onResourceClick={onResourceClick}
              isLoadingInputs={isLoadingAuditLogs}
              hasMoreInputs={hasMoreInputs}
              isLoadingMoreInputs={isLoadingMoreInputs}
              onLoadMore={loadMoreInputs}
            />
          )}
        </CardContent>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Delete Policy</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{' '}
              <strong className="text-foreground">{editor.name}</strong>?
            </DialogDescription>
          </DialogHeader>
          <Alert variant="destructive" className="mt-2">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>This action cannot be undone.</strong>
              <br />
              Activities already generated by this policy will remain in the system,
              but no new activities will be created for {editor.spec.resource.kind} resources.
            </AlertDescription>
          </Alert>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDeleteDialog(false)}
              disabled={isDeleting}
              className="h-8 text-xs"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              disabled={isDeleting}
              className="h-8 text-xs"
            >
              {isDeleting ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                  Delete Policy
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
    </TooltipProvider>
  );
}
