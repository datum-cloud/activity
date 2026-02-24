/**
 * TypeScript types for ActivityPolicy management and preview
 * Based on the Activity Policy system for translating audit events/K8s events into activities
 */

import type { ObjectMeta, Event } from './index';
import type { ActivityLink } from './activity';

/**
 * Resource specification for an ActivityPolicy
 * Identifies which API group/kind this policy applies to
 */
export interface ActivityPolicyResource {
  /** API group (e.g., "networking.datumapis.com") */
  apiGroup: string;
  /** Resource kind (e.g., "HTTPProxy") */
  kind: string;
  /** Optional human-readable label (defaults to kind) */
  kindLabel?: string;
  /** Optional plural label (defaults to kindLabel + "s") */
  kindLabelPlural?: string;
}

/**
 * A single rule in an ActivityPolicy
 * Matches events and generates summaries
 */
export interface ActivityPolicyRule {
  /**
   * CEL expression to match events
   * For audit rules: access via `audit.*` (e.g., `audit.verb == "create"`)
   * For event rules: access via `event.*` (e.g., `event.reason == "Ready"`)
   */
  match: string;
  /**
   * CEL expression to generate the activity summary
   * Can use {{ }} interpolation for embedded expressions
   * Example: "{{ actor.name }} created {{ kindLabel }} {{ resource.name }}"
   */
  summary: string;
}

/**
 * Specification for an ActivityPolicy
 */
export interface ActivityPolicySpec {
  /** The resource this policy applies to */
  resource: ActivityPolicyResource;
  /** Rules for matching and translating Kubernetes audit events */
  auditRules?: ActivityPolicyRule[];
  /** Rules for matching and translating Kubernetes events */
  eventRules?: ActivityPolicyRule[];
}

/**
 * Standard Kubernetes condition (from metav1.Condition)
 */
export interface Condition {
  /** Type of condition (e.g., "Ready") */
  type: string;
  /** Status of the condition: "True", "False", or "Unknown" */
  status: 'True' | 'False' | 'Unknown';
  /** Last time the condition transitioned */
  lastTransitionTime?: string;
  /** Machine-readable reason for the condition's current status */
  reason?: string;
  /** Human-readable message with details */
  message?: string;
  /** Generation the condition was set based on */
  observedGeneration?: number;
}

/**
 * Status of an ActivityPolicy
 */
export interface ActivityPolicyStatus {
  /** Conditions represent the current state of the policy.
   * The "Ready" condition indicates whether all rules compile successfully.
   */
  conditions?: Condition[];
  /** Generation last processed by the controller */
  observedGeneration?: number;
}

/**
 * ActivityPolicy resource for translating audit events and K8s events into activities
 */
export interface ActivityPolicy {
  apiVersion: 'activity.miloapis.com/v1alpha1';
  kind: 'ActivityPolicy';
  metadata: ObjectMeta;
  spec: ActivityPolicySpec;
  status?: ActivityPolicyStatus;
}

/**
 * List of ActivityPolicy resources
 */
export interface ActivityPolicyList {
  apiVersion: 'activity.miloapis.com/v1alpha1';
  kind: 'ActivityPolicyList';
  metadata?: {
    continue?: string;
    resourceVersion?: string;
  };
  items: ActivityPolicy[];
}

// ==============================================
// PolicyPreview Types
// ==============================================

/**
 * Input type for policy preview
 */
export type PolicyPreviewInputType = 'audit' | 'event';

/**
 * Kubernetes Event for policy preview
 * Simplified version focused on fields used in policy matching
 * Supports both eventsv1 (new) and corev1 (deprecated) field names
 */
export interface KubernetesEvent {
  /** Event type: "Normal" or "Warning" */
  type?: string;
  /** Short reason for the event (e.g., "Created", "Ready", "Failed") */
  reason?: string;
  /** Human-readable description (eventsv1 field name) */
  note?: string;
  /** @deprecated Use note instead (corev1 field name) */
  message?: string;
  /** Object this event is about (eventsv1 field name) */
  regarding?: {
    apiVersion?: string;
    kind?: string;
    name?: string;
    namespace?: string;
    uid?: string;
    resourceVersion?: string;
  };
  /** @deprecated Use regarding instead (corev1 field name) */
  involvedObject?: {
    apiVersion?: string;
    kind?: string;
    name?: string;
    namespace?: string;
    uid?: string;
    resourceVersion?: string;
  };
  /** Controller that emitted this event (eventsv1 field name) */
  reportingController?: string;
  /** ID of the controller instance (eventsv1 field name) */
  reportingInstance?: string;
  /** @deprecated Use reportingController instead (corev1 field name) */
  source?: {
    component?: string;
    host?: string;
  };
  /** Time when this event was first observed (eventsv1 field name) */
  eventTime?: string;
  /** Event series data (eventsv1 field name) */
  series?: {
    count?: number;
    lastObservedTime?: string;
  };
  /** @deprecated Use eventTime instead (corev1 field name) */
  firstTimestamp?: string;
  /** @deprecated Use series.lastObservedTime instead (corev1 field name) */
  lastTimestamp?: string;
  /** @deprecated Use series.count instead (corev1 field name) */
  count?: number;
  /** Metadata about the event */
  metadata?: ObjectMeta;
}

