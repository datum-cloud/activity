import type { AuditLogQuery, AuditLogQuerySpec } from '../types';

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
   * Get an existing AuditLogQuery by name
   */
  async getQuery(name: string): Promise<AuditLogQuery> {
    const response = await this.fetch(
      `/apis/activity.miloapis.com/v1alpha1/auditlogqueries/${name}`
    );
    return response.json();
  }

  /**
   * List all AuditLogQueries
   */
  async listQueries(): Promise<{ items: AuditLogQuery[] }> {
    const response = await this.fetch(
      '/apis/activity.miloapis.com/v1alpha1/auditlogqueries'
    );
    return response.json();
  }

  /**
   * Delete an AuditLogQuery by name
   */
  async deleteQuery(name: string): Promise<void> {
    await this.fetch(
      `/apis/activity.miloapis.com/v1alpha1/auditlogqueries/${name}`,
      { method: 'DELETE' }
    );
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

      // Clean up the query
      try {
        await this.deleteQuery(queryName);
      } catch (e) {
        console.warn('Failed to delete query:', e);
      }

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
