# Aether Code Vault Foundation

## Product boundary

Aether Code Vault is a separate product from the Aether AI Platform. Code Vault owns project storage, the code workspace, snapshots, archives, security policy and its MCP surface. A future MCP-to-MCP bridge can connect Code Vault to the separate Aether AI Platform without merging their data planes.

## Request architecture

`UI → authenticated server function/API → authorization → domain service → database/private object storage`

Server functions use the existing Supabase authentication middleware. Private project operations are not trusted merely because a route is protected; the data operation itself checks the authenticated actor and project permission.

## Storage

Project metadata and filesystem nodes are stored in the database. File bytes are stored in private object storage under content-addressed keys. The browser never receives a service-role credential.

## Authentication and administration

User authentication is handled through Supabase Auth. Administrator access is a separate `/admin/login` experience. Administrator data operations check `user_roles` on the server. The first platform owner can be initialized only when the authenticated account email matches the server-only `ADMIN_EMAIL` secret.

## MCP

The remote endpoint is `/mcp`. It uses the official `@modelcontextprotocol/server` v2 line and `createMcpHandler`, serving the current 2026-07-28 protocol revision with the SDK's stateless legacy fallback. Bearer credentials are random high-entropy values; only SHA-256 token hashes are persisted.

MCP clients are explicitly scoped by permissions and project IDs. Initial read tools are:

- `list_projects`
- `get_project`
- `list_files`
- `read_file`
- `search_files`

Write tools are intentionally not exposed yet. They will be added only after the read-only MCP path is verified and the approval/snapshot/audit model is complete.

## Archives

ZIP import rejects absolute paths, path traversal, backslashes and malformed relative segments. Client-side extraction is capped before entries are sent to the server, and the server enforces an extracted-content limit. ZIP export packages the real project contents rather than generated placeholder data.

## Verification

The branch includes a GitHub Actions verification workflow that installs dependencies, runs the production build and runs lint. Browser-driven acceptance still needs to be executed against a deployed environment with real Supabase credentials and storage configured.

## Environment

Copy `.env.example` into the deployment's secret configuration. Never commit `.env` files. `ADMIN_EMAIL` is server-only and must not be exposed as a Vite/client variable.
