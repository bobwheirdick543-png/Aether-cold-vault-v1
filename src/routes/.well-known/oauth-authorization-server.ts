import { createFileRoute } from "@tanstack/react-router";
import { getPublicAppUrl, jsonResponse, oauthAuthorizationServerMetadata } from "@/lib/server/oauth.server";

export const Route = createFileRoute("/.well-known/oauth-authorization-server")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const base = getPublicAppUrl(request);
        return jsonResponse(oauthAuthorizationServerMetadata(base));
      },
      OPTIONS: async () =>
        new Response(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
          },
        }),
    },
  },
});
