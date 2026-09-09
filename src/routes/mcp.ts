import { createFileRoute } from "@tanstack/react-router";
import { createMcpHandler, requireBearerAuth, OAuthError, OAuthErrorCode } from "@modelcontextprotocol/server";
import { createVaultMcpServer, verifyMcpToken } from "@/lib/server/mcp.server";

const bearerGate = requireBearerAuth({
  verifier: {
    async verifyAccessToken(token) {
      const principal = await verifyMcpToken(token);
      if (!principal) throw new OAuthError(OAuthErrorCode.InvalidToken, "The MCP credential is invalid or expired.");
      return { token, clientId: principal.clientId, scopes: principal.permissions, expiresAt: principal.expiresAt, extra: { ownerId: principal.ownerId, label: principal.label, projectScope: principal.projectScope } };
    },
  },
});

const mcpHandler = createMcpHandler(({ authInfo }) => {
  if (!authInfo?.extra?.ownerId || !authInfo.extra.clientId) throw new OAuthError(OAuthErrorCode.InvalidToken, "MCP authentication is required.");
  return createVaultMcpServer({
    ownerId: String(authInfo.extra.ownerId),
    clientId: authInfo.clientId,
    label: String(authInfo.extra.label ?? authInfo.clientId),
    permissions: authInfo.scopes,
    projectScope: Array.isArray(authInfo.extra.projectScope) ? authInfo.extra.projectScope.map(String) : [],
    expiresAt: authInfo.expiresAt ?? 0,
  });
}, { legacy: "stateless" });

export const Route = createFileRoute("/mcp")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await bearerGate(request);
        if (auth instanceof Response) return auth;
        return mcpHandler.fetch(request, { authInfo: auth });
      },
      GET: async ({ request }) => {
        const auth = await bearerGate(request);
        if (auth instanceof Response) return auth;
        return mcpHandler.fetch(request, { authInfo: auth });
      },
    },
  },
});
