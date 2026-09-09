-- =====================================================================
-- AETHER CODE VAULT — foundation schema
-- =====================================================================

CREATE TYPE public.app_role AS ENUM ('user', 'admin', 'platform_owner');
CREATE TYPE public.account_status AS ENUM ('active', 'disabled');
CREATE TYPE public.project_status AS ENUM ('active', 'archived');
CREATE TYPE public.node_type AS ENUM ('file', 'folder');
CREATE TYPE public.actor_type AS ENUM ('user', 'admin', 'system', 'mcp');

-- ---------- shared helpers ----------
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ---------- profiles ----------
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY,
  email TEXT NOT NULL,
  display_name TEXT,
  status public.account_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER profiles_touch BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ---------- user roles ----------
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  role public.app_role NOT NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  );
$$;

CREATE OR REPLACE FUNCTION public.is_platform_staff(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin', 'platform_owner')
  );
$$;

CREATE POLICY "profiles_self_select" ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_platform_staff(auth.uid()));
CREATE POLICY "profiles_self_insert" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_self_update" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE POLICY "user_roles_self_select" ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_platform_staff(auth.uid()));

-- auto-provision profile + default role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ---------- projects ----------
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status public.project_status NOT NULL DEFAULT 'active',
  file_count INTEGER NOT NULL DEFAULT 0,
  folder_count INTEGER NOT NULL DEFAULT 0,
  storage_bytes BIGINT NOT NULL DEFAULT 0,
  current_version INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX projects_owner_idx ON public.projects (owner_id, updated_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO authenticated;
GRANT ALL ON public.projects TO service_role;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER projects_touch BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE POLICY "projects_owner_select" ON public.projects
  FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR public.is_platform_staff(auth.uid()));
CREATE POLICY "projects_owner_insert" ON public.projects
  FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "projects_owner_update" ON public.projects
  FOR UPDATE TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "projects_owner_delete" ON public.projects
  FOR DELETE TO authenticated USING (owner_id = auth.uid());

CREATE OR REPLACE FUNCTION public.owns_project(_project_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.projects WHERE id = _project_id AND owner_id = _user_id
  );
$$;

-- ---------- project filesystem ----------
CREATE TABLE public.project_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES public.project_nodes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type public.node_type NOT NULL,
  path TEXT NOT NULL,
  depth INTEGER NOT NULL DEFAULT 0,
  mime_type TEXT,
  size_bytes BIGINT NOT NULL DEFAULT 0,
  content_hash TEXT,
  storage_key TEXT,
  is_sensitive BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT project_nodes_unique_path UNIQUE (project_id, path),
  CONSTRAINT project_nodes_name_not_blank CHECK (length(trim(name)) > 0),
  CONSTRAINT project_nodes_name_safe CHECK (name NOT IN ('.', '..') AND name NOT LIKE '%/%'),
  CONSTRAINT project_nodes_not_self_parent CHECK (parent_id IS NULL OR parent_id <> id)
);
CREATE INDEX project_nodes_project_idx ON public.project_nodes (project_id, path);
CREATE INDEX project_nodes_parent_idx ON public.project_nodes (project_id, parent_id, type, name);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_nodes TO authenticated;
GRANT ALL ON public.project_nodes TO service_role;
ALTER TABLE public.project_nodes ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER project_nodes_touch BEFORE UPDATE ON public.project_nodes
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE POLICY "project_nodes_owner_select" ON public.project_nodes
  FOR SELECT TO authenticated
  USING (public.owns_project(project_id, auth.uid()));
CREATE POLICY "project_nodes_owner_insert" ON public.project_nodes
  FOR INSERT TO authenticated
  WITH CHECK (public.owns_project(project_id, auth.uid()));
CREATE POLICY "project_nodes_owner_update" ON public.project_nodes
  FOR UPDATE TO authenticated
  USING (public.owns_project(project_id, auth.uid()))
  WITH CHECK (public.owns_project(project_id, auth.uid()));
CREATE POLICY "project_nodes_owner_delete" ON public.project_nodes
  FOR DELETE TO authenticated
  USING (public.owns_project(project_id, auth.uid()));

-- guard: a node's parent must be a folder in the same project
CREATE OR REPLACE FUNCTION public.validate_project_node()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  parent_type public.node_type;
  parent_project UUID;
BEGIN
  IF NEW.parent_id IS NOT NULL THEN
    SELECT type, project_id INTO parent_type, parent_project
    FROM public.project_nodes WHERE id = NEW.parent_id;

    IF parent_type IS NULL THEN
      RAISE EXCEPTION 'parent node does not exist';
    END IF;
    IF parent_type <> 'folder' THEN
      RAISE EXCEPTION 'parent node must be a folder';
    END IF;
    IF parent_project <> NEW.project_id THEN
      RAISE EXCEPTION 'parent node belongs to another project';
    END IF;
  END IF;

  IF NEW.type = 'folder' AND NEW.storage_key IS NOT NULL THEN
    RAISE EXCEPTION 'folders cannot reference stored content';
  END IF;

  RETURN NEW;
