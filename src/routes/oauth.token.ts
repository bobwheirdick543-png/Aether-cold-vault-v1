import { createFileRoute } from "@tanstack/react-router";
import {
  getOAuthClientConfig,
  issueMcpAccessToken,
  jsonResponse,
  parseScopes,
  sha256B64Url,
  validateClient,
  verifyAuthCode,
} from "@/lib/server/oauth.server";

export const Route = createFileRoute("/oauth/token")({
  server: {
    handlers: {
      OPTIONS: async () =>
        new Response(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Authorization, Content-Type",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
          },
        }),
      POST: async ({ request }) => {
        try {
          const contentType = request.headers.get("content-type") || "";
          let params: Record<string, string> = {};
          if (contentType.includes("application/json")) {
            params = (await request.json()) as Record<string, string>;
          } else {
            const form = await request.formData();
            form.forEach((v, k) => {
              params[k] = String(v);
            });
          }

          const headerAuth = request.headers.get("Authorization") || "";
          let basicId = "";
          let basicSecret = "";
          if (headerAuth.startsWith("Basic ")) {
            try {
              const decoded = atob(headerAuth.slice(6));
              const [id, ...rest] = decoded.split(":");
              basicId = id || "";
              basicSecret = rest.join(":") || "";
            } catch {
              /* ignore */
            }
          }

          const clientId = params.client_id || basicId || getOAuthClientConfig().clientId;
          const clientSecret = params.client_secret || basicSecret || null;
          if (!validateClient(clientId, clientSecret)) {
            return jsonResponse({ error: "invalid_client", error_description: "Unknown client credentials." }, 401);
          }

          if (params.grant_type !== "authorization_code") {
            return jsonResponse({ error: "unsupported_grant_type" }, 400);
          }

          const payload = await verifyAuthCode(params.code || "");
          if (!payload) {
            return jsonResponse({ error: "invalid_grant", error_description: "Invalid or expired code." }, 400);
          }
          if (payload.redirect_uri !== params.redirect_uri) {
            return jsonResponse({ error: "invalid_grant", error_description: "redirect_uri mismatch." }, 400);
          }

          const challenge = await sha256B64Url(params.code_verifier || "");
          if (challenge !== payload.code_challenge) {
            return jsonResponse({ error: "invalid_grant", error_description: "PKCE verification failed." }, 400);
          }

          const scopes = parseScopes(payload.scope);
          const token = await issueMcpAccessToken({
            ownerId: payload.sub,
            clientLabel: `OAuth: ${clientId}`,
            scopes,
            projectIds: payload.project_ids ?? [],
          });

          return jsonResponse(token);
        } catch (e) {
          return jsonResponse(
            { error: "server_error", error_description: e instanceof Error ? e.message : "Token error." },
            500,
          );
        }
      },
    },
  },
});
