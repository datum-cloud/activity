import { useState, useCallback, useMemo } from 'react';
import type {
  ActivityPolicy,
  ActivityPolicySpec,
  ActivityPolicyRule,
  ActivityPolicyResource,
} from '../types/policy';
import { ActivityApiClient } from '../api/client';

/**
 * Options for the usePolicyEditor hook
 */
export interface UsePolicyEditorOptions {
  /** API client instance */
  client: ActivityApiClient;
  /** Initial policy name for editing (undefined for new policy) */
  initialPolicyName?: string;
}

/**
 * Result returned by the usePolicyEditor hook
 */
export interface UsePolicyEditorResult {
  /** The original policy being edited (null for new policy) */
  policy: ActivityPolicy | null;
  /** Current editable spec state */
  spec: ActivityPolicySpec;
  /** Policy name (editable for new policies) */
  name: string;
  /** Whether there are unsaved changes */
  isDirty: boolean;
  /** Whether the editor is loading */
  isLoading: boolean;
  /** Whether a save is in progress */
  isSaving: boolean;
  /** Error if any occurred */
  error: Error | null;
  /** Whether this is a new policy (not yet created) */
  isNew: boolean;
  /** Update the policy name (only for new policies) */
  setName: (name: string) => void;
  /** Update the entire spec */
  setSpec: (spec: ActivityPolicySpec) => void;
  /** Update the resource section */
  setResource: (resource: ActivityPolicyResource) => void;
  /** Update audit rules */
  setAuditRules: (rules: ActivityPolicyRule[]) => void;
  /** Update event rules */
  setEventRules: (rules: ActivityPolicyRule[]) => void;
  /** Add a new audit rule */
  addAuditRule: () => void;
  /** Add a new event rule */
  addEventRule: () => void;
  /** Update a specific audit rule */
  updateAuditRule: (index: number, rule: ActivityPolicyRule) => void;
  /** Update a specific event rule */
  updateEventRule: (index: number, rule: ActivityPolicyRule) => void;
  /** Remove an audit rule */
  removeAuditRule: (index: number) => void;
  /** Remove an event rule */
  removeEventRule: (index: number) => void;
  /** Save the policy (create or update) */
  save: (dryRun?: boolean) => Promise<ActivityPolicy>;
  /** Load an existing policy by name */
  load: (name: string) => Promise<void>;
  /** Reset to last saved state (or initial state for new policy) */
  reset: () => void;
  /** Clear all state and start with a new policy */
  clear: () => void;
}

/**
 * Create an empty policy spec for new policies
 */
function createEmptySpec(): ActivityPolicySpec {
  return {
    resource: {
      apiGroup: '',
      kind: '',
    },
    auditRules: [],
    eventRules: [],
  };
}

/**
 * Create an empty rule
 */
function createEmptyRule(): ActivityPolicyRule {
  return {
    match: '',
    summary: '',
  };
}

/**
 * Deep compare two specs for equality
 */
function specsEqual(a: ActivityPolicySpec, b: ActivityPolicySpec): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * React hook for editing an ActivityPolicy
 */
