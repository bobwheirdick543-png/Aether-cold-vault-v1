# Aether Code Vault — MCP

## Endpoint

`POST/GET /mcp` — official Model Context Protocol (Streamable HTTP) via `@modelcontextprotocol/server` v2.

Compatible with **ChatGPT**, **Claude**, and **Grok** MCP clients using Bearer authentication.

## Auth

1. In the app: **Settings → MCP** → issue a credential.
2. Grant scopes (read and/or write) and optional project scope.
3. Copy the one-time token (`acv_...`).
4. Configure the AI client:
   - **URL:** `https://<your-domain>/mcp`
   - **Header:** `Authorization: Bearer acv_...`

Tokens are stored only as SHA-256 hashes. Revocation is immediate.

## Platform owner

The platform owner is the existing account **peacechloe96@gmail.com**.
Set server secret `ADMIN_EMAIL=peacechloe96@gmail.com` (never expose to the browser).

## Tools (scoped)

Read: `list_projects`, `get_project`, `get_project_tree`, `list_files`, `get_file_metadata`, `read_file`, `search_files`, `search_code`, `get_snapshot`, `compare_snapshots`

Write: `create_file`, `update_file`, `create_folder`, `rename_file`, `move_file`, `delete_file`, `create_snapshot`, `restore_snapshot`

Only tools matching the client’s granted scopes are registered. All operations use the same domain services, authorization, sensitivity policy, and audit path as the web UI.

## Architecture

`AI client → MCP (/mcp) → bearer verify → scopes + project scope → domain services → Postgres + private storage`
