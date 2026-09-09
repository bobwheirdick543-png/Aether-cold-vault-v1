import { useState } from "react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AuthShell, Field } from "@/components/auth/AuthShell";

export const Route = createFileRoute("/login")({ component: LoginPage });

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) { e.preventDefault(); setBusy(true); setError(""); const { error } = await supabase.auth.signInWithPassword({ email, password }); if (error) setError(error.message); else await navigate({ to: "/dashboard" }); setBusy(false); }
  return <AuthShell title="Welcome back" subtitle="Sign in to your private Aether Code Vault."><form onSubmit={submit} className="mt-8 space-y-5"><Field label="Email" value={email} onChange={setEmail} type="email" autoComplete="email" placeholder="you@example.com" /><Field label="Password" value={password} onChange={setPassword} type="password" autoComplete="current-password" placeholder="••••••••" />{error && <p className="rounded-xl border border-red-400/20 bg-red-400/5 px-4 py-3 text-sm text-red-200">{error}</p>}<button disabled={busy} className="w-full rounded-xl bg-[#d7e5b0] px-4 py-3.5 text-sm font-semibold text-[#10150f] disabled:opacity-50">{busy ? "Signing in…" : "Sign in"}</button><div className="flex justify-between text-xs text-white/40"><Link to="/forgot-password" className="hover:text-white">Forgot password?</Link><Link to="/signup" className="hover:text-white">Create account</Link></div></form></AuthShell>;
}