export function usePolicyEditor({
  client,
  initialPolicyName,
}: UsePolicyEditorOptions): UsePolicyEditorResult {
  // Original policy (null for new policies)
  const [policy, setPolicy] = useState<ActivityPolicy | null>(null);
  // Current editable state
  const [name, setName] = useState(initialPolicyName || '');
  const [spec, setSpec] = useState<ActivityPolicySpec>(createEmptySpec());
  // Saved spec for dirty tracking
  const [savedSpec, setSavedSpec] = useState<ActivityPolicySpec>(createEmptySpec());
  const [savedName, setSavedName] = useState(initialPolicyName || '');
  // Loading states
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Computed states
  const isNew = policy === null;
  const isDirty = useMemo(() => {
    if (isNew && name !== savedName) return true;
    return !specsEqual(spec, savedSpec);
  }, [spec, savedSpec, name, savedName, isNew]);

  // Resource setters
  const setResource = useCallback((resource: ActivityPolicyResource) => {
    setSpec((prev) => ({ ...prev, resource }));
  }, []);

  // Rule setters
  const setAuditRules = useCallback((rules: ActivityPolicyRule[]) => {
    setSpec((prev) => ({ ...prev, auditRules: rules }));
  }, []);

  const setEventRules = useCallback((rules: ActivityPolicyRule[]) => {
    setSpec((prev) => ({ ...prev, eventRules: rules }));
  }, []);

  // Add rules
  const addAuditRule = useCallback(() => {
    setSpec((prev) => ({
      ...prev,
      auditRules: [...(prev.auditRules || []), createEmptyRule()],
    }));
  }, []);

  const addEventRule = useCallback(() => {
    setSpec((prev) => ({
      ...prev,
      eventRules: [...(prev.eventRules || []), createEmptyRule()],
    }));
  }, []);

  // Update specific rules
  const updateAuditRule = useCallback((index: number, rule: ActivityPolicyRule) => {
    setSpec((prev) => {
      const rules = [...(prev.auditRules || [])];
      rules[index] = rule;
      return { ...prev, auditRules: rules };
    });
  }, []);

  const updateEventRule = useCallback((index: number, rule: ActivityPolicyRule) => {
    setSpec((prev) => {
      const rules = [...(prev.eventRules || [])];
      rules[index] = rule;
      return { ...prev, eventRules: rules };
    });
  }, []);

  // Remove rules
  const removeAuditRule = useCallback((index: number) => {
    setSpec((prev) => ({
      ...prev,
      auditRules: (prev.auditRules || []).filter((_, i) => i !== index),
    }));
  }, []);

  const removeEventRule = useCallback((index: number) => {
    setSpec((prev) => ({
      ...prev,
      eventRules: (prev.eventRules || []).filter((_, i) => i !== index),
    }));
  }, []);

  // Load an existing policy
  const load = useCallback(
    async (policyName: string) => {
      setIsLoading(true);
      setError(null);

      try {
        const result = await client.getPolicy(policyName);
        setPolicy(result);
        setName(result.metadata?.name || policyName);
        setSpec(result.spec);
        setSavedSpec(result.spec);
        setSavedName(result.metadata?.name || policyName);
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [client]
  );

  // Save the policy (create or update)
  const save = useCallback(
    async (dryRun?: boolean): Promise<ActivityPolicy> => {
      if (!name.trim()) {
        throw new Error('Policy name is required');
      }

      setIsSaving(true);
      setError(null);

      try {
        let result: ActivityPolicy;

        if (isNew) {
          result = await client.createPolicy(name, spec, dryRun);
        } else {
          result = await client.updatePolicy(
            name,
            spec,
            dryRun,
            policy?.metadata?.resourceVersion
          );
        }

        // Only update saved state if not a dry run
        if (!dryRun) {
          setPolicy(result);
          setSavedSpec(result.spec);
          setSavedName(result.metadata?.name || name);
        }

        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        throw error;
      } finally {
        setIsSaving(false);
      }
    },
    [client, name, spec, isNew, policy]
  );

  // Reset to last saved state
  const reset = useCallback(() => {
    setSpec(savedSpec);
    setName(savedName);
    setError(null);
  }, [savedSpec, savedName]);

  // Clear all state and start fresh
  const clear = useCallback(() => {
    setPolicy(null);
    setName('');
    setSpec(createEmptySpec());
    setSavedSpec(createEmptySpec());
    setSavedName('');
    setError(null);
  }, []);

  return {
    policy,
    spec,
    name,
    isDirty,
    isLoading,
    isSaving,
    error,
    isNew,
    setName,
    setSpec,
    setResource,
    setAuditRules,
    setEventRules,
    addAuditRule,
    addEventRule,
    updateAuditRule,
    updateEventRule,
    removeAuditRule,
    removeEventRule,
    save,
    load,
    reset,
    clear,
  };
}
