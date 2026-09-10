/**
 * MCP OAuth 2.1 (Authorization Code + PKCE) for Claude, ChatGPT, and Grok connectors.
 * Access tokens are real vault MCP credentials (acv_...) bound to scopes.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { hashMcpToken, MCP_SCOPES } from "@/lib/server/mcp.server";
import { recordAudit } from "@/lib/server/audit.server";

const encoder = new TextEncoder();

export function getPublicAppUrl(request?: Request): string {
  const fromEnv = process.env["PUBLIC_APP_URL"]?.replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  if (request) {
    const u = new URL(request.url);
    return `${u.protocol}//${u.host}`;
  }
  return "http://localhost:3000";
}

/** Default public OAuth client (PKCE). Override with env in production. */
export function getOAuthClientConfig() {
  const clientId = process.env["MCP_OAUTH_CLIENT_ID"]?.trim() || "aether-vault-mcp";
  const clientSecret = process.env["MCP_OAUTH_CLIENT_SECRET"]?.trim() || "";
  return {
    clientId,
    clientSecret: clientSecret || null,
    tokenEndpointAuthMethod: clientSecret ? "client_secret_post" : "none",
  };
}

export function oauthAuthorizationServerMetadata(baseUrl: string) {
  return {
    issuer: baseUrl,
    authorization_endpoint: `${baseUrl}/oauth/authorize`,
    token_endpoint: `${baseUrl}/oauth/token`,
    registration_endpoint: `${baseUrl}/oauth/register`,
    scopes_supported: [...MCP_SCOPES],
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none", "client_secret_post", "client_secret_basic"],
    service_documentation: `${baseUrl}/settings/mcp`,
  };
}

export function oauthProtectedResourceMetadata(baseUrl: string) {
  return {
    resource: `${baseUrl}/mcp`,
    authorization_servers: [baseUrl],
    scopes_supported: [...MCP_SCOPES],
    bearer_methods_supported: ["header"],
    resource_documentation: `${baseUrl}/settings/mcp`,
  };
}

async function hmacKey() {
  const secret =
    process.env["MCP_OAUTH_SIGNING_SECRET"] ||
    process.env["SUPABASE_SECRET_KEY"] ||
    process.env["SUPABASE_SERVICE_ROLE_KEY"] ||
    "dev-only-oauth-signing-secret-change-me";
  return crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
    "verify",
  ]);
}

function b64url(data: ArrayBuffer | Uint8Array): string {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlJson(obj: unknown): string {
  return b64url(encoder.encode(JSON.stringify(obj)));
}

function fromB64url(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + pad;
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export type AuthCodePayload = {
  v: 1;
  sub: string;
  client_id: string;
  redirect_uri: string;
  scope: string;
  code_challenge: string;
  code_challenge_method: "S256";
  exp: number;
  project_ids?: string[];
};

export async function signAuthCode(payload: AuthCodePayload): Promise<string> {
  const body = b64urlJson(payload);
  const key = await hmacKey();
  const sig = b64url(await crypto.subtle.sign("HMAC", key, encoder.encode(body)));
  return `${body}.${sig}`;
}

export async function verifyAuthCode(code: string): Promise<AuthCodePayload | null> {
  const [body, sig] = code.split(".");
  if (!body || !sig) return null;
  const key = await hmacKey();
  const expected = b64url(await crypto.subtle.sign("HMAC", key, encoder.encode(body)));
  if (expected !== sig) return null;
  try {
    const json = new TextDecoder().decode(fromB64url(body));
    const payload = JSON.parse(json) as AuthCodePayload;
    if (payload.v !== 1 || !payload.sub || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function sha256B64Url(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(verifier));
  return b64url(digest);
}

export function parseScopes(scope: string | null | undefined): string[] {
  if (!scope?.trim()) {
    return ["project.read", "project.search", "file.read"];
  }
  const allowed = new Set<string>(MCP_SCOPES as unknown as string[]);
  return scope
    .split(/[\s+]+/)
    .map((s) => s.trim())
    .filter((s) => allowed.has(s));
}

export function validateClient(clientId: string, clientSecret?: string | null): boolean {
  const cfg = getOAuthClientConfig();
  if (clientId !== cfg.clientId && !clientId.startsWith("aether_")) return false;
  if (cfg.clientSecret) {
    if (!clientSecret || clientSecret !== cfg.clientSecret) return false;
  }
  return true;
}

/** Issue a real MCP access token (stored as hashed credential). */
export async function issueMcpAccessToken(opts: {
  ownerId: string;
  clientLabel: string;
  scopes: string[];
  projectIds?: string[];
  expiresInSeconds?: number;
}): Promise<{ access_token: string; token_type: "Bearer"; expires_in: number; scope: string }> {
  const expiresIn = opts.expiresInSeconds ?? 90 * 24 * 3600;
  const raw = `acv_${crypto.randomUUID().replaceAll("-", "")}_${crypto.randomUUID().replaceAll("-", "")}`;
  const tokenHash = await hashMcpToken(raw);
  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

  const { data: client, error } = await supabaseAdmin
    .from("mcp_clients")
    .insert({
      owner_id: opts.ownerId,
      name: opts.clientLabel.slice(0, 100),
      description: "Issued via OAuth for AI connector",
      token_prefix: raw.slice(0, 12),
      token_hash: tokenHash,
      scopes: opts.scopes,
      project_ids: opts.projectIds ?? [],
      expires_at: expiresAt,
    })
    .select("id")
    .single();

  if (error || !client) {
    throw new Error("Could not issue MCP access token.");
  }

  await recordAudit({
    actor: { id: opts.ownerId, type: "user", label: opts.clientLabel },
    action: "MCP_OAUTH_TOKEN_ISSUE",
    detail: { clientId: client.id, scopes: opts.scopes },
    correlationId: crypto.randomUUID(),
  });

  return {
    access_token: raw,
    token_type: "Bearer",
    expires_in: expiresIn,
    scope: opts.scopes.join(" "),
  };
}

export function jsonResponse(data: unknown, status = 200, extraHeaders?: HeadersInit) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      ...extraHeaders,
    },
  });
}

export function wwwAuthenticateChallenge(baseUrl: string) {
  return `Bearer realm="Aether Code Vault", resource_metadata="${baseUrl}/.well-known/oauth-protected-resource"`;
}
