import type { AuditLogQuery, AuditLogQuerySpec } from '../types';
import type {
  Activity,
  ActivityList,
  ActivityListParams,
  ActivityFacetQuery,
  ActivityFacetQuerySpec,
  AuditLogFacetsQuery,
  AuditLogFacetsQuerySpec,
  WatchEvent,
} from '../types/activity';
import type {
  ActivityPolicy,
  ActivityPolicySpec,
  ActivityPolicyList,
  PolicyPreview,
  PolicyPreviewSpec,
} from '../types/policy';

/**
 * API Group information from Kubernetes discovery
 */
export interface APIGroup {
  name: string;
  versions: { groupVersion: string; version: string }[];
  preferredVersion?: { groupVersion: string; version: string };
}

/**
 * API Resource information from Kubernetes discovery
 */
export interface APIResource {
  name: string;
  singularName: string;
  namespaced: boolean;
  kind: string;
  verbs: string[];
  shortNames?: string[];
  categories?: string[];
}

export interface ApiClientConfig {
  /**
   * Base URL of the Activity API server
   * Example: 'https://api.example.com'
   */
  baseUrl: string;

  /**
   * Optional bearer token for authentication
   */
  token?: string;

  /**
   * Custom fetch implementation (useful for testing)
   */
  fetch?: typeof fetch;
}

export class ActivityApiClient {
  private config: ApiClientConfig;

  constructor(config: ApiClientConfig) {
    this.config = {
      ...config,
      fetch: config.fetch || globalThis.fetch.bind(globalThis),
    };
  }

  /**
   * Create a new AuditLogQuery
   */
  async createQuery(
    name: string,
    spec: AuditLogQuerySpec
  ): Promise<AuditLogQuery> {
    const query: AuditLogQuery = {
      apiVersion: 'activity.miloapis.com/v1alpha1',
      kind: 'AuditLogQuery',
      metadata: { name },
      spec,
    };

    const response = await this.fetch(
      '/apis/activity.miloapis.com/v1alpha1/auditlogqueries',
      {
        method: 'POST',
        body: JSON.stringify(query),
      }
    );

    return response.json();
  }

  /**
   * Execute a query and get results with automatic pagination
   */
  async *executeQueryPaginated(
    spec: AuditLogQuerySpec,
    options?: {
      maxPages?: number;
      queryNamePrefix?: string;
    }
  ): AsyncGenerator<AuditLogQuery> {
    let pageNum = 0;
    let currentSpec = { ...spec };
    const maxPages = options?.maxPages || 100;
    const namePrefix = options?.queryNamePrefix || 'query';

    while (pageNum < maxPages) {
      const queryName = `${namePrefix}-${Date.now()}-${pageNum}`;
      const result = await this.createQuery(queryName, currentSpec);

      yield result;

      // Check if there are more results
      if (!result.status?.continueAfter) {
        break;
      }

      currentSpec = {
        ...currentSpec,
        continueAfter: result.status.continueAfter,
      };
      pageNum++;
    }
  }

  // ============================================
  // Activity API Methods
  // ============================================

  /**
   * List activities with optional filtering and pagination
   */
  async listActivities(params?: ActivityListParams): Promise<ActivityList> {
    const searchParams = new URLSearchParams();

    if (params?.filter) searchParams.set('filter', params.filter);
    if (params?.fieldSelector) searchParams.set('fieldSelector', params.fieldSelector);
    if (params?.labelSelector) searchParams.set('labelSelector', params.labelSelector);
    if (params?.search) searchParams.set('search', params.search);
    if (params?.start) searchParams.set('start', params.start);
    if (params?.end) searchParams.set('end', params.end);
    if (params?.changeSource) searchParams.set('changeSource', params.changeSource);
    if (params?.limit) searchParams.set('limit', String(params.limit));
    if (params?.continue) searchParams.set('continue', params.continue);

    const queryString = searchParams.toString();
    const path = `/apis/activity.miloapis.com/v1alpha1/activities${queryString ? `?${queryString}` : ''}`;

    const response = await this.fetch(path);
    return response.json();
  }

  /**
   * Get a specific activity by name
   */
  async getActivity(namespace: string, name: string): Promise<Activity> {
    const response = await this.fetch(
      `/apis/activity.miloapis.com/v1alpha1/namespaces/${namespace}/activities/${name}`
    );
    return response.json();
  }

