import { useState, useCallback } from 'react';
import type {
  PolicyPreviewInput,
  PolicyPreviewStatus,
  PolicyPreviewSpec,
  PolicyPreviewPolicySpec,
  PolicyPreviewInputType,
  KubernetesEvent,
} from '../types/policy';
import type { Event } from '../types';
import { ActivityApiClient } from '../api/client';

/**
 * Options for the usePolicyPreview hook
 */
export interface UsePolicyPreviewOptions {
  /** API client instance */
  client: ActivityApiClient;
}

/**
 * Result returned by the usePolicyPreview hook
 */
export interface UsePolicyPreviewResult {
  /** Current preview inputs (multiple) */
  inputs: PolicyPreviewInput[];
  /** Selected input indices for preview */
  selectedIndices: Set<number>;
  /** Last preview result (status from server) */
  result: PolicyPreviewStatus | null;
  /** Whether a preview is running */
  isLoading: boolean;
  /** Error if any occurred */
  error: Error | null;
  /** Set all inputs */
  setInputs: (inputs: PolicyPreviewInput[]) => void;
  /** Add an input */
  addInput: (input: PolicyPreviewInput) => void;
  /** Remove an input by index */
  removeInput: (index: number) => void;
  /** Toggle selection of an input */
  toggleSelection: (index: number) => void;
  /** Select all inputs */
  selectAll: () => void;
  /** Deselect all inputs */
  deselectAll: () => void;
  /** Set inputs from audit events */
  setAuditInputs: (events: Event[]) => void;
  /** Set inputs from Kubernetes events */
  setEventInputs: (events: KubernetesEvent[]) => void;
  /** Run the preview with selected inputs */
  runPreview: (
    policySpec: PolicyPreviewPolicySpec,
    kindLabel?: string,
    kindLabelPlural?: string
  ) => Promise<PolicyPreviewStatus>;
  /** Clear the preview result */
  clearResult: () => void;
  /** Clear all state */
  reset: () => void;
  /** Get selected inputs */
  getSelectedInputs: () => PolicyPreviewInput[];
  /** Whether there are selected inputs */
  hasSelection: boolean;

  // Legacy single-input support
  /** @deprecated Use inputs[0] */
  input: PolicyPreviewInput;
  /** @deprecated Use setInputs([input]) */
  setInput: (input: PolicyPreviewInput) => void;
  /** @deprecated Use setAuditInputs([event]) */
  setAuditInput: (audit: Event) => void;
  /** @deprecated Use setEventInputs([event]) */
  setEventInput: (event: KubernetesEvent) => void;
  /** @deprecated Use setInputs with parsed JSON */
  setInputFromJson: (json: string) => void;
  /** @deprecated Use setInputs */
  setInputType: (type: PolicyPreviewInputType) => void;
  /** Get the current input as formatted JSON */
  getInputJson: () => string;
}

/**
 * Create an empty audit event for preview
 */
function createEmptyAuditEvent(): Event {
  return {
    level: 'RequestResponse',
    auditID: 'preview-' + Date.now(),
    stage: 'ResponseComplete',
    requestURI: '/apis/example.com/v1/namespaces/default/examples/my-example',
    verb: 'create',
    user: {
      username: 'alice@example.com',
      uid: 'user-123',
      groups: ['users', 'developers'],
    },
    objectRef: {
      apiGroup: 'example.com',
      apiVersion: 'v1',
      resource: 'examples',
      namespace: 'default',
      name: 'my-example',
      uid: 'resource-456',
    },
    responseStatus: {
      code: 201,
      status: 'Success',
    },
    requestReceivedTimestamp: new Date().toISOString(),
    stageTimestamp: new Date().toISOString(),
  };
}

/**
 * Create an empty Kubernetes event for preview
 */
function createEmptyKubernetesEvent(): KubernetesEvent {
  return {
    type: 'Normal',
    reason: 'Created',
    message: 'Example resource was created successfully',
    involvedObject: {
      apiVersion: 'example.com/v1',
      kind: 'Example',
      name: 'my-example',
      namespace: 'default',
      uid: 'resource-456',
    },
    source: {
      component: 'example-controller',
    },
    firstTimestamp: new Date().toISOString(),
    lastTimestamp: new Date().toISOString(),
    count: 1,
    metadata: {
      name: 'my-example.123abc',
      namespace: 'default',
    },
  };
}

/**
 * Create the initial input state
 */
function createInitialInput(): PolicyPreviewInput {
  return {
    type: 'audit',
    audit: createEmptyAuditEvent(),
  };
}

/**
 * React hook for managing policy preview state
 */
