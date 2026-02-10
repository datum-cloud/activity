import { useMemo, useState, useEffect, useCallback } from 'react';
import type { ActivityPolicyResource } from '../types/policy';
import type { ActivityApiClient } from '../api/client';
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

  // Load API groups that have audit events
  const loadApiGroups = useCallback(async () => {
    if (!client) return;
    setIsLoadingGroups(true);
    try {
      const groups = await client.getAuditedAPIGroups();
      setApiGroups(groups.filter((g) => g)); // Filter out empty strings
    } catch (err) {
      console.error('Failed to load API groups:', err);
    } finally {
      setIsLoadingGroups(false);
    }
  }, [client]);

  // Load resources for the selected API group
  const loadResources = useCallback(async () => {
    if (!client || !resource.apiGroup) {
      setResources([]);
      return;
    }
    setIsLoadingResources(true);
    try {
      // Get audited resource names from audit logs
      const auditedResources = await client.getAuditedResources(resource.apiGroup);

      // Get the actual Kind from Kubernetes API discovery
      let resourceMap = new Map<string, string>();
      try {
        const discoveryResult = await client.discoverAPIResources(resource.apiGroup);
        resourceMap = new Map(
          discoveryResult.resources?.map((r) => [r.name, r.kind]) || []
        );
      } catch {
        // API discovery not available - will use derived Kind names
      }

      // Combine audited resources with Kind names (from discovery or derived)
      const resourcesWithKind = auditedResources
        .filter((r) => r)
        .map((r) => ({
          name: r,
          kind: resourceMap.get(r) || resourceToKind(r),
        }));

      setResources(resourcesWithKind);
    } catch (err) {
      console.error('Failed to load resources:', err);
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

  // Load resources when API group changes
  useEffect(() => {
    if (client && resource.apiGroup) {
      loadResources();
    }
  }, [client, resource.apiGroup, loadResources]);

  // Check if current value is in the list (for determining if custom mode is needed)
  useEffect(() => {
    if (resource.apiGroup && apiGroups.length > 0 && !apiGroups.includes(resource.apiGroup)) {
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

  const handleApiGroupSelectChange = (value: string) => {
    if (value === CUSTOM_VALUE) {
      setCustomApiGroup(true);
    } else {
      setCustomApiGroup(false);
      onChange({ ...resource, apiGroup: value, kind: '' }); // Clear kind when group changes
    }
  };

  const handleApiGroupInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ ...resource, apiGroup: e.target.value, kind: '' }); // Clear kind when group changes
  };

  const handleKindSelectChange = (value: string) => {
    if (value === CUSTOM_VALUE) {
      setCustomKind(true);
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
      onChange({ ...resource, apiGroup: '', kind: '' });
    } else {
      setCustomKind(false);
      onChange({ ...resource, kind: '' });
    }
  };

  // Check if current apiGroup is in the list
  const apiGroupInList = apiGroups.includes(resource.apiGroup);

  // Find matching resource for current kind
  const currentResourceName = resources.find((r) => r.kind === resource.kind)?.name || '';

  return (
    <div className={`rounded-lg bg-muted p-6 ${className}`}>
      <h4 className="mb-2 text-base font-medium text-foreground">Resource Target</h4>
      <p className="mb-6 text-sm text-muted-foreground">
        Define which API group and kind this policy applies to.
        {client && (
          <span className="italic text-muted-foreground/70">
            {' '}Options based on audit events in your cluster.
          </span>
        )}
      </p>

      {/* API Group */}
      <div className="mb-5 last:mb-0">
        <Label htmlFor="resource-apiGroup" className="mb-1.5 block text-foreground/80">
          API Group <span className="text-destructive">*</span>
        </Label>
        {client && !customApiGroup ? (
          <div className="relative">
            <Select
              value={apiGroupInList ? resource.apiGroup : ''}
              onValueChange={handleApiGroupSelectChange}
              disabled={isLoadingGroups}
            >
              <SelectTrigger className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm transition-all duration-200 focus:border-[#BF9595] focus:outline-none focus:ring-[3px] focus:ring-[#BF9595]/10 disabled:cursor-not-allowed disabled:opacity-50">
                <SelectValue placeholder={isLoadingGroups ? "Loading..." : "Select an API Group..."} />
              </SelectTrigger>
              <SelectContent>
                {apiGroups.length === 0 && !isLoadingGroups && (
                  <SelectItem value={CUSTOM_VALUE} disabled className="italic text-muted-foreground">
                    No API groups found
                  </SelectItem>
                )}
                {apiGroups.map((group) => (
                  <SelectItem key={group} value={group}>
                    {group}
                  </SelectItem>
                ))}
                <SelectItem value={CUSTOM_VALUE} className="italic text-muted-foreground">
                  Enter custom value...
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        ) : (
          <div className="flex gap-2">
            <Input
              id="resource-apiGroup"
              type="text"
              className="flex-1"
              value={resource.apiGroup}
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
          <div className="relative">
            <Select
              value={currentResourceName}
              onValueChange={handleKindSelectChange}
              disabled={isLoadingResources || !resource.apiGroup}
            >
              <SelectTrigger className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm transition-all duration-200 focus:border-[#BF9595] focus:outline-none focus:ring-[3px] focus:ring-[#BF9595]/10 disabled:cursor-not-allowed disabled:opacity-50">
                <SelectValue
                  placeholder={
                    !resource.apiGroup
                      ? 'Select API Group first...'
                      : isLoadingResources
                      ? 'Loading...'
                      : 'Select a Kind...'
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {resources.length === 0 && resource.apiGroup && !isLoadingResources && (
                  <SelectItem value={CUSTOM_VALUE} disabled className="italic text-muted-foreground">
                    No resources found
                  </SelectItem>
                )}
                {resources.map((res) => (
                  <SelectItem key={res.name} value={res.name}>
                    {res.kind}
                  </SelectItem>
                ))}
                <SelectItem value={CUSTOM_VALUE} className="italic text-muted-foreground">
                  Enter custom value...
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        ) : (
          <div className="flex gap-2">
            <Input
              id="resource-kind"
              type="text"
              className="flex-1"
              value={resource.kind}
              onChange={handleKindInputChange}
              placeholder={resource.apiGroup ? 'e.g., HTTPProxy' : 'Select API Group first'}
              disabled={!resource.apiGroup}
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
