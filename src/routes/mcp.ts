import { createFileRoute } from "@tanstack/react-router";
import { createMcpHandler, requireBearerAuth, OAuthError, OAuthErrorCode } from "@modelcontextprotocol/server";
import { createVaultMcpServer, verifyMcpToken } from "@/lib/server/mcp.server";
import { getPublicAppUrl, wwwAuthenticateChallenge } from "@/lib/server/oauth.server";

const bearerGate = requireBearerAuth({
  verifier: {
    async verifyAccessToken(token) {
      const principal = await verifyMcpToken(token);
      if (!principal) throw new OAuthError(OAuthErrorCode.InvalidToken, "The MCP credential is invalid or expired.");
      return {
        token,
        clientId: principal.clientId,
        scopes: principal.permissions,
        expiresAt: principal.expiresAt,
        extra: {
          ownerId: principal.ownerId,
          label: principal.label,
          projectScope: principal.projectScope,
        },
      };
    },
  },
});

const mcpHandler = createMcpHandler(({ authInfo }) => {
  if (!authInfo?.extra?.ownerId || !authInfo.extra.clientId) {
    throw new OAuthError(OAuthErrorCode.InvalidToken, "MCP authentication is required.");
  }
  return createVaultMcpServer({
    ownerId: String(authInfo.extra.ownerId),
    clientId: authInfo.clientId,
    label: String(authInfo.extra.label ?? authInfo.clientId),
    permissions: authInfo.scopes,
    projectScope: Array.isArray(authInfo.extra.projectScope) ? authInfo.extra.projectScope.map(String) : [],
    expiresAt: authInfo.expiresAt ?? 0,
  });
}, { legacy: "stateless" });

function withAuthChallenge(request: Request, response: Response): Response {
  if (response.status !== 401) return response;
  const base = getPublicAppUrl(request);
  const headers = new Headers(response.headers);
  headers.set("WWW-Authenticate", wwwAuthenticateChallenge(base));
  headers.set("Access-Control-Allow-Origin", "*");
  return new Response(response.body, { status: 401, statusText: response.statusText, headers });
}

export const Route = createFileRoute("/mcp")({
  server: {
    handlers: {
      OPTIONS: async () =>
        new Response(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Authorization, Content-Type, MCP-Protocol-Version",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          },
        }),
      POST: async ({ request }) => {
        const auth = await bearerGate(request);
        if (auth instanceof Response) return withAuthChallenge(request, auth);
        return mcpHandler.fetch(request, { authInfo: auth });
      },
      GET: async ({ request }) => {
        const auth = await bearerGate(request);
        if (auth instanceof Response) return withAuthChallenge(request, auth);
        return mcpHandler.fetch(request, { authInfo: auth });
      },
    },
  },
});
