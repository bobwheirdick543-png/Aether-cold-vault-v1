import { createFileRoute } from "@tanstack/react-router";
import { getOAuthClientConfig, jsonResponse } from "@/lib/server/oauth.server";
import { MCP_SCOPES } from "@/lib/server/mcp.server";

/** Dynamic client registration — returns the vault public client for connectors that support DCR. */
export const Route = createFileRoute("/oauth/register")({
  server: {
    handlers: {
      OPTIONS: async () =>
        new Response(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
          },
        }),
      POST: async ({ request }) => {
        const cfg = getOAuthClientConfig();
        let body: Record<string, unknown> = {};
        try {
          body = (await request.json()) as Record<string, unknown>;
        } catch {
          body = {};
        }
        return jsonResponse(
          {
            client_id: cfg.clientId,
            client_secret: cfg.clientSecret || undefined,
            client_id_issued_at: Math.floor(Date.now() / 1000),
            client_secret_expires_at: 0,
            redirect_uris: Array.isArray(body.redirect_uris) ? body.redirect_uris : [],
            token_endpoint_auth_method: cfg.tokenEndpointAuthMethod,
            grant_types: ["authorization_code"],
            response_types: ["code"],
            scope: [...MCP_SCOPES].join(" "),
            client_name: typeof body.client_name === "string" ? body.client_name : "Aether Code Vault MCP Client",
          },
          201,
        );
      },
    },
  },
});
