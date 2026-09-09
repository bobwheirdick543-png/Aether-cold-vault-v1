import { createFileRoute } from "@tanstack/react-router";
import { mcpHandler } from "@/lib/server/mcp.server";

export const Route = createFileRoute("/api/mcp")({
  server: {
    handlers: {
      GET: ({ request }) => mcpHandler.fetch(request),
      POST: ({ request }) => mcpHandler.fetch(request),
      DELETE: ({ request }) => mcpHandler.fetch(request),
    },
  },
});
