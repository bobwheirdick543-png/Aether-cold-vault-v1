import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { FormEvent, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AuthShell } from "./login";

export const Route = createFileRoute("/signup")({ component: SignupPage });

function SignupPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");
    if (password.length < 10) { setError("Use a password with at least 10 characters."); return; }
    if (password !== confirm) { setError("Passwords do not match."); return; }

    setBusy(true);
    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { display_name: name.trim() },
          emailRedirectTo: `${window.location.origin}/auth/confirm?next=/dashboard`,
        },
      });

      if (signUpError) {
        setError(signUpError.message);
        return;
      }

      if (data.session) {
        await navigate({ to: "/dashboard" });
        return;
      }

      setMessage(
        "Your account was created. Check your email for the confirmation link. After you confirm it, Aether will sign you in automatically. If this is the configured platform-owner email, administrator access will be initialized automatically."
      );
    } catch (error) {
      setError(error instanceof Error ? error.message : "We could not finish creating your account.");
    } finally {
      setBusy(false);
    }
  }

  return <AuthShell title="Create your vault" subtitle="A private place for the code you own.">
    <form onSubmit={submit} className="space-y-5">
      <label className="block"><span className="field-label">Display name</span><input className="vault-input" value={name} onChange={e => setName(e.target.value)} autoComplete="name" required /></label>
      <label className="block"><span className="field-label">Email</span><input className="vault-input" type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" required /></label>
      <label className="block"><span className="field-label">Password</span><input className="vault-input" type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" required /></label>
      <label className="block"><span className="field-label">Confirm password</span><input className="vault-input" type="password" value={confirm} onChange={e => setConfirm(e.target.value)} autoComplete="new-password" required /></label>
      {error && <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
      {message && <div className="rounded-md border border-primary/20 bg-primary/5 px-3 py-3 text-sm text-muted-foreground"><p className="font-medium text-foreground">Check your email</p><p className="mt-1 leading-5">{message}</p></div>}
      <button disabled={busy} className="vault-button-primary w-full">{busy ? "Creating your vault…" : "Create account"}</button>
      <p className="text-center text-sm text-muted-foreground">Already have a vault? <Link to="/login" className="text-primary hover:underline">Sign in</Link></p>
    </form>
  </AuthShell>;
}
