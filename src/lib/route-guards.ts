import { redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export async function requireUserRoute() {
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw redirect({ to: "/login" });
}

export async function requireAdminRoute() {
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw redirect({ to: "/admin/login" });
}
