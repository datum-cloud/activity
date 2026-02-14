import { useMemo, useState, useEffect, useCallback } from 'react';
import type { ActivityPolicyResource } from '../types/policy';
import type { ActivityApiClient } from '../api/client';
import { Combobox, type ComboboxOption } from './ui/combobox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Button } from './ui/button';

export interface PolicyResourceFormProps {
  /** Current resource configuration */
  resource: ActivityPolicyResource;
  /** Callback when resource changes */
  onChange: (resource: ActivityPolicyResource) => void;
  /** Optional API client for fetching discovered resources */
  client?: ActivityApiClient;
  /** Additional CSS class */
  className?: string;
}

/**
 * Derive a default kind label from the kind name
 * e.g., "HTTPProxy" -> "HTTP Proxy", "NetworkEndpointGroup" -> "Network Endpoint Group"
 */
function deriveKindLabel(kind: string): string {
  if (!kind) return '';
  // Insert space before each capital letter (except the first) and handle acronyms
  return kind
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2') // Split acronyms from following words
    .replace(/([a-z])([A-Z])/g, '$1 $2') // Split lowercase from uppercase
    .trim();
}

/**
 * Derive plural form from singular label
 * Basic pluralization - handles common cases
 */
function derivePluralLabel(label: string): string {
  if (!label) return '';
  const trimmed = label.trim();
  if (trimmed.endsWith('y')) {
    // e.g., "Policy" -> "Policies"
    return trimmed.slice(0, -1) + 'ies';
  } else if (
    trimmed.endsWith('s') ||
    trimmed.endsWith('x') ||
    trimmed.endsWith('z') ||
    trimmed.endsWith('ch') ||
    trimmed.endsWith('sh')
  ) {
    // e.g., "Class" -> "Classes"
    return trimmed + 'es';
  } else {
    // Default: add 's'
    return trimmed + 's';
  }
}

/**
 * Convert plural resource name to Kind (PascalCase)
 * e.g., "httpproxies" -> "HTTPProxy", "gateways" -> "Gateway"
 */
function resourceToKind(resource: string): string {
  if (!resource) return '';
  // Remove trailing 's' or 'ies'
  let singular = resource;
  if (singular.endsWith('ies')) {
    singular = singular.slice(0, -3) + 'y';
  } else if (singular.endsWith('es')) {
    singular = singular.slice(0, -2);
  } else if (singular.endsWith('s')) {
    singular = singular.slice(0, -1);
  }
  // Convert to PascalCase
  return singular.charAt(0).toUpperCase() + singular.slice(1);
}

const CUSTOM_VALUE = '__custom__';
const CORE_API_GROUP_VALUE = '__core__'; // Sentinel for empty string (core Kubernetes API group)

/**
 * Convert API group value for Select component
 * Empty string (core API group) -> sentinel value
 */
function toSelectValue(apiGroup: string): string {
  return apiGroup === '' ? CORE_API_GROUP_VALUE : apiGroup;
}

/**
 * Convert Select value back to API group
 * Sentinel value -> empty string (core API group)
 */
function fromSelectValue(value: string): string {
  return value === CORE_API_GROUP_VALUE ? '' : value;
}

/**
 * PolicyResourceForm provides the form for editing policy resource configuration
 */
