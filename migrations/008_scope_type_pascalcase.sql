-- Migration: 008_scope_type_pascalcase
-- Description: Update scope_type and tenant_type columns from lowercase to PascalCase
-- Author: Claude Code
-- Date: 2026-03-10
--
-- Background: Milo authentication sends tenant types using Kubernetes Kind naming
-- conventions (PascalCase: "Organization", "Project", "User"). The activity service
-- was incorrectly lowercasing these values during scope extraction, causing a mismatch
-- between stored data and query filters.
--
-- This migration updates existing data to use PascalCase, aligning with the code fix
-- in the activity service. New data will be written with PascalCase automatically.
--
-- Note: These UPDATE statements modify the materialized columns only, not the source
-- JSON. This is intentional — all queries use the materialized columns for performance.

-- ============================================================================
-- Step 1: Update audit_logs table
-- ============================================================================
ALTER TABLE audit.audit_logs UPDATE scope_type = 'Organization' WHERE scope_type = 'organization';
ALTER TABLE audit.audit_logs UPDATE scope_type = 'Project' WHERE scope_type = 'project';
ALTER TABLE audit.audit_logs UPDATE scope_type = 'User' WHERE scope_type = 'user';

-- ============================================================================
-- Step 2: Update k8s_events table
-- ============================================================================
ALTER TABLE audit.k8s_events UPDATE scope_type = 'Organization' WHERE scope_type = 'organization';
ALTER TABLE audit.k8s_events UPDATE scope_type = 'Project' WHERE scope_type = 'project';
ALTER TABLE audit.k8s_events UPDATE scope_type = 'User' WHERE scope_type = 'user';

-- ============================================================================
-- Step 3: Update activities table
-- ============================================================================
-- Activities use tenant_type instead of scope_type
ALTER TABLE audit.activities UPDATE tenant_type = 'Organization' WHERE tenant_type = 'organization';
ALTER TABLE audit.activities UPDATE tenant_type = 'Project' WHERE tenant_type = 'project';
ALTER TABLE audit.activities UPDATE tenant_type = 'User' WHERE tenant_type = 'user';

-- ============================================================================
-- Verification (run manually after mutations complete)
-- ============================================================================
-- Check mutation progress:
--   SELECT * FROM system.mutations WHERE is_done = 0;
--
-- Verify no lowercase values remain:
--   SELECT scope_type, count() FROM audit.audit_logs GROUP BY scope_type;
--   SELECT scope_type, count() FROM audit.k8s_events GROUP BY scope_type;
--   SELECT tenant_type, count() FROM audit.activities GROUP BY tenant_type;
