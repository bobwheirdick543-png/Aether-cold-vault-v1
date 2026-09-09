import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const encoder = new TextEncoder();
async function hashToken(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

type Client = { id:string; owner_id:string; name:string; scopes:string[]; project_ids:string[]; expires_at:string|null; revoked_at:string|null };
async function authenticate(request: Request): Promise<Client> {
  const header = request.headers.get("authorization") ?? "";
  if (!header.startsWith("Bearer ")) throw new Response("Unauthorized", { status: 401 });
  const raw = header.slice(7).trim();
  if (!raw || raw.length < 20) throw new Response("Unauthorized", { status: 401 });
  const tokenHash = await hashToken(raw);
  const { data, error } = await supabaseAdmin.from("mcp_clients").select("id,owner_id,name,scopes,project_ids,expires_at,revoked_at").eq("token_hash", tokenHash).maybeSingle();
  if (error || !data || data.revoked_at || (data.expires_at && new Date(data.expires_at).getTime() <= Date.now())) throw new Response("Unauthorized", { status: 401 });
  await supabaseAdmin.from("mcp_clients").update({ last_used_at:new Date().toISOString(), request_count:0 }).eq("id",data.id);
  return data as Client;
}
function allowed(client:Client, projectId:string, scope:string){if(!client.scopes.includes(scope)) throw new Error(`MCP client lacks ${scope}`);if(!client.project_ids.includes(projectId)) throw new Error("MCP client is not authorized for this project");}
async function audit(client:Client, action:string, projectId:string|undefined, success:boolean, detail:Record<string,unknown>={}){await supabaseAdmin.from("audit_events").insert({actor_id:client.owner_id,actor_type:"mcp",actor_label:client.name,project_id:projectId??null,action,success,severity:success?"info":"warning",detail});}

export const mcpHandler = createMcpHandler(() => {
  const server = new McpServer({ name: "Aether Code Vault MCP", version: "1.0.0" }, { capabilities: { tools: {} } });

  server.registerTool("list_projects", { description:"List projects explicitly authorized for this MCP client.", inputSchema:z.object({}) }, async (_args,ctx) => {
    const request=ctx.http?.req; if(!request) throw new Error("MCP request context unavailable"); const client=await authenticate(request); if(!client.scopes.includes("project.read")) throw new Error("MCP client lacks project.read");
    const {data,error}=await supabaseAdmin.from("projects").select("id,name,description,status,file_count,folder_count,storage_bytes,current_version,created_at,updated_at").in("id",client.project_ids); if(error){await audit(client,"mcp.list_projects",undefined,false,{message:error.message});throw new Error("Unable to list projects")}; await audit(client,"mcp.list_projects",undefined,true); return {content:[{type:"text",text:JSON.stringify(data??[])}]};
  });

  server.registerTool("get_project", { description:"Get metadata for one authorized project.", inputSchema:z.object({ projectId:z.string().uuid() }) }, async ({projectId},ctx) => {
    const request=ctx.http?.req;if(!request)throw new Error("MCP request context unavailable");const client=await authenticate(request);allowed(client,projectId,"project.read");const{data,error}=await supabaseAdmin.from("projects").select("id,name,description,status,file_count,folder_count,storage_bytes,current_version,created_at,updated_at").eq("id",projectId).single();if(error){await audit(client,"mcp.get_project",projectId,false,{message:error.message});throw new Error("Project unavailable")};await audit(client,"mcp.get_project",projectId,true);return{content:[{type:"text",text:JSON.stringify(data)}]};
  });

  server.registerTool("list_files", { description:"List the real filesystem entries in an authorized project.", inputSchema:z.object({ projectId:z.string().uuid(), prefix:z.string().optional() }) }, async ({projectId,prefix},ctx) => {
    const request=ctx.http?.req;if(!request)throw new Error("MCP request context unavailable");const client=await authenticate(request);allowed(client,projectId,"project.read");let q=supabaseAdmin.from("project_nodes").select("id,parent_id,name,type,path,mime_type,size_bytes,is_sensitive,updated_at").eq("project_id",projectId).order("path");if(prefix)q=q.like("path",`${prefix.replace(/[%_]/g,"\\$&")}%`);const{data,error}=await q;if(error){await audit(client,"mcp.list_files",projectId,false,{message:error.message});throw new Error("Unable to list files")};await audit(client,"mcp.list_files",projectId,true,{prefix:prefix??null});return{content:[{type:"text",text:JSON.stringify(data??[])}]};
  });

  server.registerTool("read_file", { description:"Read the contents of one authorized project file. Sensitive files are denied by policy.", inputSchema:z.object({ projectId:z.string().uuid(), path:z.string().min(1) }) }, async ({projectId,path},ctx) => {
    const request=ctx.http?.req;if(!request)throw new Error("MCP request context unavailable");const client=await authenticate(request);allowed(client,projectId,"file.read");const{data:node,error:ne}=await supabaseAdmin.from("project_nodes").select("id,name,path,type,mime_type,size_bytes,storage_key,is_sensitive").eq("project_id",projectId).eq("path",path).eq("type","file").single();if(ne||!node||node.is_sensitive||!node.storage_key){await audit(client,"mcp.read_file",projectId,false,{path,reason:node?.is_sensitive?"sensitive":"not_found"});throw new Error(node?.is_sensitive?"Sensitive file access is blocked":"File unavailable")};const{data,error}=await supabaseAdmin.storage.from("project-blobs").download(node.storage_key);if(error||!data){await audit(client,"mcp.read_file",projectId,false,{path,reason:"storage"});throw new Error("Stored content unavailable")};const text=await data.text();await audit(client,"mcp.read_file",projectId,true,{path});return{content:[{type:"text",text}]};
  });

  server.registerTool("search_code", { description:"Search text across authorized project files without exposing sensitive files.", inputSchema:z.object({ projectId:z.string().uuid(), query:z.string().min(1) }) }, async ({projectId,query},ctx) => {
    const request=ctx.http?.req;if(!request)throw new Error("MCP request context unavailable");const client=await authenticate(request);allowed(client,projectId,"project.search");const{data:nodes}=await supabaseAdmin.from("project_nodes").select("path,storage_key,is_sensitive").eq("project_id",projectId).eq("type","file").eq("is_sensitive",false).limit(500);const matches:unknown[]=[];for(const n of nodes??[]){if(!n.storage_key)continue;const{data}=await supabaseAdmin.storage.from("project-blobs").download(n.storage_key);if(!data)continue;const text=await data.text();if(text.toLowerCase().includes(query.toLowerCase()))matches.push({path:n.path});if(matches.length>=100)break}await audit(client,"mcp.search_code",projectId,true,{queryLength:query.length,resultCount:matches.length});return{content:[{type:"text",text:JSON.stringify(matches)}]};
  });

  return server;
});
