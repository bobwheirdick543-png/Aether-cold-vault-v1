import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  getOAuthClientConfig,
  jsonResponse,
  parseScopes,
  signAuthCode,
} from "@/lib/server/oauth.server";

export const Route = createFileRoute("/oauth/decision")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const auth = request.headers.get("Authorization") || "";
          const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
          if (!token) return jsonResponse({ error: "invalid_request", error_description: "Missing user session." }, 401);

          const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
          if (userErr || !userData.user) {
            return jsonResponse({ error: "invalid_request", error_description: "Sign in required." }, 401);
          }

          const body = (await request.json()) as {
            approve?: boolean;
            client_id?: string;
            redirect_uri?: string;
            scope?: string;
            state?: string;
            code_challenge?: string;
            code_challenge_method?: string;
          };

          const redirectUri = body.redirect_uri || "";
          if (!redirectUri.startsWith("https://") && !redirectUri.startsWith("http://localhost")) {
            return jsonResponse({ error: "invalid_request", error_description: "Invalid redirect_uri." }, 400);
          }

          const cfg = getOAuthClientConfig();
          const clientId = body.client_id || cfg.clientId;
          if (!body.approve) {
            const u = new URL(redirectUri);
            u.searchParams.set("error", "access_denied");
            if (body.state) u.searchParams.set("state", body.state);
            return jsonResponse({ redirect: u.toString() });
          }

          if (!body.code_challenge || body.code_challenge_method !== "S256") {
            return jsonResponse(
              { error: "invalid_request", error_description: "PKCE S256 code_challenge is required." },
              400,
            );
          }

          const scopes = parseScopes(body.scope);
          const code = await signAuthCode({
            v: 1,
            sub: userData.user.id,
            client_id: clientId,
            redirect_uri: redirectUri,
            scope: scopes.join(" "),
            code_challenge: body.code_challenge,
            code_challenge_method: "S256",
            exp: Date.now() + 5 * 60 * 1000,
          });

          const u = new URL(redirectUri);
          u.searchParams.set("code", code);
          if (body.state) u.searchParams.set("state", body.state);
          return jsonResponse({ redirect: u.toString() });
        } catch (e) {
          return jsonResponse(
            { error: "server_error", error_description: e instanceof Error ? e.message : "Decision failed." },
            500,
          );
        }
      },
    },
  },
});
