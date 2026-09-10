import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AetherCompactLogo } from "@/components/brand/logo";

export const Route = createFileRoute("/oauth/authorize")({
  component: OAuthAuthorizePage,
  validateSearch: (s: Record<string, unknown>) => ({
    response_type: typeof s.response_type === "string" ? s.response_type : "code",
    client_id: typeof s.client_id === "string" ? s.client_id : "",
    redirect_uri: typeof s.redirect_uri === "string" ? s.redirect_uri : "",
    scope: typeof s.scope === "string" ? s.scope : "project.read project.search file.read",
    state: typeof s.state === "string" ? s.state : "",
    code_challenge: typeof s.code_challenge === "string" ? s.code_challenge : "",
    code_challenge_method: typeof s.code_challenge_method === "string" ? s.code_challenge_method : "S256",
  }),
});

function OAuthAuthorizePage() {
  const search = Route.useSearch();
  const [email, setEmail] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const scopes = useMemo(() => search.scope.split(/[\s+]+/).filter(Boolean), [search.scope]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setEmail(data.session?.user?.email ?? null);
    });
  }, []);

  async function decide(approve: boolean) {
    setBusy(true);
    setError("");
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) {
        const next = encodeURIComponent(window.location.href);
        window.location.href = `/login?next=${next}`;
        return;
      }

      const res = await fetch("/oauth/decision", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          approve,
          client_id: search.client_id,
          redirect_uri: search.redirect_uri,
          scope: search.scope,
          state: search.state,
          code_challenge: search.code_challenge,
          code_challenge_method: search.code_challenge_method || "S256",
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error_description || body.error || "Authorization failed.");
        return;
      }
      if (body.redirect) {
        window.location.href = body.redirect;
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Authorization failed.");
    } finally {
      setBusy(false);
    }
  }

  if (!search.client_id || !search.redirect_uri || !search.code_challenge) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-5">
        <div className="panel-raised max-w-md p-8 text-center">
          <p className="text-sm text-destructive">Invalid OAuth request. Missing client_id, redirect_uri, or code_challenge.</p>
          <Link to="/" className="mt-4 inline-block text-sm text-primary">Return home</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="vault-grid vault-aura flex min-h-screen items-center justify-center bg-background px-5 py-10">
      <div className="panel-raised w-full max-w-lg p-8">
        <div className="flex items-center gap-3">
          <AetherCompactLogo />
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[.28em] text-primary">MCP OAuth</p>
            <h1 className="text-2xl font-semibold">Authorize AI connector</h1>
          </div>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          An AI client wants to access your Aether Code Vault. Confirm only if you trust this application.
        </p>

        <dl className="mt-6 space-y-3 rounded-md border border-border bg-surface-sunken p-4 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Client</dt>
            <dd className="font-mono text-xs">{search.client_id}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Redirect</dt>
            <dd className="max-w-[60%] truncate font-mono text-xs">{search.redirect_uri}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Permissions</dt>
            <dd className="mt-2 flex flex-wrap gap-2">
              {scopes.map((s) => (
                <span key={s} className="rounded border border-border px-2 py-1 font-mono text-[10px] text-primary">
                  {s}
                </span>
              ))}
            </dd>
          </div>
          {email && (
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Signed in as</dt>
              <dd className="text-xs">{email}</dd>
            </div>
          )}
        </dl>

        {error && (
          <p className="mt-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        {!email ? (
          <div className="mt-6 space-y-3">
            <p className="text-sm text-muted-foreground">Sign in to your vault account to continue.</p>
            <a href={`/login?next=${encodeURIComponent(typeof window !== "undefined" ? window.location.href : "/oauth/authorize")}`} className="vault-button-primary flex h-11 items-center justify-center">
              Sign in to continue
            </a>
          </div>
        ) : (
          <div className="mt-6 flex gap-3">
            <button type="button" disabled={busy} onClick={() => decide(false)} className="vault-button-secondary h-11 flex-1">
              Deny
            </button>
            <button type="button" disabled={busy} onClick={() => decide(true)} className="vault-button-primary h-11 flex-1">
              {busy ? "Connecting…" : "Allow access"}
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
