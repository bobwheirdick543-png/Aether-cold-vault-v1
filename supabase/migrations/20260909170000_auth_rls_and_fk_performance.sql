-- Performance hardening for RLS policies and foreign-key lookups.
-- Keep auth.uid() as an initplan so it is evaluated once per statement.

CREATE INDEX IF NOT EXISTS project_nodes_parent_idx
  ON public.project_nodes(parent_id);

CREATE INDEX IF NOT EXISTS snapshot_entries_project_idx
  ON public.snapshot_entries(project_id);

DROP POLICY IF EXISTS profiles_self_select ON public.profiles;
CREATE POLICY profiles_self_select ON public.profiles
  FOR SELECT TO authenticated
  USING (id = (select auth.uid()) OR private.is_platform_staff((select auth.uid())));

DROP POLICY IF EXISTS user_roles_self_select ON public.user_roles;
CREATE POLICY user_roles_self_select ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()) OR private.is_platform_staff((select auth.uid())));

DROP POLICY IF EXISTS projects_owner_select ON public.projects;
CREATE POLICY projects_owner_select ON public.projects
  FOR SELECT TO authenticated
  USING (owner_id = (select auth.uid()) OR private.is_platform_staff((select auth.uid())));

DROP POLICY IF EXISTS projects_owner_insert ON public.projects;
CREATE POLICY projects_owner_insert ON public.projects
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = (select auth.uid()));

DROP POLICY IF EXISTS projects_owner_update ON public.projects;
CREATE POLICY projects_owner_update ON public.projects
  FOR UPDATE TO authenticated
  USING (owner_id = (select auth.uid()) OR private.is_platform_staff((select auth.uid())))
  WITH CHECK (owner_id = (select auth.uid()) OR private.is_platform_staff((select auth.uid())));

DROP POLICY IF EXISTS projects_owner_delete ON public.projects;
CREATE POLICY projects_owner_delete ON public.projects
  FOR DELETE TO authenticated
  USING (owner_id = (select auth.uid()) OR private.is_platform_staff((select auth.uid())));

DROP POLICY IF EXISTS project_nodes_owner_select ON public.project_nodes;
CREATE POLICY project_nodes_owner_select ON public.project_nodes
  FOR SELECT TO authenticated
  USING (private.owns_project(project_id, (select auth.uid())));
DROP POLICY IF EXISTS project_nodes_owner_insert ON public.project_nodes;
CREATE POLICY project_nodes_owner_insert ON public.project_nodes
  FOR INSERT TO authenticated
  WITH CHECK (private.owns_project(project_id, (select auth.uid())));
DROP POLICY IF EXISTS project_nodes_owner_update ON public.project_nodes;
CREATE POLICY project_nodes_owner_update ON public.project_nodes
  FOR UPDATE TO authenticated
  USING (private.owns_project(project_id, (select auth.uid())))
  WITH CHECK (private.owns_project(project_id, (select auth.uid())));
DROP POLICY IF EXISTS project_nodes_owner_delete ON public.project_nodes;
CREATE POLICY project_nodes_owner_delete ON public.project_nodes
  FOR DELETE TO authenticated
  USING (private.owns_project(project_id, (select auth.uid())));

DROP POLICY IF EXISTS snapshots_owner_select ON public.snapshots;
CREATE POLICY snapshots_owner_select ON public.snapshots
  FOR SELECT TO authenticated
  USING (private.owns_project(project_id, (select auth.uid())));
DROP POLICY IF EXISTS snapshots_owner_insert ON public.snapshots;
CREATE POLICY snapshots_owner_insert ON public.snapshots
  FOR INSERT TO authenticated
  WITH CHECK (private.owns_project(project_id, (select auth.uid())) AND created_by = (select auth.uid()));

DROP POLICY IF EXISTS snapshot_entries_owner_select ON public.snapshot_entries;
CREATE POLICY snapshot_entries_owner_select ON public.snapshot_entries
  FOR SELECT TO authenticated
  USING (private.owns_project(project_id, (select auth.uid())));
DROP POLICY IF EXISTS snapshot_entries_owner_insert ON public.snapshot_entries;
CREATE POLICY snapshot_entries_owner_insert ON public.snapshot_entries
  FOR INSERT TO authenticated
  WITH CHECK (private.owns_project(project_id, (select auth.uid())));

DROP POLICY IF EXISTS audit_events_own_select ON public.audit_events;
CREATE POLICY audit_events_own_select ON public.audit_events
  FOR SELECT TO authenticated
  USING (actor_id = (select auth.uid()) OR private.is_platform_staff((select auth.uid())));

DROP POLICY IF EXISTS mcp_clients_owner_select ON public.mcp_clients;
CREATE POLICY mcp_clients_owner_select ON public.mcp_clients
  FOR SELECT TO authenticated
  USING (owner_id = (select auth.uid()) OR private.is_platform_staff((select auth.uid())));

DROP POLICY IF EXISTS mcp_clients_owner_insert ON public.mcp_clients;
CREATE POLICY mcp_clients_owner_insert ON public.mcp_clients
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = (select auth.uid()));

DROP POLICY IF EXISTS mcp_clients_owner_update ON public.mcp_clients;
CREATE POLICY mcp_clients_owner_update ON public.mcp_clients
  FOR UPDATE TO authenticated
  USING (owner_id = (select auth.uid()) OR private.is_platform_staff((select auth.uid())))
  WITH CHECK (owner_id = (select auth.uid()) OR private.is_platform_staff((select auth.uid())));

DROP POLICY IF EXISTS mcp_clients_owner_delete ON public.mcp_clients;
CREATE POLICY mcp_clients_owner_delete ON public.mcp_clients
  FOR DELETE TO authenticated
  USING (owner_id = (select auth.uid()) OR private.is_platform_staff((select auth.uid())));
