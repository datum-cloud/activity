---
id: feat-005-job
title: ReindexJob Kubernetes Job Architecture
status: draft
created: 2026-02-27
author: architect
---

# ReindexJob Kubernetes Job Architecture

## Overview

This design refactors the ReindexJob controller to execute reindex operations as Kubernetes Jobs instead of running them in-process in the controller-manager. This solves critical reliability and resource management issues discovered during production use:

- **OOMKilled on large batches**: Controller-manager pod was killed when processing large reindex operations
- **No recovery after crash**: In-process workers cannot resume if the controller restarts mid-job
- **Resource contention**: Heavy reindex work interferes with normal controller operations

## Requirements

### Functional Requirements

- FR1: ReindexJob controller creates a Kubernetes Job to execute reindex work
- FR2: Job runs the `activity reindex-worker` subcommand with job parameters
- FR3: Job reports progress back to ReindexJob status
- FR4: Controller synchronizes Job status to ReindexJob status
- FR5: Jobs are automatically cleaned up after completion (configurable TTL)
- FR6: Concurrency control limits simultaneous reindex Jobs (default: 1)

### Non-Functional Requirements

- NFR1: Jobs run with configurable resource limits (memory/CPU)
- NFR2: Jobs can recover from pod restarts (idempotent operations)
- NFR3: Controller continues normal operations while Jobs run
- NFR4: Clear failure diagnostics via Job events and logs
- NFR5: Minimal code changes to existing reindex logic

## Design

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                     ReindexJob Lifecycle                             │
└─────────────────────────────────────────────────────────────────────┘

1. Operator creates ReindexJob resource
   ↓
2. Controller watches ReindexJob, sees new resource
   ↓
3. Controller creates Kubernetes Job with Job template
   ↓
4. Kubernetes schedules Job pod
   ┌────────────────────────────────────────────────────────────┐
   │  Job Pod (activity reindex-worker)                         │
   │  ┌──────────────────────────────────────────────────────┐ │
   │  │  1. Parse ReindexJob name from args                  │ │
   │  │  2. Fetch ReindexJob spec from API server            │ │
   │  │  3. Run reindexer with OnProgress callback           │ │
   │  │  4. Update ReindexJob status after each batch        │ │
   │  │  5. Mark job Succeeded/Failed on completion          │ │
   │  └──────────────────────────────────────────────────────┘ │
   │                                                            │
   │  Resource Limits:                                          │
   │  - Memory: 2Gi (configurable via ReindexJob)             │
   │  - CPU: 1000m (configurable)                              │
   │                                                            │
   │  Restart Policy: OnFailure (Kubernetes retries failures) │
   └────────────────────────────────────────────────────────────┘
   ↓
5. Controller watches Job, syncs status to ReindexJob
   ↓
6. Job completes (Succeeded/Failed)
   ↓
7. Controller updates ReindexJob final status
   ↓
8. Controller deletes Job after TTL (if configured)
```

### Component Changes

#### 1. ReindexJob Controller (Modified)

**File:** `internal/controller/reindexjob_controller.go`

**Responsibilities:**
- Watch ReindexJob resources
- Create Kubernetes Job for new ReindexJobs
- Watch Jobs and sync status to ReindexJob
- Enforce concurrency limits (count running Jobs)
- Clean up completed Jobs based on TTL
- Emit Kubernetes events for lifecycle milestones

**Key Changes:**
```go
// Remove: In-process worker goroutine (runReindexWorker)
// Remove: Direct dependency on internal/reindex package
// Add: Job creation from template
// Add: Job status synchronization
// Add: Job cleanup logic
```

**Concurrency Control:**
- Count running Jobs across the cluster
- Queue new ReindexJobs in Pending state if limit reached
- Default limit: 1 (configurable via controller flag `--max-concurrent-reindex-jobs`)

#### 2. Reindex Worker Subcommand (New)

**File:** `cmd/activity/reindex_worker.go`

A new subcommand that executes the actual reindex work:

```go
func NewReindexWorkerCommand() *cobra.Command {
    cmd := &cobra.Command{
        Use:   "reindex-worker <reindexjob-name>",
        Short: "Execute a ReindexJob (runs in Kubernetes Job pod)",
        Args:  cobra.ExactArgs(1),
        RunE: func(cmd *cobra.Command, args []string) error {
            jobName := args[0]
            return runReindexWorker(cmd.Context(), jobName)
        },
    }

    // Flags for ClickHouse, NATS, etc. (same as apiserver)
    cmd.Flags().String("clickhouse-address", "localhost:9000", "...")
    cmd.Flags().String("nats-url", "", "...")
    // ... other flags

    return cmd
}

