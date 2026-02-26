import { useEffect, useState, useCallback } from 'react';
import type { ActivityPolicy, Condition } from '../types/policy';
import { ActivityApiClient } from '../api/client';
import { usePolicyList, type UsePolicyListResult } from '../hooks/usePolicyList';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Separator } from './ui/separator';
import { ApiErrorAlert } from './ApiErrorAlert';

export interface PolicyListProps {
  /** API client instance */
  client: ActivityApiClient;
  /** Callback when a policy is selected for editing */
  onEditPolicy?: (policyName: string) => void;
  /** Callback when create new policy is requested */
  onCreatePolicy?: () => void;
  /** Whether to show grouped by API group (default: true) */
  groupByApiGroup?: boolean;
  /** Additional CSS class */
  className?: string;
}

/**
 * Delete confirmation dialog state
 */
interface DeleteConfirmation {
  isOpen: boolean;
  policyName: string;
}

/**
 * PolicyList displays all ActivityPolicies with CRUD actions
 */
export function PolicyList({
  client,
  onEditPolicy,
  onCreatePolicy,
  groupByApiGroup = true,
  className = '',
}: PolicyListProps) {
  const policyList: UsePolicyListResult = usePolicyList({
    client,
    groupByApiGroup,
  });

  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirmation>({
    isOpen: false,
    policyName: '',
  });

  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Load policies on mount
  useEffect(() => {
    policyList.refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Expand all groups by default when data loads
  useEffect(() => {
    if (policyList.groups.length > 0 && expandedGroups.size === 0) {
      setExpandedGroups(new Set(policyList.groups.map((g) => g.apiGroup)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [policyList.groups]);

  // Toggle group expansion
  const toggleGroup = useCallback((apiGroup: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(apiGroup)) {
        next.delete(apiGroup);
      } else {
        next.add(apiGroup);
      }
      return next;
    });
  }, []);

  // Handle delete
  const handleDeleteClick = (policyName: string) => {
    setDeleteConfirm({ isOpen: true, policyName });
  };

  const handleDeleteConfirm = async () => {
    const { policyName } = deleteConfirm;
    setDeleteConfirm({ isOpen: false, policyName: '' });

    try {
      await policyList.deletePolicy(policyName);
    } catch (err) {
      console.error('Failed to delete policy:', err);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteConfirm({ isOpen: false, policyName: '' });
  };

  // Count rules for display
  const countRules = (policy: ActivityPolicy): { audit: number; event: number } => {
    return {
      audit: policy.spec.auditRules?.length || 0,
      event: policy.spec.eventRules?.length || 0,
    };
  };

  // Get policy status from conditions
  const getPolicyStatus = (policy: ActivityPolicy): {
    status: 'ready' | 'error' | 'pending';
    message?: string;
  } => {
    const conditions = policy.status?.conditions;
    if (!conditions || conditions.length === 0) {
      return { status: 'pending', message: 'Status not yet available' };
    }

    const readyCondition = conditions.find((c: Condition) => c.type === 'Ready');
    if (!readyCondition) {
      return { status: 'pending', message: 'Status not yet available' };
    }

    if (readyCondition.status === 'True') {
      return { status: 'ready', message: readyCondition.message || 'All rules compiled successfully' };
    } else if (readyCondition.status === 'False') {
      return { status: 'error', message: readyCondition.message || readyCondition.reason || 'Rule compilation failed' };
    }

    return { status: 'pending', message: readyCondition.message || 'Status unknown' };
  };

  return (
    <Card className={`rounded-xl ${className}`}>
      {/* Header */}
      <CardHeader className="pb-4">
        <div className="flex justify-between items-center">
          <CardTitle>Activity Policies</CardTitle>
          <div className="flex gap-3">
            <Button
              variant="outline"
              size="icon"
              onClick={policyList.refresh}
              disabled={policyList.isLoading}
              title="Refresh policy list"
            >
              {policyList.isLoading ? (
                <span className="w-3.5 h-3.5 border-2 border-border border-t-primary rounded-full animate-spin" />
              ) : (
                '↻'
              )}
            </Button>
            {onCreatePolicy && (
              <Button
                onClick={onCreatePolicy}
                className="bg-[#BF9595] text-[#0C1D31] hover:bg-[#A88080]"
              >
                + Create Policy
              </Button>
            )}
          </div>
        </div>
        <Separator className="mt-4" />
      </CardHeader>

      <CardContent>
        {/* Error Display */}
        <ApiErrorAlert error={policyList.error} onRetry={policyList.refresh} className="mb-4" />

        {/* Loading State */}
        {policyList.isLoading && policyList.policies.length === 0 && (
          <div className="flex items-center justify-center gap-3 py-12 text-muted-foreground">
            <span className="w-5 h-5 border-[3px] border-border border-t-[#BF9595] rounded-full animate-spin" />
            Loading policies...
          </div>
        )}

        {/* Empty State */}
        {!policyList.isLoading &&
          !policyList.error &&
          policyList.policies.length === 0 && (
            <div className="text-center py-12 px-8 text-muted-foreground">
              <div className="text-5xl mb-4">📋</div>
              <h3 className="m-0 mb-2 text-foreground">No policies found</h3>
              <p className="m-0 mb-6 max-w-[400px] mx-auto">
                Activity policies define how audit events and Kubernetes events are
                translated into human-readable activity summaries.
              </p>
              {onCreatePolicy && (
                <Button
                  onClick={onCreatePolicy}
                  className="bg-[#BF9595] text-[#0C1D31] hover:bg-[#A88080]"
                >
                  Create your first policy
                </Button>
              )}
            </div>
          )}

        {/* Policy Groups */}
        {policyList.groups.length > 0 && (
          <div className="flex flex-col gap-4">
            {policyList.groups.map((group) => (
              <div key={group.apiGroup} className="border border-input rounded-lg overflow-hidden">
                <button
                  type="button"
                  className="w-full flex items-center gap-3 px-4 py-3 bg-muted border-none cursor-pointer text-left text-xs font-medium text-foreground transition-colors duration-200 hover:bg-accent"
                  onClick={() => toggleGroup(group.apiGroup)}
                >
                  <span
                    className={`text-xs text-muted-foreground transition-transform duration-200 ${
                      expandedGroups.has(group.apiGroup) ? 'rotate-90' : ''
                    }`}
                  >
                    ▶
                  </span>
                  <span className="flex-1 font-mono">{group.apiGroup}</span>
                  <Badge variant="secondary" className="rounded-full">
                    {group.policies.length}
                  </Badge>
                </button>

                {expandedGroups.has(group.apiGroup) && (
                  <div className="p-2">
                    <table className="w-full border-collapse text-sm">
                      <thead>
                        <tr>
                          <th className="text-left px-4 py-3 bg-muted text-muted-foreground font-medium border-b border-input">Name</th>
                          <th className="text-left px-4 py-3 bg-muted text-muted-foreground font-medium border-b border-input">Status</th>
                          <th className="text-left px-4 py-3 bg-muted text-muted-foreground font-medium border-b border-input">Kind</th>
                          <th className="text-left px-4 py-3 bg-muted text-muted-foreground font-medium border-b border-input">Audit Rules</th>
                          <th className="text-left px-4 py-3 bg-muted text-muted-foreground font-medium border-b border-input">Event Rules</th>
                          <th className="text-left px-4 py-3 bg-muted text-muted-foreground font-medium border-b border-input">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.policies.map((policy) => {
                          const rules = countRules(policy);
                          const policyStatus = getPolicyStatus(policy);
                          return (
                            <tr key={policy.metadata?.name} className="hover:bg-muted">
                              <td className="px-4 py-3 border-b border-border last:border-b-0 font-medium text-foreground">
                                {policy.metadata?.name || 'unnamed'}
                              </td>
                              <td className="px-4 py-3 border-b border-border last:border-b-0">
                                <Badge
                                  variant={
                                    policyStatus.status === 'ready'
                                      ? 'success'
                                      : policyStatus.status === 'error'
                                        ? 'destructive'
                                        : 'secondary'
                                  }
                                  className={
                                    policyStatus.status === 'pending'
                                      ? 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
                                      : ''
                                  }
                                  title={policyStatus.message}
                                >
                                  {policyStatus.status === 'ready'
                                    ? 'Ready'
                                    : policyStatus.status === 'error'
                                      ? 'Error'
                                      : 'Pending'}
                                </Badge>
                              </td>
                              <td className="px-4 py-3 border-b border-border last:border-b-0">
                                <div className="flex items-center gap-2">
                                  <Badge className="bg-[#E6F59F] text-[#0C1D31] hover:bg-[#E6F59F]">
                                    {policy.spec.resource.kind}
                                  </Badge>
                                  {policy.spec.resource.kindLabel && (
                                    <span className="text-muted-foreground text-xs">
                                      ({policy.spec.resource.kindLabel})
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-3 border-b border-border last:border-b-0 text-center">
                                <Badge
                                  variant={rules.audit > 0 ? 'success' : 'secondary'}
                                  className={rules.audit === 0 ? 'bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500' : ''}
                                >
                                  {rules.audit}
                                </Badge>
                              </td>
                              <td className="px-4 py-3 border-b border-border last:border-b-0 text-center">
                                <Badge
                                  variant={rules.event > 0 ? 'success' : 'secondary'}
                                  className={rules.event === 0 ? 'bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500' : ''}
                                >
                                  {rules.event}
                                </Badge>
                              </td>
                              <td className="px-4 py-3 border-b border-border last:border-b-0">
                                <div className="flex gap-2">
                                  {onEditPolicy && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() =>
                                        onEditPolicy(policy.metadata?.name || '')
                                      }
                                      title="Edit policy"
                                    >
                                      Edit
                                    </Button>
                                  )}
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                      handleDeleteClick(policy.metadata?.name || '')
                                    }
                                    disabled={policyList.isDeleting}
                                    title="Delete policy"
                                    className="text-red-600 border-red-200 hover:bg-red-50 hover:border-red-400 hover:text-red-600 dark:text-red-400 dark:border-red-800 dark:hover:bg-red-950/50 dark:hover:border-red-600 dark:hover:text-red-400"
                                  >
                                    Delete
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {/* Delete Confirmation Modal */}
      <Dialog open={deleteConfirm.isOpen} onOpenChange={(open) => !open && handleDeleteCancel()}>
        <DialogContent className="max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Delete Policy</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the policy{' '}
              <strong>{deleteConfirm.policyName}</strong>?
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm text-red-700 bg-red-50 dark:text-red-200 dark:bg-red-950/50 p-3 rounded-md">
            This action cannot be undone. Activities already generated by this
            policy will remain, but no new activities will be created.
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleDeleteCancel}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
            >
              Delete Policy
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
