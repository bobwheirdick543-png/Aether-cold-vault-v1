import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { FormEvent, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AetherLogo } from "@/components/brand/logo";

export const Route = createFileRoute("/login")({ component: LoginPage });

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setError("");
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (signInError) { setError(signInError.message); return; }
    await navigate({ to: "/dashboard" });
  }

  return <AuthShell title="Enter the vault" subtitle="Your private development workspace.">
    <form onSubmit={submit} className="space-y-5">
      <Field label="Email"><input className="vault-input" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required /></Field>
      <Field label="Password"><input className="vault-input" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required /></Field>
      {error && <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
      <button disabled={busy} className="vault-button-primary w-full">{busy ? "Unlocking…" : "Sign in"}</button>
      <div className="flex justify-between text-sm"><Link to="/signup" className="text-primary hover:underline">Create account</Link><Link to="/forgot-password" className="text-muted-foreground hover:text-foreground">Forgot password?</Link></div>
    </form>
  </AuthShell>;
}

export function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return <main className="vault-aura vault-grid flex min-h-screen items-center justify-center px-5 py-12">
    <div className="w-full max-w-md animate-rise">
      <Link to="/" className="mb-10 flex justify-center"><AetherLogo className="h-9" /></Link>
      <section className="panel-raised p-7 sm:p-9">
        <div className="mb-7"><p className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary">AETHER CODE VAULT</p><h1 className="mt-3 text-3xl font-semibold">{title}</h1><p className="mt-2 text-sm text-muted-foreground">{subtitle}</p></div>
        {children}
      </section>
    </div>
  </main>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="mb-2 block text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">{label}</span>{children}</label>; }