/**
 * Input for policy preview - either an audit event or K8s event
 */
export interface PolicyPreviewInput {
  /** Type of input */
  type: PolicyPreviewInputType;
  /** Audit event (when type is "audit") */
  audit?: Event;
  /** Kubernetes event (when type is "event") */
  event?: KubernetesEvent;
}

/**
 * The policy spec to test in a preview (subset of ActivityPolicySpec)
 */
export interface PolicyPreviewPolicySpec {
  /** Resource specification */
  resource: ActivityPolicyResource;
  /** Audit rules to test */
  auditRules?: ActivityPolicyRule[];
  /** Event rules to test */
  eventRules?: ActivityPolicyRule[];
}

/**
 * Specification for a PolicyPreview request
 */
export interface PolicyPreviewSpec {
  /** The policy to test */
  policy: PolicyPreviewPolicySpec;
  /** The inputs to test against (supports multiple) */
  inputs: PolicyPreviewInput[];
  /** Optional kind label override */
  kindLabel?: string;
  /** Optional kind label plural override */
  kindLabelPlural?: string;
}

/**
 * Result for a single input in the preview
 */
export interface PolicyPreviewInputResult {
  /** Index of this input in spec.inputs (0-based) */
  inputIndex: number;
  /** Whether any rule matched this input */
  matched: boolean;
  /** Index of the matched rule (0-based), -1 if no match */
  matchedRuleIndex: number;
  /** Type of rule that matched ("audit" or "event") */
  matchedRuleType?: PolicyPreviewInputType;
  /** Error message if evaluating this input failed */
  error?: string;
}

/**
 * Preview Activity - simplified activity for preview display
 */
export interface PreviewActivity {
  /** Activity metadata */
  metadata?: ObjectMeta;
  /** Activity spec */
  spec: {
    /** Human-readable summary */
    summary: string;
    /** Change source: "human" or "system" */
    changeSource: string;
    /** Actor who performed the action */
    actor: {
      type: string;
      name: string;
      uid?: string;
      email?: string;
    };
    /** Resource that was affected */
    resource: {
      apiGroup?: string;
      apiVersion?: string;
      kind?: string;
      name?: string;
      namespace?: string;
      uid?: string;
    };
    /** Links in the summary */
    links?: ActivityLink[];
    /** Origin of this activity */
    origin: {
      type: string;
      id: string;
    };
  };
}

/**
 * Status of a PolicyPreview showing the results
 */
export interface PolicyPreviewStatus {
  /** Rendered Activity objects for inputs that matched */
  activities?: PreviewActivity[];
  /** Per-input results in the same order as spec.inputs */
  results?: PolicyPreviewInputResult[];
  /** General error message if preview failed entirely */
  error?: string;

  // Legacy single-input fields (for backwards compatibility)
  /** @deprecated Use results[].matched */
  matched?: boolean;
  /** @deprecated Use results[].matchedRuleIndex */
  matchedRuleIndex?: number;
  /** @deprecated Use results[].matchedRuleType */
  matchedRuleType?: PolicyPreviewInputType;
  /** @deprecated Use activities[0].spec.summary */
  generatedSummary?: string;
  /** @deprecated Use activities[0].spec.links */
  generatedLinks?: ActivityLink[];
}

/**
 * PolicyPreview resource for testing policies before deployment
 */
export interface PolicyPreview {
  apiVersion: 'activity.miloapis.com/v1alpha1';
  kind: 'PolicyPreview';
  metadata?: ObjectMeta;
  spec: PolicyPreviewSpec;
  status?: PolicyPreviewStatus;
}

// ==============================================
// Helper Types
// ==============================================

/**
 * Grouped policies by API group for display
 */
export interface PolicyGroup {
  apiGroup: string;
  policies: ActivityPolicy[];
}

/**
 * Sample input template for quick-fill
 */
export interface SampleInputTemplate {
  /** Display name for the template */
  name: string;
  /** Description of what this template represents */
  description: string;
  /** The input type */
  type: PolicyPreviewInputType;
  /** The sample input data */
  input: PolicyPreviewInput;
}

/**
 * Filter fields available for policy listing
 */
export interface PolicyFilterField {
  name: string;
  type: 'string' | 'enum';
  description: string;
  enumValues?: string[];
  examples?: string[];
}

/**
 * Available filter fields for policies
 */
export const POLICY_FILTER_FIELDS: PolicyFilterField[] = [
  {
    name: 'spec.resource.apiGroup',
    type: 'string',
    description: 'API group the policy applies to',
    examples: [
      'spec.resource.apiGroup == "networking.datumapis.com"',
      'spec.resource.apiGroup.startsWith("networking.")',
    ],
  },
  {
    name: 'spec.resource.kind',
    type: 'string',
    description: 'Resource kind the policy applies to',
    examples: [
      'spec.resource.kind == "HTTPProxy"',
      'spec.resource.kind in ["HTTPProxy", "Gateway"]',
    ],
  },
  {
    name: 'metadata.name',
    type: 'string',
    description: 'Policy name',
    examples: [
      'metadata.name == "httpproxy-policy"',
      'metadata.name.contains("gateway")',
    ],
  },
];