END;
$$;
CREATE TRIGGER project_nodes_validate
  BEFORE INSERT OR UPDATE ON public.project_nodes
  FOR EACH ROW EXECUTE FUNCTION public.validate_project_node();

-- ---------- snapshots ----------
CREATE TABLE public.snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  created_by UUID NOT NULL,
  version INTEGER NOT NULL,
  label TEXT NOT NULL,
  message TEXT NOT NULL DEFAULT '',
  origin TEXT NOT NULL DEFAULT 'manual',
  file_count INTEGER NOT NULL DEFAULT 0,
  folder_count INTEGER NOT NULL DEFAULT 0,
  storage_bytes BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, version)
);
CREATE INDEX snapshots_project_idx ON public.snapshots (project_id, version DESC);
GRANT SELECT, INSERT ON public.snapshots TO authenticated;
GRANT ALL ON public.snapshots TO service_role;
ALTER TABLE public.snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "snapshots_owner_select" ON public.snapshots
  FOR SELECT TO authenticated
  USING (public.owns_project(project_id, auth.uid()));
CREATE POLICY "snapshots_owner_insert" ON public.snapshots
  FOR INSERT TO authenticated
  WITH CHECK (public.owns_project(project_id, auth.uid()) AND created_by = auth.uid());

CREATE TABLE public.snapshot_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id UUID NOT NULL REFERENCES public.snapshots(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  path TEXT NOT NULL,
  type public.node_type NOT NULL,
  mime_type TEXT,
  size_bytes BIGINT NOT NULL DEFAULT 0,
  content_hash TEXT,
  storage_key TEXT,
  is_sensitive BOOLEAN NOT NULL DEFAULT false,
  UNIQUE (snapshot_id, path)
);
CREATE INDEX snapshot_entries_snapshot_idx ON public.snapshot_entries (snapshot_id, path);
GRANT SELECT, INSERT ON public.snapshot_entries TO authenticated;
GRANT ALL ON public.snapshot_entries TO service_role;
ALTER TABLE public.snapshot_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "snapshot_entries_owner_select" ON public.snapshot_entries
  FOR SELECT TO authenticated
  USING (public.owns_project(project_id, auth.uid()));
CREATE POLICY "snapshot_entries_owner_insert" ON public.snapshot_entries
  FOR INSERT TO authenticated
  WITH CHECK (public.owns_project(project_id, auth.uid()));

-- ---------- audit ----------
CREATE TABLE public.audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID,
  actor_type public.actor_type NOT NULL DEFAULT 'user',
  actor_label TEXT,
  project_id UUID,
  action TEXT NOT NULL,
  target_type TEXT,
  target_path TEXT,
  target_id TEXT,
  success BOOLEAN NOT NULL DEFAULT true,
  severity TEXT NOT NULL DEFAULT 'info',
  detail JSONB NOT NULL DEFAULT '{}'::jsonb,
  correlation_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX audit_events_actor_idx ON public.audit_events (actor_id, created_at DESC);
CREATE INDEX audit_events_project_idx ON public.audit_events (project_id, created_at DESC);
CREATE INDEX audit_events_action_idx ON public.audit_events (action, created_at DESC);
CREATE INDEX audit_events_severity_idx ON public.audit_events (severity, created_at DESC);
GRANT SELECT ON public.audit_events TO authenticated;
GRANT ALL ON public.audit_events TO service_role;
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_events_own_select" ON public.audit_events
  FOR SELECT TO authenticated
  USING (actor_id = auth.uid() OR public.is_platform_staff(auth.uid()));

-- ---------- MCP clients ----------
CREATE TABLE public.mcp_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  token_prefix TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  scopes TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  project_ids UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  last_protocol_version TEXT,
  request_count BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (token_hash)
);
CREATE INDEX mcp_clients_owner_idx ON public.mcp_clients (owner_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mcp_clients TO authenticated;
GRANT ALL ON public.mcp_clients TO service_role;
ALTER TABLE public.mcp_clients ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER mcp_clients_touch BEFORE UPDATE ON public.mcp_clients
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE POLICY "mcp_clients_owner_select" ON public.mcp_clients
  FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR public.is_platform_staff(auth.uid()));
CREATE POLICY "mcp_clients_owner_insert" ON public.mcp_clients
  FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "mcp_clients_owner_update" ON public.mcp_clients
  FOR UPDATE TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "mcp_clients_owner_delete" ON public.mcp_clients
  FOR DELETE TO authenticated USING (owner_id = auth.uid());
