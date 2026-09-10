# Aether Code Vault — Build Roadmap

## Phase 0 — Infrastructure
- [x] Database/auth/storage foundation exists
- [x] Schema foundation: profiles, user_roles, projects, project_nodes, snapshots, snapshot_entries, activity/audit records, mcp_clients
- [x] Private storage foundation
- [x] Grants/RLS and project isolation foundation

## Phase 1 — Design system & brand
- [x] Aether design tokens and dark vault aesthetic

## Phase 2 — Landing page
- [x] Hero, product introduction, workspace preview, security, versioning, MCP/AI, features

## Phase 3 — Auth
- [x] /login /signup /forgot-password /reset-password
- [x] Server-side identity in private server functions

## Phase 4 — Domain services (server)
- [x] AuthorizationService, AuditService, SecurityService
- [x] Project/File/Snapshot foundations

## Phase 5 — Dashboard & projects
- [x] Dashboard with real project data and real metrics
- [x] Project workspace route

## Phase 6 — Workspace & editor
- [x] Monaco explorer, tabs, save, unsaved state
- [x] Real file/folder creation and persistence

## Phase 7 — Snapshots
- [x] Create and list snapshots
- [x] Restore creates a new restore history entry

## Phase 8 — Archives
- [x] Real ZIP import/export
- [x] Path traversal and unsafe-path checks

## Phase 9 — Admin
- [x] Separate /admin/login
- [x] Server-enforced administrator authorization
- [x] Platform-owner bootstrap using server-only ADMIN_EMAIL=peacechloe96@gmail.com
- [x] Overview, users and projects views

## Phase 10 — Real MCP
- [x] Official MCP SDK v2 and Streamable HTTP / createMcpHandler endpoint
- [x] Hashed bearer credentials with expiration/revocation
- [x] Project-scoped permissions
- [x] Read tools and MCP operation auditing
- [x] Guarded write tools (create/update/rename/move/delete/snapshot)
- [x] Scopes UI for ChatGPT / Claude / Grok credentials

## Phase 11 — Verification
- [x] Build/lint CI workflow added
- [x] Architecture, MCP and environment documentation

## Platform owner
Existing account: **peacechloe96@gmail.com** — full admin + MCP control plane when ADMIN_EMAIL matches.
