# Aether Code Vault — Build Roadmap

## Phase 0 — Infrastructure
- [ ] Enable Lovable Cloud (database, auth, storage)
- [ ] Schema: profiles, user_roles, projects, project_nodes, snapshots, snapshot_entries, audit_events, mcp_clients, mcp_tokens
- [ ] Private storage bucket for file contents + snapshot archives
- [ ] Grants + RLS on every table

## Phase 1 — Design system & brand
- [ ] Aether design tokens in src/styles.css (dark vault aesthetic, no purple)
- [ ] Original logo mark / wordmark / app icon / favicon
- [ ] Shared UI primitives + motion helpers (reduced motion respected)

## Phase 2 — Landing page
- [ ] Hero, product intro, workspace, security, versioning, MCP/AI, features, privacy, vision, final CTA, footer

## Phase 3 — Auth
- [ ] /login /signup /forgot-password /reset-password
- [ ] Auth gate for _authenticated subtree
- [ ] Server-side identity in all server functions

## Phase 4 — Domain services (server)
- [ ] AuthorizationService, AuditService, SecurityService
- [ ] ProjectService, FileService, SearchService, SnapshotService, ArchiveService
- [ ] Repositories + provider abstraction (DatabaseProvider / ObjectStorageProvider)

## Phase 5 — Dashboard & projects
- [ ] /dashboard, /projects, /projects/:id, real metrics, empty states
- [ ] Create / rename / archive / delete / export

## Phase 6 — Workspace
- [ ] /projects/:id/workspace: Monaco, explorer, tabs, save, unsaved state, search
- [ ] File & folder CRUD, rename, move, validation

## Phase 7 — Snapshots
- [ ] /projects/:id/snapshots: create, list, compare, restore (non-destructive history)

## Phase 8 — Archives
- [ ] ZIP import with full safety validation
- [ ] ZIP export

## Phase 9 — Admin
- [ ] /admin/login separate experience, platform_owner bootstrap via server secrets
- [ ] /admin overview, users, projects, storage, activity, security, mcp, system, settings

## Phase 10 — Real MCP
- [ ] Streamable HTTP MCP endpoint with official SDK
- [ ] Token auth, project-scoped permissions, read tools + guarded write tools
- [ ] Audit every MCP operation

## Phase 11 — Verification
- [ ] Browser-driven acceptance tests (user, security, admin, MCP)
- [ ] Docs: architecture, setup, env example
