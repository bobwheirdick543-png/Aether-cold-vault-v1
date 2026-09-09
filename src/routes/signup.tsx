import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { FormEvent, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AuthShell } from "./login";

export const Route = createFileRoute("/signup")({ component: SignupPage });

function SignupPage() {
  const navigate = useNavigate();
  const [name, setName] = useState(""); const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [confirm, setConfirm] = useState(""); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault(); setError("");
    if (password.length < 10) { setError("Use a password with at least 10 characters."); return; }
    if (password !== confirm) { setError("Passwords do not match."); return; }
    setBusy(true);
    const { data, error: signUpError } = await supabase.auth.signUp({ email: email.trim(), password, options: { data: { display_name: name.trim() } } });
    setBusy(false);
    if (signUpError) { setError(signUpError.message); return; }
    if (data.session) await navigate({ to: "/dashboard" }); else setError("Account created. Check your email to confirm your address before signing in.");
  }
  return <AuthShell title="Create your vault" subtitle="A private place for the code you own.">
    <form onSubmit={submit} className="space-y-5">
      <label className="block"><span className="field-label">Display name</span><input className="vault-input" value={name} onChange={e => setName(e.target.value)} autoComplete="name" required /></label>
      <label className="block"><span className="field-label">Email</span><input className="vault-input" type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" required /></label>
      <label className="block"><span className="field-label">Password</span><input className="vault-input" type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" required /></label>
      <label className="block"><span className="field-label">Confirm password</span><input className="vault-input" type="password" value={confirm} onChange={e => setConfirm(e.target.value)} autoComplete="new-password" required /></label>
      {error && <p className="rounded-md border border-border bg-surface-sunken px-3 py-2 text-sm text-muted-foreground">{error}</p>}
      <button disabled={busy} className="vault-button-primary w-full">{busy ? "Sealing account…" : "Create account"}</button>
      <p className="text-center text-sm text-muted-foreground">Already have a vault? <Link to="/login" className="text-primary hover:underline">Sign in</Link></p>
    </form>
  </AuthShell>;
}