export function PolicyResourceForm({
  resource,
  onChange,
  client,
  className = '',
}: PolicyResourceFormProps) {
  // State for discovered API groups and resources
  const [apiGroups, setApiGroups] = useState<string[]>([]);
  const [resources, setResources] = useState<{ name: string; kind: string }[]>([]);
  const [isLoadingGroups, setIsLoadingGroups] = useState(false);
  const [isLoadingResources, setIsLoadingResources] = useState(false);

  // State for custom input mode
  const [customApiGroup, setCustomApiGroup] = useState(false);
  const [customKind, setCustomKind] = useState(false);

  // Compute derived labels
  const derivedKindLabel = useMemo(() => deriveKindLabel(resource.kind), [resource.kind]);
  const derivedPluralLabel = useMemo(
    () => derivePluralLabel(resource.kindLabel || derivedKindLabel),
    [resource.kindLabel, derivedKindLabel]
  );

  // Load API groups from Kubernetes API discovery
  const loadApiGroups = useCallback(async () => {
    if (!client) return;
    setIsLoadingGroups(true);
    try {
      const groups = await client.getAllAPIGroups();
      setApiGroups(groups);
    } catch (err) {
      console.error('Failed to load API groups:', err);
    } finally {
      setIsLoadingGroups(false);
    }
  }, [client]);

  // Load resources for the selected API group from Kubernetes API discovery
  const loadResources = useCallback(async () => {
    // Allow empty string for core Kubernetes API group (pods, services, etc.)
    if (!client || resource.apiGroup === undefined) {
      setResources([]);
      return;
    }
    setIsLoadingResources(true);
    try {
      const discoveryResult = await client.discoverAPIResources(resource.apiGroup);
      // Map API resources to name/kind pairs, filtering out subresources (those with /)
      const resourcesWithKind = (discoveryResult.resources || [])
        .filter((r) => !r.name.includes('/'))
        .map((r) => ({
          name: r.name,
          kind: r.kind,
        }))
        .sort((a, b) => a.kind.localeCompare(b.kind));

      setResources(resourcesWithKind);
    } catch (err) {
      console.error('Failed to load resources:', err);
      setResources([]);
    } finally {
      setIsLoadingResources(false);
    }
  }, [client, resource.apiGroup]);

  // Load API groups on mount if client is available
  useEffect(() => {
    if (client) {
      loadApiGroups();
    }
  }, [client, loadApiGroups]);

  // Load resources when API group changes (including empty string for core API group)
  useEffect(() => {
    if (client && resource.apiGroup !== undefined) {
      loadResources();
    }
  }, [client, resource.apiGroup, loadResources]);

  // Check if current value is in the list (for determining if custom mode is needed)
  // Use explicit undefined check to allow empty string (core API group)
  useEffect(() => {
    if (resource.apiGroup !== undefined && resource.apiGroup !== '' && apiGroups.length > 0 && !apiGroups.includes(resource.apiGroup)) {
      setCustomApiGroup(true);
    }
  }, [resource.apiGroup, apiGroups]);

  useEffect(() => {
    if (resource.kind && resources.length > 0) {
      // Check if the kind matches any resource
      const kindInList = resources.some((r) => r.kind === resource.kind);
      if (!kindInList) {
        setCustomKind(true);
      }
    }
  }, [resource.kind, resources]);

  const handleApiGroupComboboxChange = (value: string) => {
    if (value === CUSTOM_VALUE) {
      setCustomApiGroup(true);
    } else if (value === '') {
      // User cleared selection - set apiGroup to undefined to show placeholder
      setCustomApiGroup(false);
      onChange({ ...resource, apiGroup: undefined, kind: '' });
    } else {
      setCustomApiGroup(false);
      // Convert sentinel value back to empty string for core API group
      onChange({ ...resource, apiGroup: fromSelectValue(value), kind: '' }); // Clear kind when group changes
    }
  };

  const handleApiGroupInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ ...resource, apiGroup: e.target.value, kind: '' }); // Clear kind when group changes
  };

  const handleKindComboboxChange = (value: string) => {
    if (value === CUSTOM_VALUE) {
      setCustomKind(true);
    } else if (value === '') {
      // User cleared selection
      setCustomKind(false);
      onChange({ ...resource, kind: '' });
    } else {
      setCustomKind(false);
      // Find the resource and use its actual Kind from API discovery
      const selectedResource = resources.find((r) => r.name === value);
      const kind = selectedResource?.kind || resourceToKind(value);
      onChange({ ...resource, kind });
    }
  };

  const handleKindInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ ...resource, kind: e.target.value });
  };

  const handleKindLabelChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ ...resource, kindLabel: e.target.value || undefined });
  };

  const handleKindLabelPluralChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ ...resource, kindLabelPlural: e.target.value || undefined });
  };

  const handleBackToSelect = (field: 'apiGroup' | 'kind') => {
    if (field === 'apiGroup') {
      setCustomApiGroup(false);
      onChange({ ...resource, apiGroup: undefined, kind: '' });
    } else {
      setCustomKind(false);
      onChange({ ...resource, kind: '' });
    }
  };

  // Check if current apiGroup is in the list
  const apiGroupInList = resource.apiGroup !== undefined && apiGroups.includes(resource.apiGroup);

  // Find matching resource for current kind
  const currentResourceName = resources.find((r) => r.kind === resource.kind)?.name || '';

  // Build options for API Group combobox (sorted alphabetically)
  const apiGroupOptions = useMemo((): ComboboxOption[] => {
    const options: ComboboxOption[] = apiGroups
      .map((group) => ({
        value: group === '' ? CORE_API_GROUP_VALUE : group,
        label: group === '' ? 'core (pods, services, etc.)' : group,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
    // Add custom option at the end
    options.push({
      value: CUSTOM_VALUE,
      label: 'Enter custom value...',
    });
    return options;
  }, [apiGroups]);

  // Build options for Kind combobox
  const kindOptions = useMemo((): ComboboxOption[] => {
    const options: ComboboxOption[] = resources.map((res) => ({
      value: res.name,
      label: res.kind,
    }));
    // Add custom option at the end
    options.push({
      value: CUSTOM_VALUE,
      label: 'Enter custom value...',
    });
    return options;
  }, [resources]);

  return (
    <div className={`rounded-lg bg-muted p-6 ${className}`}>
      <h4 className="mb-2 text-base font-medium text-foreground">Resource Target</h4>
      <p className="mb-6 text-sm text-muted-foreground">
        Define which API group and kind this policy applies to.
        {client && (
          <span className="italic text-muted-foreground/70">
            {' '}Options populated from Kubernetes API discovery.
          </span>
        )}
      </p>

      {/* API Group */}
      <div className="mb-5 last:mb-0">
        <Label htmlFor="resource-apiGroup" className="mb-1.5 block text-foreground/80">
          API Group <span className="text-destructive">*</span>
        </Label>
        {client && !customApiGroup ? (
          <Combobox
            options={apiGroupOptions}
            value={resource.apiGroup === undefined ? '' : (apiGroupInList ? toSelectValue(resource.apiGroup) : '')}
            onValueChange={handleApiGroupComboboxChange}
            placeholder="Select an API Group..."
            searchPlaceholder="Search API groups..."
            emptyMessage="No API groups found."
            loading={isLoadingGroups}
            showAllOption={false}
            allowCustomValue={true}
            customValueLabel='Use "{value}"'
            onCustomValue={(value) => {
              setCustomApiGroup(true);
              onChange({ ...resource, apiGroup: value, kind: '' });
            }}
          />
        ) : (
          <div className="flex gap-2">
            <Input
              id="resource-apiGroup"
              type="text"
              className="flex-1"
              value={resource.apiGroup ?? ''}
              onChange={handleApiGroupInputChange}
              placeholder="e.g., networking.datumapis.com"
            />
            {client && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleBackToSelect('apiGroup')}
                title="Back to select"
              >
                Back to list
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Kind */}
      <div className="mb-5 last:mb-0">
        <Label htmlFor="resource-kind" className="mb-1.5 block text-foreground/80">
          Kind <span className="text-destructive">*</span>
        </Label>
        {client && !customKind ? (
          <Combobox
            options={kindOptions}
            value={currentResourceName}
            onValueChange={handleKindComboboxChange}
            placeholder={
              resource.apiGroup === undefined
                ? 'Select API Group first...'
                : 'Select a Kind...'
            }
            searchPlaceholder="Search kinds..."
            emptyMessage="No kinds found."
            loading={isLoadingResources}
            disabled={resource.apiGroup === undefined}
            showAllOption={false}
            allowCustomValue={true}
            customValueLabel='Use "{value}"'
            onCustomValue={(value) => {
              setCustomKind(true);
              onChange({ ...resource, kind: value });
            }}
          />
        ) : (
          <div className="flex gap-2">
            <Input
              id="resource-kind"
              type="text"
              className="flex-1"
              value={resource.kind}
              onChange={handleKindInputChange}
              placeholder={resource.apiGroup !== undefined ? 'e.g., HTTPProxy' : 'Select API Group first'}
              disabled={resource.apiGroup === undefined}
            />
            {client && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleBackToSelect('kind')}
                title="Back to select"
              >
                Back to list
              </Button>
            )}
          </div>
        )}
        <div className="mt-1.5 text-xs text-muted-foreground">
          The Kubernetes resource kind (e.g., HTTPProxy, Gateway, Deployment)
        </div>
      </div>

      {/* Kind Label (optional) */}
      <div className="mb-5 last:mb-0">
        <Label htmlFor="resource-kindLabel" className="mb-1.5 block text-foreground/80">
          Kind Label
        </Label>
        <Input
          id="resource-kindLabel"
          type="text"
          value={resource.kindLabel || ''}
          onChange={handleKindLabelChange}
          placeholder={derivedKindLabel || 'Auto-derived from Kind'}
        />
        <div className="mt-1.5 text-xs text-muted-foreground">
          Human-readable label for the kind. Used in activity summaries.
          {derivedKindLabel && !resource.kindLabel && (
            <span className="font-medium text-emerald-600"> Default: &quot;{derivedKindLabel}&quot;</span>
          )}
        </div>
      </div>

      {/* Kind Label Plural (optional) */}
      <div className="mb-5 last:mb-0">
        <Label htmlFor="resource-kindLabelPlural" className="mb-1.5 block text-foreground/80">
          Kind Label (Plural)
        </Label>
        <Input
          id="resource-kindLabelPlural"
          type="text"
          value={resource.kindLabelPlural || ''}
          onChange={handleKindLabelPluralChange}
          placeholder={derivedPluralLabel || 'Auto-derived from Kind Label'}
        />
        <div className="mt-1.5 text-xs text-muted-foreground">
          Plural form of the kind label.
          {derivedPluralLabel && !resource.kindLabelPlural && (
            <span className="font-medium text-emerald-600"> Default: &quot;{derivedPluralLabel}&quot;</span>
          )}
        </div>
      </div>
    </div>
  );
}
