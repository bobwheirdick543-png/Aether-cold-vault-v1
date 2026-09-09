# Aether Code Vault — Build Roadmap

## Phase 0 — Infrastructure
- [x] Database/auth/storage foundation exists
- [x] Schema foundation: profiles, user_roles, projects, project_nodes, snapshots, snapshot_entries, activity/audit records, mcp_clients
- [x] Private storage foundation
- [x] Grants/RLS and project isolation foundation

## Phase 1 — Design system & brand
- [x] Aether design tokens and dark vault aesthetic
- [x] Original logo mark / wordmark / app identity
- [x] Motion helpers with reduced-motion support

## Phase 2 — Landing page
- [x] Hero, product introduction, workspace preview, security, versioning, MCP/AI, features, final CTA and footer

## Phase 3 — Auth
- [x] /login /signup /forgot-password /reset-password
- [ ] Client-side route guards on every protected page
- [x] Server-side identity in private server functions

## Phase 4 — Domain services (server)
- [x] AuthorizationService, AuditService, SecurityService
- [x] Project/File/Snapshot foundations
- [ ] Complete ArchiveService abstraction and provider interfaces

## Phase 5 — Dashboard & projects
- [x] Dashboard with real project data and real metrics
- [x] Project workspace route
- [ ] Rename / archive / delete project controls

## Phase 6 — Workspace
- [x] Monaco editor, explorer, tabs, save, unsaved state and filename search
- [x] Real file/folder creation and persistence
- [ ] File/folder rename, move and delete UI
- [ ] Full code search across file contents

## Phase 7 — Snapshots
- [x] Create and list snapshots
- [x] Restore creates a new restore history entry
- [ ] Snapshot compare/diff UI
- [ ] Final non-destructive restore verification pass

## Phase 8 — Archives
- [x] Real ZIP import/export
- [x] Path traversal and unsafe-path checks
- [ ] Deeper archive bomb/compression-ratio enforcement and deployed acceptance tests

## Phase 9 — Admin
- [x] Separate /admin/login
- [x] Server-enforced administrator authorization
- [x] Platform-owner bootstrap using server-only ADMIN_EMAIL
- [x] Overview, users and projects views
- [ ] Storage, security, system and settings views
- [ ] Full admin action controls with audit coverage

## Phase 10 — Real MCP
- [x] Official MCP SDK v2 and Streamable HTTP / createMcpHandler endpoint
- [x] Hashed bearer credentials with expiration/revocation
- [x] Project-scoped permissions
- [x] Read tools and MCP operation auditing
- [ ] Guarded write tools
- [ ] MCP inspector/client acceptance tests

## Phase 11 — Verification
- [x] Build/lint CI workflow added
- [x] Architecture, MCP and environment documentation
- [ ] Browser-driven acceptance tests against deployed infrastructure
- [ ] Security regression pass

## Next implementation pass
1. Finish protected-route guards and project/file rename/move/delete.
2. Add code-content search and snapshot compare.
3. Complete admin storage/security/system/settings views.
4. Run deployed build/lint/browser/MCP verification before exposing write tools.