  /**
   * Query facets for filtering UI (autocomplete, distinct values)
   */
  async queryFacets(spec: ActivityFacetQuerySpec): Promise<ActivityFacetQuery> {
    const query: ActivityFacetQuery = {
      apiVersion: 'activity.miloapis.com/v1alpha1',
      kind: 'ActivityFacetQuery',
      spec,
    };

    const response = await this.fetch(
      '/apis/activity.miloapis.com/v1alpha1/activityfacetqueries',
      {
        method: 'POST',
        body: JSON.stringify(query),
      }
    );

    return response.json();
  }

  /**
   * List activities with automatic pagination using async generator
   */
  async *listActivitiesPaginated(
    params?: ActivityListParams,
    options?: {
      maxPages?: number;
    }
  ): AsyncGenerator<ActivityList> {
    let currentParams = { ...params };
    const maxPages = options?.maxPages || 100;
    let pageNum = 0;

    while (pageNum < maxPages) {
      const result = await this.listActivities(currentParams);

      yield result;

      // Check if there are more results
      if (!result.metadata?.continue) {
        break;
      }

      currentParams = {
        ...currentParams,
        continue: result.metadata.continue,
      };
      pageNum++;
    }
  }

  /**
   * Watch activities in real-time using the Kubernetes watch API.
   * Returns an async generator that yields watch events as they arrive.
   *
   * @param params - Query parameters (filter, start, end, etc.)
   * @param options - Watch options
   * @returns AsyncGenerator of watch events and an abort function
   */
  watchActivities(
    params?: Omit<ActivityListParams, 'watch'>,
    options?: {
      /** Resource version to start watching from */
      resourceVersion?: string;
      /** Callback when an event is received */
      onEvent?: (event: WatchEvent<Activity>) => void;
      /** Callback when an error occurs */
      onError?: (error: Error) => void;
      /** Callback when the connection closes */
      onClose?: () => void;
    }
  ): { stop: () => void } {
    const abortController = new AbortController();

    // Build URL with watch=true
    const searchParams = new URLSearchParams();
    searchParams.set('watch', 'true');

    if (params?.filter) searchParams.set('filter', params.filter);
    if (params?.fieldSelector) searchParams.set('fieldSelector', params.fieldSelector);
    if (params?.labelSelector) searchParams.set('labelSelector', params.labelSelector);
    if (params?.search) searchParams.set('search', params.search);
    if (params?.start) searchParams.set('start', params.start);
    if (params?.end) searchParams.set('end', params.end);
    if (params?.changeSource) searchParams.set('changeSource', params.changeSource);
    if (options?.resourceVersion) searchParams.set('resourceVersion', options.resourceVersion);

    const queryString = searchParams.toString();
    const path = `/apis/activity.miloapis.com/v1alpha1/activities?${queryString}`;
    const url = `${this.config.baseUrl}${path}`;

    const headers: Record<string, string> = {
      'Accept': 'application/json',
    };

    if (this.config.token) {
      headers['Authorization'] = `Bearer ${this.config.token}`;
    }

    // Start the watch connection
    const startWatch = async () => {
      try {
        const response = await this.config.fetch!(url, {
          headers,
          signal: abortController.signal,
        });

        if (!response.ok) {
          const error = await response.text();
          throw new Error(`Watch request failed: ${response.status} ${error}`);
        }

        if (!response.body) {
          throw new Error('Response body is not available');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            options?.onClose?.();
            break;
          }

          buffer += decoder.decode(value, { stream: true });

          // Process complete lines (newline-delimited JSON)
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // Keep incomplete line in buffer

          for (const line of lines) {
            if (line.trim()) {
              try {
                const event = JSON.parse(line) as WatchEvent<Activity>;
                options?.onEvent?.(event);
              } catch (parseError) {
                console.warn('Failed to parse watch event:', parseError, line);
              }
            }
          }
        }
      } catch (error) {
        if ((error as Error).name === 'AbortError') {
          options?.onClose?.();
          return;
        }
        options?.onError?.(error as Error);
      }
    };

    // Start watching in background
    startWatch();