export function usePolicyPreview({
  client,
}: UsePolicyPreviewOptions): UsePolicyPreviewResult {
  const [inputs, setInputsState] = useState<PolicyPreviewInput[]>([]);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [result, setResult] = useState<PolicyPreviewStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Set inputs and auto-select all
  const setInputs = useCallback((newInputs: PolicyPreviewInput[]) => {
    setInputsState(newInputs);
    setSelectedIndices(new Set(newInputs.map((_, i) => i)));
    setResult(null);
    setError(null);
  }, []);

  // Add an input
  const addInput = useCallback((input: PolicyPreviewInput) => {
    setInputsState((prev) => {
      const newInputs = [...prev, input];
      // Auto-select the new input
      setSelectedIndices((prevSelected) => new Set([...prevSelected, newInputs.length - 1]));
      return newInputs;
    });
  }, []);

  // Remove an input by index
  const removeInput = useCallback((index: number) => {
    setInputsState((prev) => prev.filter((_, i) => i !== index));
    setSelectedIndices((prev) => {
      const newSet = new Set<number>();
      prev.forEach((i) => {
        if (i < index) newSet.add(i);
        else if (i > index) newSet.add(i - 1);
      });
      return newSet;
    });
  }, []);

  // Toggle selection
  const toggleSelection = useCallback((index: number) => {
    setSelectedIndices((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  }, []);

  // Select all
  const selectAll = useCallback(() => {
    setSelectedIndices(new Set(inputs.map((_, i) => i)));
  }, [inputs]);

  // Deselect all
  const deselectAll = useCallback(() => {
    setSelectedIndices(new Set());
  }, []);

  // Set inputs from audit events
  const setAuditInputs = useCallback((events: Event[]) => {
    const newInputs: PolicyPreviewInput[] = events.map((event) => ({
      type: 'audit' as const,
      audit: event,
    }));
    setInputs(newInputs);
  }, [setInputs]);

  // Set inputs from Kubernetes events
  const setEventInputs = useCallback((events: KubernetesEvent[]) => {
    const newInputs: PolicyPreviewInput[] = events.map((event) => ({
      type: 'event' as const,
      event,
    }));
    setInputs(newInputs);
  }, [setInputs]);

  // Get selected inputs
  const getSelectedInputs = useCallback((): PolicyPreviewInput[] => {
    return inputs.filter((_, i) => selectedIndices.has(i));
  }, [inputs, selectedIndices]);

  // Get current input as JSON (for legacy support / manual editing)
  const getInputJson = useCallback((): string => {
    const selected = getSelectedInputs();
    if (selected.length === 0) return '[]';
    if (selected.length === 1) {
      const input = selected[0];
      const data = input.type === 'audit' ? input.audit : input.event;
      return JSON.stringify(data, null, 2);
    }
    return JSON.stringify(selected, null, 2);
  }, [getSelectedInputs]);

  // Run the preview
  const runPreview = useCallback(
    async (
      policySpec: PolicyPreviewPolicySpec,
      kindLabel?: string,
      kindLabelPlural?: string
    ): Promise<PolicyPreviewStatus> => {
      const selectedInputs = getSelectedInputs();
      if (selectedInputs.length === 0) {
        const err = new Error('No inputs selected for preview');
        setError(err);
        throw err;
      }

      setIsLoading(true);
      setError(null);

      try {
        const spec: PolicyPreviewSpec = {
          policy: policySpec,
          inputs: selectedInputs,
          kindLabel,
          kindLabelPlural,
        };

        const previewResult = await client.createPolicyPreview(spec);
        const status = previewResult.status || {
          activities: [],
          results: [],
          error: 'No status returned from server',
        };

        setResult(status);
        return status;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        setResult({
          activities: [],
          results: [],
          error: error.message,
        });
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [client, getSelectedInputs]
  );

  // Clear the result
  const clearResult = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  // Reset all state
  const reset = useCallback(() => {
    setInputsState([]);
    setSelectedIndices(new Set());
    setResult(null);
    setError(null);
  }, []);

  // Legacy single-input support
  const input = inputs[0] || createInitialInput();

  const setInput = useCallback((newInput: PolicyPreviewInput) => {
    setInputs([newInput]);
  }, [setInputs]);

  const setAuditInput = useCallback((audit: Event) => {
    setInputs([{ type: 'audit', audit }]);
  }, [setInputs]);

  const setEventInput = useCallback((event: KubernetesEvent) => {
    setInputs([{ type: 'event', event }]);
  }, [setInputs]);

  const setInputFromJson = useCallback((json: string) => {
    try {
      const parsed = JSON.parse(json);
      if (Array.isArray(parsed)) {
        // Multiple inputs
        setInputs(parsed);
      } else {
        // Single input - determine type
        const inputType = parsed.verb ? 'audit' : 'event';
        if (inputType === 'audit') {
          setInputs([{ type: 'audit', audit: parsed }]);
        } else {
          setInputs([{ type: 'event', event: parsed }]);
        }
      }
    } catch (err) {
      setError(new Error(`Invalid JSON: ${err instanceof Error ? err.message : String(err)}`));
    }
  }, [setInputs]);

  const setInputType = useCallback((type: PolicyPreviewInputType) => {
    if (type === 'audit') {
      setInputs([{ type: 'audit', audit: createEmptyAuditEvent() }]);
    } else {
      setInputs([{ type: 'event', event: createEmptyKubernetesEvent() }]);
    }
  }, [setInputs]);

  return {
    inputs,
    selectedIndices,
    result,
    isLoading,
    error,
    setInputs,
    addInput,
    removeInput,
    toggleSelection,
    selectAll,
    deselectAll,
    setAuditInputs,
    setEventInputs,
    runPreview,
    clearResult,
    reset,
    getSelectedInputs,
    hasSelection: selectedIndices.size > 0,
    // Legacy support
    input,
    setInput,
    setAuditInput,
    setEventInput,
    setInputFromJson,
    setInputType,
    getInputJson,
  };
}
