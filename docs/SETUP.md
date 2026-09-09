# Aether Code Vault setup

## Required deployment secrets

Set these as server/deployment secrets. Never place secrets in `VITE_*` variables unless the value is intentionally public.

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server only)
- `ADMIN_EMAIL` (server only; bootstrap configuration)
- `ADMIN_PASSWORD` (server only; bootstrap configuration)

A safe variable template is provided in `.env.example`. The real `.env` file is intentionally not tracked.

## Database and storage

Apply the Supabase migrations in `supabase/migrations`. The project expects a private object-storage bucket named `project-blobs`.

## Local development

```bash
bun install
bun run dev
```

## Verification

```bash
bun run lint
bun run build
```

## MCP

The remote MCP endpoint is:

`/api/mcp`

Create a credential from the administrator MCP control plane. The raw bearer token is shown only once. Configure an MCP client with that token and the endpoint URL.

MCP clients are intentionally project-scoped. Grant only the minimum scopes required.
