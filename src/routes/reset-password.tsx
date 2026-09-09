import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { FormEvent, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AuthShell } from "./login";

export const Route = createFileRoute("/reset-password")({ component: ResetPasswordPage });

function ResetPasswordPage() {
  const navigate = useNavigate(); const [password, setPassword] = useState(""); const [confirm, setConfirm] = useState(""); const [ready, setReady] = useState(false); const [error, setError] = useState(""); const [done, setDone] = useState(false); const [busy, setBusy] = useState(false);
  useEffect(() => { supabase.auth.getSession().then(({ data }) => setReady(Boolean(data.session))); }, []);
  async function submit(event: FormEvent) { event.preventDefault(); setError(""); if (!ready) { setError("Open the password-reset link from your email first."); return; } if (password.length < 10 || password !== confirm) { setError(password.length < 10 ? "Use a password with at least 10 characters." : "Passwords do not match."); return; } setBusy(true); const { error: updateError } = await supabase.auth.updateUser({ password }); setBusy(false); if (updateError) setError(updateError.message); else { setDone(true); setTimeout(() => navigate({ to: "/dashboard" }), 900); } }
  return <AuthShell title="Set a new password" subtitle="Choose a fresh password for your vault.">{done ? <div className="space-y-4 text-center"><div className="mx-auto flex size-12 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-primary">✓</div><p className="text-sm text-muted-foreground">Password updated. Returning to your vault…</p></div> : <form onSubmit={submit} className="space-y-5"><label className="block"><span className="field-label">New password</span><input className="vault-input" type="password" value={password} onChange={e => setPassword(e.target.value)} required /></label><label className="block"><span className="field-label">Confirm password</span><input className="vault-input" type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required /></label>{error && <p className="text-sm text-destructive">{error}</p>}<button disabled={busy} className="vault-button-primary w-full">{busy ? "Updating…" : "Update password"}</button><Link to="/login" className="block text-center text-sm text-muted-foreground">Cancel</Link></form>}</AuthShell>;
}
