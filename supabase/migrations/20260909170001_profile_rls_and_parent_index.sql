-- Follow-up to complete the RLS and foreign-key performance hardening.
CREATE INDEX IF NOT EXISTS project_nodes_parent_only_idx
  ON public.project_nodes(parent_id);

DROP POLICY IF EXISTS profiles_self_insert ON public.profiles;
CREATE POLICY profiles_self_insert ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (id = (select auth.uid()));

DROP POLICY IF EXISTS profiles_self_update ON public.profiles;
CREATE POLICY profiles_self_update ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = (select auth.uid()) OR private.is_platform_staff((select auth.uid())))
  WITH CHECK (id = (select auth.uid()) OR private.is_platform_staff((select auth.uid())));
