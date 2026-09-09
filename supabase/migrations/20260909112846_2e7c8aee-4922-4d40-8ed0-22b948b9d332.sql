-- Move privileged helper functions out of the API-exposed schema so they can
-- never be called directly by API clients, while remaining usable inside RLS.

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION private.is_platform_staff(_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin', 'platform_owner')
  );
$$;

CREATE OR REPLACE FUNCTION private.owns_project(_project_id UUID, _user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.projects WHERE id = _project_id AND owner_id = _user_id);
$$;

CREATE OR REPLACE FUNCTION private.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data ->> 'display_name', split_part(COALESCE(NEW.email, ''), '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.has_role(UUID, public.app_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.is_platform_staff(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.owns_project(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.handle_new_user() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.has_role(UUID, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.is_platform_staff(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.owns_project(UUID, UUID) TO authenticated, service_role;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION private.handle_new_user();

-- Re-point every policy at the private helpers.
DROP POLICY "profiles_self_select" ON public.profiles;
CREATE POLICY "profiles_self_select" ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR private.is_platform_staff(auth.uid()));

DROP POLICY "user_roles_self_select" ON public.user_roles;
CREATE POLICY "user_roles_self_select" ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR private.is_platform_staff(auth.uid()));

DROP POLICY "projects_owner_select" ON public.projects;
CREATE POLICY "projects_owner_select" ON public.projects
  FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR private.is_platform_staff(auth.uid()));

DROP POLICY "project_nodes_owner_select" ON public.project_nodes;
CREATE POLICY "project_nodes_owner_select" ON public.project_nodes
  FOR SELECT TO authenticated USING (private.owns_project(project_id, auth.uid()));
DROP POLICY "project_nodes_owner_insert" ON public.project_nodes;
CREATE POLICY "project_nodes_owner_insert" ON public.project_nodes
  FOR INSERT TO authenticated WITH CHECK (private.owns_project(project_id, auth.uid()));
DROP POLICY "project_nodes_owner_update" ON public.project_nodes;
CREATE POLICY "project_nodes_owner_update" ON public.project_nodes
  FOR UPDATE TO authenticated
  USING (private.owns_project(project_id, auth.uid()))
  WITH CHECK (private.owns_project(project_id, auth.uid()));
DROP POLICY "project_nodes_owner_delete" ON public.project_nodes;
CREATE POLICY "project_nodes_owner_delete" ON public.project_nodes
  FOR DELETE TO authenticated USING (private.owns_project(project_id, auth.uid()));

DROP POLICY "snapshots_owner_select" ON public.snapshots;
CREATE POLICY "snapshots_owner_select" ON public.snapshots
  FOR SELECT TO authenticated USING (private.owns_project(project_id, auth.uid()));
DROP POLICY "snapshots_owner_insert" ON public.snapshots;
CREATE POLICY "snapshots_owner_insert" ON public.snapshots
  FOR INSERT TO authenticated
  WITH CHECK (private.owns_project(project_id, auth.uid()) AND created_by = auth.uid());

DROP POLICY "snapshot_entries_owner_select" ON public.snapshot_entries;
CREATE POLICY "snapshot_entries_owner_select" ON public.snapshot_entries
  FOR SELECT TO authenticated USING (private.owns_project(project_id, auth.uid()));
DROP POLICY "snapshot_entries_owner_insert" ON public.snapshot_entries;
CREATE POLICY "snapshot_entries_owner_insert" ON public.snapshot_entries
  FOR INSERT TO authenticated WITH CHECK (private.owns_project(project_id, auth.uid()));

DROP POLICY "audit_events_own_select" ON public.audit_events;
CREATE POLICY "audit_events_own_select" ON public.audit_events
  FOR SELECT TO authenticated
  USING (actor_id = auth.uid() OR private.is_platform_staff(auth.uid()));

DROP POLICY "mcp_clients_owner_select" ON public.mcp_clients;
CREATE POLICY "mcp_clients_owner_select" ON public.mcp_clients
  FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR private.is_platform_staff(auth.uid()));

DROP FUNCTION IF EXISTS public.has_role(UUID, public.app_role);
DROP FUNCTION IF EXISTS public.is_platform_staff(UUID);
DROP FUNCTION IF EXISTS public.owns_project(UUID, UUID);
DROP FUNCTION IF EXISTS public.handle_new_user();