func runReindexWorker(ctx context.Context, jobName string) error {
    // 1. Build Kubernetes client (in-cluster config)
    config, err := rest.InClusterConfig()
    if err != nil {
        return fmt.Errorf("failed to get in-cluster config: %w", err)
    }

    client, err := client.New(config, client.Options{})
    if err != nil {
        return fmt.Errorf("failed to create client: %w", err)
    }

    // 2. Fetch ReindexJob resource
    var job v1alpha1.ReindexJob
    if err := client.Get(ctx, types.NamespacedName{Name: jobName}, &job); err != nil {
        return fmt.Errorf("failed to fetch ReindexJob %s: %w", jobName, err)
    }

    // 3. Build dependencies (ClickHouse, NATS)
    chClient, err := buildClickHouseClient(/* flags */)
    if err != nil {
        return fmt.Errorf("failed to connect to ClickHouse: %w", err)
    }

    jsCtx, err := buildNATSClient(/* flags */)
    if err != nil {
        return fmt.Errorf("failed to connect to NATS: %w", err)
    }

    // 4. Create reindexer and set up progress callback
    reindexer := reindex.NewReindexer(client, jsCtx)

    reindexer.OnProgress = func(progress reindex.Progress) {
        // Fetch latest version to avoid conflicts
        var latestJob v1alpha1.ReindexJob
        if err := client.Get(ctx, types.NamespacedName{Name: jobName}, &latestJob); err != nil {
            klog.ErrorS(err, "failed to fetch latest ReindexJob for progress update")
            return
        }

        // Update progress
        latestJob.Status.Progress = &v1alpha1.ReindexProgress{
            TotalEvents:         progress.TotalEvents,
            ProcessedEvents:     progress.ProcessedEvents,
            ActivitiesGenerated: progress.ActivitiesGenerated,
            Errors:              progress.Errors,
            CurrentBatch:        progress.CurrentBatch,
            TotalBatches:        progress.TotalBatches,
        }
        latestJob.Status.Message = fmt.Sprintf("Processing: %d/%d events",
            progress.ProcessedEvents, progress.TotalEvents)

        // Update status subresource
        if err := client.Status().Update(ctx, &latestJob); err != nil {
            klog.V(2).InfoS("failed to update progress (will retry)", "error", err)
        }
    }

    // 5. Parse time range and build options (same as current worker)
    opts := buildReindexOptions(&job)

    // 6. Update status to Running
    updateStatus(ctx, client, jobName, func(j *v1alpha1.ReindexJob) {
        j.Status.Phase = v1alpha1.ReindexJobRunning
        now := metav1.Now()
        j.Status.StartedAt = &now
    })

    // 7. Run reindexer
    err = reindexer.Run(ctx, opts)

    // 8. Update final status
    updateStatus(ctx, client, jobName, func(j *v1alpha1.ReindexJob) {
        now := metav1.Now()
        j.Status.CompletedAt = &now

        if err != nil {
            j.Status.Phase = v1alpha1.ReindexJobFailed
            j.Status.Message = fmt.Sprintf("Failed: %v", err)
        } else {
            j.Status.Phase = v1alpha1.ReindexJobSucceeded
            j.Status.Message = fmt.Sprintf("Completed: %d activities generated",
                j.Status.Progress.ActivitiesGenerated)
        }
    })

    if err != nil {
        return fmt.Errorf("reindex failed: %w", err)
    }

    return nil
}
```

**Key Points:**
- Runs as a standalone process in Job pod
- Uses in-cluster config to access Kubernetes API
- Fetches ReindexJob spec from API server (not passed as args)
- Updates ReindexJob status directly via API (status subresource)
- Returns exit code 0 (success) or non-zero (failure) for Job status

#### 3. Job Template

The controller creates a Job using this template:

```go
func (r *ReindexJobReconciler) buildJobForReindexJob(reindexJob *v1alpha1.ReindexJob) *batchv1.Job {
    // Resource limits (configurable via ReindexJob spec or controller defaults)
    memoryLimit := resource.MustParse("2Gi")
    cpuLimit := resource.MustParse("1000m")
    memoryRequest := resource.MustParse("512Mi")
    cpuRequest := resource.MustParse("500m")

    // Allow override via ReindexJob annotations
    if val, ok := reindexJob.Annotations["reindex.activity.miloapis.com/memory-limit"]; ok {
        memoryLimit = resource.MustParse(val)
    }
    if val, ok := reindexJob.Annotations["reindex.activity.miloapis.com/cpu-limit"]; ok {
        cpuLimit = resource.MustParse(val)
    }

    // Get image from controller environment (same image as controller-manager)
    image := os.Getenv("ACTIVITY_IMAGE")
    if image == "" {
        image = "ghcr.io/datum-cloud/activity:latest"
    }

    // Build Job
    job := &batchv1.Job{
        ObjectMeta: metav1.ObjectMeta{
            Name:      fmt.Sprintf("%s-job", reindexJob.Name),
            Namespace: r.JobNamespace, // Controller flag: --reindex-job-namespace
            Labels: map[string]string{
                "app":                                  "activity-reindex",
                "reindex.activity.miloapis.com/job":    reindexJob.Name,
            },
            // OwnerReference for automatic cleanup when ReindexJob is deleted
            // Note: Cross-namespace ownership is not supported, so we handle cleanup manually
        },
        Spec: batchv1.JobSpec{
            // Retry failed pods up to 3 times
            BackoffLimit: ptr.To(int32(3)),

            // Clean up completed pods after TTL
            TTLSecondsAfterFinished: ptr.To(int32(300)), // 5 minutes

            Template: corev1.PodTemplateSpec{
                ObjectMeta: metav1.ObjectMeta{
                    Labels: map[string]string{
                        "app": "activity-reindex",
                        "reindex.activity.miloapis.com/job": reindexJob.Name,
                    },
                },
                Spec: corev1.PodSpec{
                    RestartPolicy: corev1.RestartPolicyOnFailure,

                    ServiceAccountName: r.ReindexServiceAccount, // --reindex-service-account flag

                    Containers: []corev1.Container{
                        {
                            Name:  "reindex",
                            Image: image,
                            Command: []string{
                                "/activity",
                                "reindex-worker",
                                reindexJob.Name, // Pass ReindexJob name as arg
                            },
                            Args: buildReindexWorkerArgs(r), // ClickHouse, NATS config from controller env

                            Resources: corev1.ResourceRequirements{
                                Requests: corev1.ResourceList{
                                    corev1.ResourceMemory: memoryRequest,
                                    corev1.ResourceCPU:    cpuRequest,
                                },
                                Limits: corev1.ResourceList{
                                    corev1.ResourceMemory: memoryLimit,
                                    corev1.ResourceCPU:    cpuLimit,
                                },
                            },

                            // Environment variables for ClickHouse, NATS credentials
                            EnvFrom: []corev1.EnvFromSource{
                                {
                                    SecretRef: &corev1.SecretEnvSource{
                                        LocalObjectReference: corev1.LocalObjectReference{
                                            Name: "activity-reindex-credentials",
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },
    }

    return job
}

func buildReindexWorkerArgs(r *ReindexJobReconciler) []string {
    // Flags for worker: ClickHouse, NATS connection (read from controller env)
    return []string{
        "--clickhouse-address=" + r.ClickHouseAddress,
        "--clickhouse-database=" + r.ClickHouseDatabase,
        "--nats-url=" + r.NATSUrl,
        // TLS flags if configured
    }
}
```

**Job Configuration:**
- **Image**: Same as controller-manager (`ACTIVITY_IMAGE` env var)
- **ServiceAccount**: Dedicated SA with RBAC for ReindexJob updates
- **Resources**: Configurable via annotations (default: 2Gi mem, 1 CPU)
- **Backoff**: Retry failed pods up to 3 times
- **TTL**: Clean up pod after 5 minutes (Job persists longer)
- **Environment**: ClickHouse/NATS credentials from Secret

### Status Synchronization

**Option Chosen: Job updates ReindexJob status directly**

The worker pod has permissions to update the ReindexJob status subresource. This is simpler and provides real-time progress:

**Advantages:**
- Real-time progress updates (no polling delay)
- Worker knows exactly what progress to report
- Simpler controller logic (no status sync reconcile loop)

**Alternative (not chosen): Controller syncs Job to ReindexJob**
- Controller watches both ReindexJob and Job
- On Job status change, controller updates ReindexJob status
- More complex, requires mapping Job conditions to ReindexJob phases

### RBAC Requirements

#### Job ServiceAccount

**Name:** `activity-reindex-worker`

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: activity-reindex-worker
  namespace: activity-system
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: activity-reindex-worker
rules:
# Read ReindexJob spec
- apiGroups: ["activity.miloapis.com"]
  resources: ["reindexjobs"]
  verbs: ["get"]

# Update ReindexJob status
- apiGroups: ["activity.miloapis.com"]
  resources: ["reindexjobs/status"]
  verbs: ["update", "patch"]

# List ActivityPolicy resources
- apiGroups: ["activity.miloapis.com"]
  resources: ["activitypolicies"]
  verbs: ["get", "list"]

# Query audit logs and events via API
- apiGroups: ["activity.miloapis.com"]
  resources: ["auditlogqueries", "eventqueries"]
  verbs: ["create"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: activity-reindex-worker
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: activity-reindex-worker
subjects:
- kind: ServiceAccount
  name: activity-reindex-worker
  namespace: activity-system
```

#### Controller ServiceAccount (Updated)

**Existing:** `activity-controller-manager`

**Add permissions:**
```yaml
# Create and manage Jobs
- apiGroups: ["batch"]
  resources: ["jobs"]
  verbs: ["create", "get", "list", "watch", "delete"]

# Read Job status
- apiGroups: ["batch"]
  resources: ["jobs/status"]
  verbs: ["get"]
```

### Resource Configuration

**ReindexJob Annotations for Resource Limits:**

Operators can override default resource limits via annotations:

```yaml
apiVersion: activity.miloapis.com/v1alpha1
kind: ReindexJob
metadata:
  name: large-reindex
  annotations:
    reindex.activity.miloapis.com/memory-limit: "4Gi"
    reindex.activity.miloapis.com/cpu-limit: "2000m"
    reindex.activity.miloapis.com/memory-request: "1Gi"
    reindex.activity.miloapis.com/cpu-request: "1000m"
spec:
  timeRange:
    startTime: "now-30d"
```

**Controller Flags for Defaults:**

```bash
activity controller-manager \
  --reindex-job-namespace=activity-system \
  --reindex-service-account=activity-reindex-worker \
  --reindex-memory-limit=2Gi \
  --reindex-cpu-limit=1000m \
  --max-concurrent-reindex-jobs=1
```

### Cleanup Strategy

**Job Cleanup:**
- Jobs have `ttlSecondsAfterFinished: 300` (5 minutes after completion)
- Kubernetes automatically deletes completed Job pods
- Controller deletes the Job resource when ReindexJob is deleted (manual cleanup)

**ReindexJob Cleanup:**
- Existing `spec.ttlSecondsAfterFinished` still applies
- Controller deletes ReindexJob after TTL (existing logic)
- Deleting ReindexJob triggers Job deletion (controller cleanup loop)

### Concurrency Control

**Current Implementation:**
- Uses mutex + `runningJob` field to track single in-process worker
- Only one ReindexJob can be Running at a time

**New Implementation:**
- Controller counts running Jobs (Jobs with no completion time)
- If count >= `--max-concurrent-reindex-jobs`, queue new ReindexJobs in Pending
- Default limit: 1 (same as current behavior)
- Configurable via controller flag for future scaling

```go
func (r *ReindexJobReconciler) countRunningReindexJobs(ctx context.Context) (int, error) {
    var jobList batchv1.JobList
    if err := r.List(ctx, &jobList,
        client.InNamespace(r.JobNamespace),
        client.MatchingLabels{"app": "activity-reindex"},
    ); err != nil {
        return 0, err
    }

    count := 0
    for _, job := range jobList.Items {
        // Count jobs without completion time
        if job.Status.CompletionTime == nil {
            count++
        }
    }

    return count, nil
}
```

### Migration Path

**From Current In-Process Architecture:**

1. **Phase 1: Add reindex-worker subcommand**
   - Create `cmd/activity/reindex_worker.go`
   - Reuse existing `internal/reindex` package (no changes needed)
   - Test worker as standalone command

2. **Phase 2: Update controller to create Jobs**
   - Modify `reindexjob_controller.go` to create Jobs instead of goroutines
   - Remove `runReindexWorker` function
   - Add Job creation logic with template
   - Add Job watch and status sync

3. **Phase 3: RBAC and ServiceAccount**
   - Create `activity-reindex-worker` ServiceAccount
   - Update controller ClusterRole with Job permissions
   - Update deployment manifests

4. **Phase 4: Testing**
   - Test Job creation and execution
   - Test progress updates from Job pod
   - Test failure recovery (kill Job pod mid-execution)
   - Test concurrency limits

5. **Phase 5: Deployment**
   - Deploy to staging
   - Create test ReindexJob to verify Job execution
   - Deploy to production

**Backwards Compatibility:**
- No API changes to ReindexJob resource
- Existing ReindexJobs will be processed by new Job-based controller
- No migration of in-flight jobs (current implementation has none persisted)

## Implementation Plan

### Phase 1: Reindex Worker Subcommand (2-3 days)

**Tasks:**
1. Create `cmd/activity/reindex_worker.go`
   - Add subcommand registration in `main.go`
   - Implement `runReindexWorker` function
   - Parse ReindexJob name from args
   - Build Kubernetes client (in-cluster config)
   - Fetch ReindexJob from API
   - Create reindexer with progress callback
   - Update ReindexJob status directly
2. Add flags for ClickHouse and NATS configuration
3. Test worker as standalone command (run manually with kubeconfig)

**Deliverables:**
- `cmd/activity/reindex_worker.go`
- Unit tests for argument parsing
- Integration test: worker reads ReindexJob and updates status

### Phase 2: Controller Job Creation (2-3 days)

**Tasks:**
1. Update `reindexjob_controller.go`:
   - Remove `runReindexWorker` goroutine function
   - Remove `internal/reindex` dependency
   - Add `buildJobForReindexJob` function
   - Add Job creation in `startJob` method
   - Add Job watch to controller setup
2. Implement concurrency control via Job counting
3. Add Job cleanup logic (delete Job when ReindexJob is deleted)
4. Update controller flags for Job configuration

**Deliverables:**
- Modified `reindexjob_controller.go`
- Job template builder
- Controller tests for Job creation

### Phase 3: RBAC and ServiceAccount (1 day)

**Tasks:**
1. Create ServiceAccount manifest:
   - `config/base/rbac/reindex-worker-sa.yaml`
   - `config/base/rbac/reindex-worker-role.yaml`
   - `config/base/rbac/reindex-worker-rolebinding.yaml`
2. Update controller-manager RBAC:
   - Add Job permissions to ClusterRole
3. Update Kustomize bases to include new manifests
4. Create Secret for ClickHouse/NATS credentials (if not existing)

**Deliverables:**
- RBAC manifests
- Updated Kustomize configuration
- ServiceAccount documentation

### Phase 4: Integration Testing (2-3 days)

**Tasks:**
1. Test Job creation and execution:
   - Create ReindexJob, verify Job is created
   - Verify Job pod starts and runs worker
   - Verify progress updates appear in ReindexJob status
2. Test failure scenarios:
   - Kill Job pod mid-execution, verify Kubernetes restarts it
   - Fail worker (e.g., invalid ClickHouse config), verify Job fails
   - Verify ReindexJob status reflects failure
3. Test concurrency limits:
   - Create multiple ReindexJobs, verify only 1 runs
   - Verify queueing behavior
4. Test cleanup:
   - Verify Job TTL cleanup
   - Verify ReindexJob deletion triggers Job deletion

**Deliverables:**
- Integration test suite
- Test documentation
- Failure scenario runbook

### Phase 5: Documentation and Deployment (1-2 days)

**Tasks:**
1. Update operator documentation:
   - How to configure resource limits
   - How to troubleshoot failed Jobs
   - How to view Job logs
2. Update CLAUDE.md with reindex-worker command
3. Deploy to staging
4. Create test ReindexJob in staging
5. Monitor Job execution and logs
6. Deploy to production

**Deliverables:**
- Updated documentation
- Deployment runbook
- Production verification

## Handoff

### Decisions Made

- **Decision 1: Job updates ReindexJob status directly (not controller sync)**
  - Rationale: Simpler implementation, real-time progress updates, worker knows exact progress. Controller sync would require mapping Job conditions to ReindexJob phases and polling.

- **Decision 2: Single Job per ReindexJob (not parallel worker Jobs)**
  - Rationale: Current reindex logic is sequential (audit logs first, then events). Parallelizing would require splitting work, which adds complexity. Single Job is sufficient for initial implementation.

- **Decision 3: Same image for Job as controller-manager**
  - Rationale: Reuses existing build pipeline, ensures consistency between controller and worker. Binary contains all subcommands.

- **Decision 4: Configurable resource limits via annotations**
  - Rationale: Operators can tune resources per-job without redeploying controller. Defaults cover common cases.

- **Decision 5: Concurrency limit via Job counting (default: 1)**
  - Rationale: Prevents resource contention, consistent with current behavior. Configurable for future scaling.

### Open Questions

- **Question 1: Should we support parallel worker Jobs for large reindex operations?**
  - Blocking: No
  - Context: Current sequential processing is acceptable for most use cases. Parallel workers would require partitioning work (e.g., by time range) and aggregating progress. Defer until demand emerges.

- **Question 2: Should Job resource limits be in ReindexJob spec instead of annotations?**
  - Blocking: No
  - Context: Annotations are simpler and don't require API changes. Most jobs use defaults. Can be promoted to spec field if frequently overridden.

- **Question 3: Should we emit Kubernetes events from the worker pod?**
  - Blocking: No
  - Context: Worker already updates ReindexJob status. Events would be redundant. Controller emits events based on ReindexJob status transitions.

### Implementation Notes

**For api-dev:**

**Worker Subcommand:**
1. Create `cmd/activity/reindex_worker.go`
   - Copy flag structure from `cmd/activity/main.go` (ClickHouse, NATS)
   - Use `rest.InClusterConfig()` for Kubernetes client
   - Fetch ReindexJob via `client.Get(ctx, types.NamespacedName{Name: jobName}, &job)`
   - Reuse existing `internal/reindex.NewReindexer` - no changes needed
   - Update status via `client.Status().Update(ctx, &job)` in OnProgress callback
   - Return error if reindex fails (sets Job status to Failed)

**Controller Changes:**
2. Modify `internal/controller/reindexjob_controller.go`:
   - Remove `runReindexWorker` function and entire `reindexjob_worker.go` file
   - Remove `internal/reindex` import
   - Add `buildJobForReindexJob` function to create Job from template
   - In `startJob`, create Job instead of starting goroutine
   - Add watch for Jobs: `For(&v1alpha1.ReindexJob{}).Owns(&batchv1.Job{})`
   - Add Job cleanup in deletion handler
3. Concurrency control:
   - Replace mutex with Job counting: count Jobs in namespace with label `app=activity-reindex`
   - Queue ReindexJobs if count >= limit
4. Add controller flags:
   - `--reindex-job-namespace` (default: activity-system)
   - `--reindex-service-account` (default: activity-reindex-worker)
   - `--reindex-memory-limit` (default: 2Gi)
   - `--reindex-cpu-limit` (default: 1000m)
   - `--max-concurrent-reindex-jobs` (default: 1)

**Job Template:**
5. Job template in controller:
   - Use `batchv1.Job` type from `k8s.io/api/batch/v1`
   - Container command: `/activity reindex-worker <reindexjob-name>`
   - Pass ClickHouse/NATS config as flags (read from controller env)
   - Set resource limits from annotations or controller defaults
   - ServiceAccount: `activity-reindex-worker`
   - TTL: `ttlSecondsAfterFinished: 300`

**RBAC:**
6. Create manifests in `config/base/rbac/`:
   - `reindex-worker-sa.yaml` - ServiceAccount
   - `reindex-worker-role.yaml` - ClusterRole with ReindexJob status update perms
   - `reindex-worker-rolebinding.yaml` - ClusterRoleBinding
7. Update `config/base/generated/controller-manager-rbac.yaml`:
   - Add Job permissions: `["batch"]` resources `["jobs"]` verbs `["create", "get", "list", "watch", "delete"]`

**Testing:**
8. Unit tests:
   - Test Job template builder
   - Test concurrency counting logic
   - Test Job cleanup
9. Integration tests:
   - Test worker command with test ReindexJob
   - Test Job creation from controller
   - Test status updates from worker

**For test-engineer:**
1. Test Job creation:
   - Create ReindexJob, verify Job exists with correct name, labels, resources
2. Test worker execution:
   - Verify Job pod starts
   - Verify worker fetches ReindexJob
   - Verify progress updates appear in ReindexJob status
3. Test failure recovery:
   - Kill Job pod mid-execution, verify Kubernetes restarts it
   - Verify idempotent reindex (same activities published twice get deduplicated)
4. Test resource limits:
   - Create ReindexJob with large data, verify Job doesn't OOM with 2Gi limit
   - Verify controller-manager stays healthy during Job execution
5. Test concurrency:
   - Create 3 ReindexJobs, verify only 1 runs, 2 are Pending
   - Complete first Job, verify second starts
6. Test cleanup:
   - Verify Job pods deleted after TTL
   - Verify Job deleted when ReindexJob is deleted

**For sre:**
1. Create RBAC manifests for reindex-worker ServiceAccount
2. Update controller-manager deployment:
   - Add flags for Job configuration
   - Set `ACTIVITY_IMAGE` env var to controller image
3. Create Secret for ClickHouse/NATS credentials:
   - Name: `activity-reindex-credentials`
   - Keys: `CLICKHOUSE_ADDRESS`, `CLICKHOUSE_USERNAME`, `CLICKHOUSE_PASSWORD`, `NATS_URL`, etc.
4. Update Kustomize to include RBAC manifests
5. Deploy to staging, create test ReindexJob
6. Monitor Job logs: `kubectl logs -l reindex.activity.miloapis.com/job=<name> -n activity-system`
7. Deploy to production

**Key Files:**
- `cmd/activity/reindex_worker.go` - NEW
- `internal/controller/reindexjob_controller.go` - MODIFIED (remove worker goroutine, add Job creation)
- `internal/controller/reindexjob_worker.go` - DELETE (logic moves to reindex_worker.go)
- `config/base/rbac/reindex-worker-*.yaml` - NEW
- `config/base/generated/controller-manager-rbac.yaml` - MODIFIED (add Job perms)

**No Changes Needed:**
- `internal/reindex/` package - reused as-is by worker subcommand
- `pkg/apis/activity/v1alpha1/types_reindexjob.go` - API unchanged
- ReindexJob etcd storage - unchanged

