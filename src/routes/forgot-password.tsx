import { createFileRoute, Link } from "@tanstack/react-router";
import { FormEvent, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AuthShell } from "./login";

export const Route = createFileRoute("/forgot-password")({ component: ForgotPasswordPage });

function ForgotPasswordPage() {
  const [email, setEmail] = useState(""); const [message, setMessage] = useState(""); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) { event.preventDefault(); setBusy(true); setError(""); setMessage(""); const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/reset-password` }); setBusy(false); if (resetError) setError(resetError.message); else setMessage("If an account exists for that address, a recovery link is on its way."); }
  return <AuthShell title="Recover access" subtitle="We'll send a secure password-reset link.">
    <form onSubmit={submit} className="space-y-5"><label className="block"><span className="field-label">Email</span><input className="vault-input" type="email" value={email} onChange={e => setEmail(e.target.value)} required /></label>{message && <p className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-primary">{message}</p>}{error && <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}<button disabled={busy} className="vault-button-primary w-full">{busy ? "Sending…" : "Send recovery link"}</button><p className="text-center text-sm"><Link to="/login" className="text-muted-foreground hover:text-foreground">Back to sign in</Link></p></form>
  </AuthShell>;
}
