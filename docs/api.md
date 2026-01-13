# API Reference

## Packages
- [activity.miloapis.com/v1alpha1](#activitymiloapiscomv1alpha1)


## activity.miloapis.com/v1alpha1

Package v1alpha1 contains API Schema definitions for the activity v1alpha1 API group




#### AuditLogQuery



AuditLogQuery searches your control plane's audit logs.


Use this to investigate incidents, track resource changes, generate compliance reports,
or analyze user activity. Results are returned in the Status field, ordered newest-first.


Quick Start:


	apiVersion: activity.miloapis.com/v1alpha1
	kind: AuditLogQuery
	metadata:
	  name: recent-deletions
	spec:
	  startTime: "now-30d"       # last 30 days
	  endTime: "now"
	  filter: "verb == 'delete'" # optional: narrow your search
	  limit: 100


Time Formats:
- Relative: "now-30d" (great for dashboards and recurring queries)
- Absolute: "2024-01-01T00:00:00Z" (great for historical analysis)



_Appears in:_
- [AuditLogQueryList](#auditlogquerylist)

| Field | Description | Default | Validation |
| --- | --- | --- | --- |
| `metadata` _[ObjectMeta](https://kubernetes.io/docs/reference/generated/kubernetes-api/v/#objectmeta-v1-meta)_ | Refer to Kubernetes API documentation for fields of `metadata`. |  |  |
| `spec` _[AuditLogQuerySpec](#auditlogqueryspec)_ |  |  |  |
| `status` _[AuditLogQueryStatus](#auditlogquerystatus)_ |  |  |  |




#### AuditLogQuerySpec



AuditLogQuerySpec defines the search parameters.


Required: startTime and endTime define your search window.
Optional: filter (narrow results), limit (page size, default 100), continue (pagination).


Performance: Smaller time ranges and specific filters perform better. The maximum time window
is typically 30 days. If your range is too large, you'll get an error with guidance on splitting
your query into smaller chunks.



_Appears in:_
- [AuditLogQuery](#auditlogquery)

| Field | Description | Default | Validation |
| --- | --- | --- | --- |
| `startTime` _string_ | StartTime is the beginning of your search window (inclusive).<br /><br />Format Options:<br />- Relative: "now-30d", "now-2h", "now-30m" (units: s, m, h, d, w)<br />  Use for dashboards and recurring queries - they adjust automatically.<br />- Absolute: "2024-01-01T00:00:00Z" (RFC3339 with timezone)<br />  Use for historical analysis of specific time periods.<br /><br />Examples:<br />  "now-30d"                     → 30 days ago<br />  "2024-06-15T14:30:00-05:00"   → specific time with timezone offset |  |  |
| `endTime` _string_ | EndTime is the end of your search window (exclusive).<br /><br />Uses the same formats as StartTime. Commonly "now" for current moment.<br />Must be greater than StartTime.<br /><br />Examples:<br />  "now"                  → current time<br />  "2024-01-02T00:00:00Z" → specific end point |  |  |
| `filter` _string_ | Filter narrows results using CEL (Common Expression Language). Leave empty to get all events.<br /><br />Available Fields:<br />  verb               - API action: get, list, create, update, patch, delete, watch<br />  auditID            - unique event identifier<br />  stageTimestamp     - when this stage occurred (RFC3339 timestamp)<br />  user.username      - who made the request (user or service account)<br />  responseStatus.code - HTTP response code (200, 201, 404, 500, etc.)<br />  objectRef.namespace - target resource namespace<br />  objectRef.resource  - resource type (pods, deployments, secrets, configmaps, etc.)<br />  objectRef.name     - specific resource name<br /><br />Operators: ==, !=, <, >, <=, >=, &&, \|\|, in<br />String Functions: startsWith(), endsWith(), contains()<br /><br />Common Patterns:<br />  "verb == 'delete'"                                    - All deletions<br />  "objectRef.namespace == 'production'"                 - Activity in production namespace<br />  "verb in ['create', 'update', 'delete', 'patch']"     - All write operations<br />  "responseStatus.code >= 400"                          - Failed requests<br />  "user.username.startsWith('system:serviceaccount:')"  - Service account activity<br />  "objectRef.resource == 'secrets'"                     - Secret access<br />  "verb == 'delete' && objectRef.namespace == 'production'" - Production deletions<br /><br />Note: Use single quotes for strings. Field names are case-sensitive.<br />CEL reference: https://cel.dev |  |  |
| `limit` _integer_ | Limit sets the maximum number of results per page.<br />Default: 100, Maximum: 1000.<br /><br />Use smaller values (10-50) for exploration, larger (500-1000) for data collection.<br />Use continue to fetch additional pages. |  |  |
| `continue` _string_ | Continue is the pagination cursor for fetching additional pages.<br /><br />Leave empty for the first page. If status.continue is non-empty after a query,<br />copy that value here in a new query with identical parameters to get the next page.<br />Repeat until status.continue is empty.<br /><br />Important: Keep all other parameters (startTime, endTime, filter, limit) identical<br />across paginated requests. The cursor is opaque - copy it exactly without modification. |  |  |


#### AuditLogQueryStatus



AuditLogQueryStatus contains the query results and pagination state.



_Appears in:_
- [AuditLogQuery](#auditlogquery)

| Field | Description | Default | Validation |
| --- | --- | --- | --- |
| `results` _Event array_ | Results contains matching audit events, sorted newest-first.<br /><br />Each event follows the Kubernetes audit.Event format with fields like:<br />  verb, user.username, objectRef.\{namespace,resource,name\}, stageTimestamp,<br />  responseStatus.code, requestObject, responseObject<br /><br />Empty results? Try broadening your filter or time range.<br />Full documentation: https://kubernetes.io/docs/reference/config-api/apiserver-audit.v1/ |  |  |
| `continue` _string_ | Continue is the pagination cursor.<br />Non-empty means more results are available - copy this to spec.continue for the next page.<br />Empty means you have all results. |  |  |
| `effectiveStartTime` _string_ | EffectiveStartTime is the actual start time used for this query (RFC3339 format).<br /><br />When you use relative times like "now-7d", this shows the exact timestamp that was<br />calculated. Useful for understanding exactly what time range was queried, especially<br />for auditing, debugging, or recreating queries with absolute timestamps.<br /><br />Example: If you query with startTime="now-7d" at 2025-12-17T12:00:00Z,<br />this will be "2025-12-10T12:00:00Z". |  |  |
| `effectiveEndTime` _string_ | EffectiveEndTime is the actual end time used for this query (RFC3339 format).<br /><br />When you use relative times like "now", this shows the exact timestamp that was<br />calculated. Useful for understanding exactly what time range was queried.<br /><br />Example: If you query with endTime="now" at 2025-12-17T12:00:00Z,<br />this will be "2025-12-17T12:00:00Z". |  |  |


