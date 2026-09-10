# Aether Code Vault — MCP

## Endpoint

`https://<your-domain>/mcp` — official MCP Streamable HTTP.

Supports **Bearer tokens** and **OAuth 2.1 (PKCE)** for Claude, ChatGPT, and Grok.

## Auth option A — Bearer token (Settings → MCP)

1. Create a credential in **Settings → MCP**
2. Copy the one-time `acv_...` token
3. Send `Authorization: Bearer acv_...` on every MCP request

## Auth option B — OAuth (Claude / Grok / ChatGPT Connect)

| Field | Value |
|--------|--------|
| Server URL | `https://<your-domain>/mcp` |
| Client ID | `aether-vault-mcp` (or `MCP_OAUTH_CLIENT_ID`) |
| Client Secret | optional with PKCE; set `MCP_OAUTH_CLIENT_SECRET` if required |
| Authorization endpoint | `https://<your-domain>/oauth/authorize` |
| Token endpoint | `https://<your-domain>/oauth/token` |
| Token auth method | `none` (PKCE) recommended |

Discovery:

- `/.well-known/oauth-authorization-server`
- `/.well-known/oauth-protected-resource`

Flow: AI client → authorize page → sign in → **Allow access** → token → `/mcp` tools.

## Platform owner

`ADMIN_EMAIL=peacechloe96@gmail.com` (server-only).