    return {
      stop: () => abortController.abort(),
    };
  }

  /**
   * Watch activities using an async generator pattern.
   * This is an alternative API that yields events as they arrive.
   *
   * @param params - Query parameters (filter, start, end, etc.)
   * @param resourceVersion - Resource version to start watching from
   * @returns AsyncGenerator of watch events
   */
  async *watchActivitiesGenerator(
    params?: Omit<ActivityListParams, 'watch'>,
    resourceVersion?: string
  ): AsyncGenerator<WatchEvent<Activity>> {
    const abortController = new AbortController();

    // Build URL with watch=true
    const searchParams = new URLSearchParams();
    searchParams.set('watch', 'true');

    if (params?.filter) searchParams.set('filter', params.filter);
    if (params?.fieldSelector) searchParams.set('fieldSelector', params.fieldSelector);
    if (params?.labelSelector) searchParams.set('labelSelector', params.labelSelector);
    if (params?.search) searchParams.set('search', params.search);
    if (params?.start) searchParams.set('start', params.start);
    if (params?.end) searchParams.set('end', params.end);
    if (params?.changeSource) searchParams.set('changeSource', params.changeSource);
    if (resourceVersion) searchParams.set('resourceVersion', resourceVersion);

    const queryString = searchParams.toString();
    const path = `/apis/activity.miloapis.com/v1alpha1/activities?${queryString}`;
    const url = `${this.config.baseUrl}${path}`;

    const headers: Record<string, string> = {
      'Accept': 'application/json',
    };

    if (this.config.token) {
      headers['Authorization'] = `Bearer ${this.config.token}`;
    }

    try {
      const response = await this.config.fetch!(url, {
        headers,
        signal: abortController.signal,
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Watch request failed: ${response.status} ${error}`);
      }

      if (!response.body) {
        throw new Error('Response body is not available');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });

        // Process complete lines (newline-delimited JSON)
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.trim()) {
            const event = JSON.parse(line) as WatchEvent<Activity>;
            yield event;
          }
        }
      }
    } finally {
      abortController.abort();
    }
  }

  // ============================================
  // ActivityPolicy API Methods
  // ============================================

  /**
   * List all ActivityPolicies
   */
  async listPolicies(): Promise<ActivityPolicyList> {
    const response = await this.fetch(
      '/apis/activity.miloapis.com/v1alpha1/activitypolicies'
    );
    return response.json();
  }

  /**
   * Get a specific ActivityPolicy by name
   */
  async getPolicy(name: string): Promise<ActivityPolicy> {
    const response = await this.fetch(
      `/apis/activity.miloapis.com/v1alpha1/activitypolicies/${name}`
    );
    return response.json();
  }

  /**
   * Create a new ActivityPolicy
   * @param name Policy name
   * @param spec Policy specification
   * @param dryRun If true, validate without persisting
   */
  async createPolicy(
    name: string,
    spec: ActivityPolicySpec,
    dryRun?: boolean
  ): Promise<ActivityPolicy> {
    const policy: ActivityPolicy = {
      apiVersion: 'activity.miloapis.com/v1alpha1',
      kind: 'ActivityPolicy',
      metadata: { name },
      spec,
    };

    const searchParams = new URLSearchParams();
    if (dryRun) {
      searchParams.set('dryRun', 'All');
    }

    const queryString = searchParams.toString();
    const path = `/apis/activity.miloapis.com/v1alpha1/activitypolicies${queryString ? `?${queryString}` : ''}`;

    const response = await this.fetch(path, {
      method: 'POST',
      body: JSON.stringify(policy),
    });

    return response.json();
  }

  /**
   * Update an existing ActivityPolicy
   * @param name Policy name
   * @param spec Policy specification
   * @param dryRun If true, validate without persisting
   * @param resourceVersion Optional resource version for optimistic concurrency
   */
  async updatePolicy(
    name: string,
    spec: ActivityPolicySpec,
    dryRun?: boolean,
    resourceVersion?: string
  ): Promise<ActivityPolicy> {
    const policy: ActivityPolicy = {
      apiVersion: 'activity.miloapis.com/v1alpha1',
      kind: 'ActivityPolicy',
      metadata: {
        name,
        ...(resourceVersion ? { resourceVersion } : {}),
      },
      spec,
    };

    const searchParams = new URLSearchParams();
    if (dryRun) {
      searchParams.set('dryRun', 'All');
    }

    const queryString = searchParams.toString();
    const path = `/apis/activity.miloapis.com/v1alpha1/activitypolicies/${name}${queryString ? `?${queryString}` : ''}`;

    const response = await this.fetch(path, {
      method: 'PUT',
      body: JSON.stringify(policy),
    });

    return response.json();
  }

  /**
   * Delete an ActivityPolicy by name
   */
  async deletePolicy(name: string): Promise<void> {
    await this.fetch(
      `/apis/activity.miloapis.com/v1alpha1/activitypolicies/${name}`,
      { method: 'DELETE' }
    );
  }

  // ============================================
  // API Discovery Methods
  // ============================================

  /**
   * Discover all API groups available in the cluster
   */
  async discoverAPIGroups(): Promise<{ groups: APIGroup[] }> {
    const response = await this.fetch('/apis');
    return response.json();
  }

  /**
   * Discover resources for a specific API group
   */
  async discoverAPIResources(
    group: string,
    version?: string
  ): Promise<{ resources: APIResource[] }> {
    // If no version specified, try to get the preferred version first
    let apiVersion = version;
    if (!apiVersion) {
      try {
        const groupsResponse = await this.discoverAPIGroups();
        const groupInfo = groupsResponse.groups?.find((g) => g.name === group);
        apiVersion = groupInfo?.preferredVersion?.version || 'v1';
      } catch {
        apiVersion = 'v1';
      }
    }

    const response = await this.fetch(`/apis/${group}/${apiVersion}`);
    return response.json();
  }

  // ============================================
  // Audit Log Facets API Methods
  // ============================================

  /**
   * Query facets from audit logs (API groups, resources, verbs, etc.)
   * This is an ephemeral resource that executes immediately and returns results.
   */
  async queryAuditLogFacets(spec: AuditLogFacetsQuerySpec): Promise<AuditLogFacetsQuery> {
    const query: AuditLogFacetsQuery = {
      apiVersion: 'activity.miloapis.com/v1alpha1',
      kind: 'AuditLogFacetsQuery',
      spec,
    };

    const response = await this.fetch(
      '/apis/activity.miloapis.com/v1alpha1/auditlogfacetsqueries',
      {
        method: 'POST',
        body: JSON.stringify(query),
      }
    );

    return response.json();
  }

  /**
   * Get all API groups that have audit log data
   * Uses the AuditLogFacetsQuery API to discover API groups from actual audit logs.
   */
  async getAuditedAPIGroups(): Promise<string[]> {
    try {
      const result = await this.queryAuditLogFacets({
        timeRange: { start: 'now-30d' },
        facets: [{ field: 'objectRef.apiGroup', limit: 100 }],
      });
      const apiGroupFacet = result.status?.facets?.find(f => f.field === 'objectRef.apiGroup');
      return apiGroupFacet?.values?.map(v => v.value).filter(v => v) || [];
    } catch {
      return [];
    }
  }

  /**
   * Get resource types for an API group that have audit log data
   * Uses the AuditLogFacetsQuery API to discover resources from actual audit logs.
   */
  async getAuditedResources(apiGroup: string): Promise<string[]> {
    try {
      const result = await this.queryAuditLogFacets({
        timeRange: { start: 'now-30d' },
        filter: `objectRef.apiGroup == "${apiGroup}"`,
        facets: [{ field: 'objectRef.resource', limit: 100 }],
      });
      const resourceFacet = result.status?.facets?.find(f => f.field === 'objectRef.resource');
      return resourceFacet?.values?.map(v => v.value).filter(v => v) || [];
    } catch {
      return [];
    }
  }

  // ============================================
  // PolicyPreview API Methods
  // ============================================

  /**
   * Create a PolicyPreview to test a policy against sample input
   * This is a virtual resource that executes immediately and returns results
   */
  async createPolicyPreview(spec: PolicyPreviewSpec): Promise<PolicyPreview> {
    const preview: PolicyPreview = {
      apiVersion: 'activity.miloapis.com/v1alpha1',
      kind: 'PolicyPreview',
      spec,
    };

    const response = await this.fetch(
      '/apis/activity.miloapis.com/v1alpha1/policypreviews',
      {
        method: 'POST',
        body: JSON.stringify(preview),
      }
    );

    return response.json();
  }

  private async fetch(path: string, init?: RequestInit): Promise<Response> {
    const url = `${this.config.baseUrl}${path}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(init?.headers as Record<string, string> || {}),
    };

    if (this.config.token) {
      headers['Authorization'] = `Bearer ${this.config.token}`;
    }

    const response = await this.config.fetch!(url, {
      ...init,
      headers,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API request failed: ${response.status} ${error}`);
    }

    return response;
  }
}
