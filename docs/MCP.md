# Aether Code Vault MCP

## Endpoint

`POST /mcp` and the protocol's supported HTTP request methods are handled by TanStack Start's server-route boundary. Requests must carry a valid Bearer credential.

The implementation uses the official Model Context Protocol TypeScript SDK v2. The current SDK v2 line implements the 2026-07-28 protocol revision. The HTTP entry is `createMcpHandler`; legacy HTTP+SSE is not used.

## Credential model

A user creates a credential from `/settings/mcp`.

The raw credential is generated once, displayed once, and never persisted. The database stores only its SHA-256 hash, prefix, owner, scopes, project scope, expiration and revocation state.

Current scopes:

- `project.read`
- `project.search`
- `file.read`

A credential may be restricted to specific project IDs. An empty project scope means all projects owned by the credential owner.

## Tools

### `list_projects`
Returns project metadata visible to the credential.

### `get_project`
Returns metadata for one authorized project.

### `list_files`
Returns real file/folder metadata from the project's filesystem.

### `read_file`
Returns the real stored file contents after the normal sensitive-file policy and authorization checks.

### `search_files`
Searches real project paths and filenames.

## Security boundary

MCP does not receive direct database or object-storage access. Tool handlers call the same vault authorization/domain services used by the application. Each operation is audited.

Write tools are deliberately withheld until the read-only connection has passed acceptance tests. Future writes must follow:

`authenticate → identify client → verify project scope → verify permission → sensitive-file policy → optional approval → safety snapshot → apply → audit`

## Aether AI Platform integration

The Code Vault and Aether AI Platform remain separate applications. A future MCP-to-MCP bridge can allow a Code Vault agent to collect authorized research and publish a structured knowledge artifact to the Aether AI Platform. PDF should be treated as an export format, not the primary system-to-system transport.
