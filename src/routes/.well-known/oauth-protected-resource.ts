import { createFileRoute } from "@tanstack/react-router";
import { getPublicAppUrl, jsonResponse, oauthProtectedResourceMetadata } from "@/lib/server/oauth.server";

export const Route = createFileRoute("/.well-known/oauth-protected-resource")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const base = getPublicAppUrl(request);
        return jsonResponse(oauthProtectedResourceMetadata(base));
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
