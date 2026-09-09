import { createFileRoute } from "@tanstack/react-router";
import { mcpHandler } from "@/lib/server/mcp.server";

export const Route = createFileRoute("/api/mcp")({
  server: {
    handlers: {
      GET: ({ request }) => mcpHandler(withCors(request)),
      POST: ({ request }) => mcpHandler(withCors(request)),
      DELETE: ({ request }) => mcpHandler(withCors(request)),
      OPTIONS: async () => new Response(null,{status:204,headers:corsHeaders()}),
    },
  },
});

function withCors(request:Request){return request;}
function corsHeaders(){return {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"Authorization, Content-Type, Accept, MCP-Protocol-Version, MCP-Session-Id","Access-Control-Allow-Methods":"GET, POST, DELETE, OPTIONS","Vary":"Origin"};}
