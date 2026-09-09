# Aether Code Vault architecture

## Boundary
Aether Code Vault is a standalone product. It is not the Aether AI Platform. The future Aether AI Platform integration is an explicitly authorized MCP-to-MCP bridge.

## Core layers

`UI -> TanStack Start server boundary -> authorization/domain services -> PostgreSQL + private object storage`

Project data is isolated by database RLS and server authorization. File metadata lives in `project_nodes`; file bytes live in the private `project-blobs` bucket using content-addressed storage keys.

## Authentication and roles

Supabase Auth handles identity. `user_roles` stores the separate application role. The database does not allow ordinary clients to grant themselves `admin` or `platform_owner`.

User routes and `/admin/login` are separate experiences. The admin console checks the server-backed role before showing platform data.

## MCP

`/api/mcp` is a real MCP HTTP endpoint using the current MCP TypeScript SDK v2. It uses the 2026-07-28 modern protocol through `createMcpHandler` and also supports the SDK's stateless legacy compatibility path.

Every MCP credential is stored as a SHA-256 hash. A credential is additionally restricted to explicit project IDs and scopes. Current read tools are `list_projects`, `get_project`, `list_files`, `read_file`, and `search_code`.

MCP reads never expose files classified as sensitive. MCP operations are written to the audit log.

## AI safety boundary

Future write tools must continue through authorization, sensitive-file policy, safety checks, optional approval and audit logging. AI agents must not receive unrestricted shell or filesystem access.

## Storage and archives

ZIP import rejects absolute paths, traversal segments, suspicious sensitive filenames, oversized archives, oversized entries and excessive entry counts before accepted entries are persisted. ZIP export packages the actual persisted project files.

## Snapshots

Snapshots store immutable filesystem metadata and content-addressed storage references. Restore reconstructs the parent hierarchy and then records a new snapshot of the restored state, preserving history.
