# Aether Code Vault — Build Roadmap

## Phase 0 — Infrastructure
- [x] Enable Lovable Cloud (database, auth, storage)
- [x] Schema: profiles, user_roles, projects, project_nodes, snapshots, snapshot_entries, audit_events, mcp_clients, mcp_tokens
- [x] Private storage bucket for file contents + snapshot archives
- [x] Grants + RLS on every table

## Phase 1 — Design system & brand
- [x] Aether design tokens in src/styles.css (dark vault aesthetic, no purple)
- [x] Original logo mark / wordmark / app icon / favicon
- [x] Shared UI primitives + motion helpers (reduced motion respected)

## Phase 2 — Landing page
- [x] Hero, product intro, workspace, security, versioning, MCP/AI, features, privacy, vision, final CTA, footer

## Phase 3 — Auth
- [x] /login /signup /forgot-password /reset-password
- [x] Auth gate for authenticated application flows
- [x] Server-side identity in existing server/domain services

## Phase 4 — Domain services (server)
- [x] AuthorizationService, AuditService, SecurityService
- [x] Project/File/security foundations
- [x] Repositories + provider abstraction (DatabaseProvider / ObjectStorageProvider)

## Phase 5 — Dashboard & projects
- [x] /dashboard, /projects/:id, real metrics, empty states
- [x] Create / rename / archive / delete / export entry points

## Phase 6 — Workspace
- [x] /projects/:id/workspace: Monaco, explorer, save, unsaved state, search
- [x] File & folder CRUD with validation and persistent storage

## Phase 7 — Snapshots
- [x] Create, list, compare, restore with non-destructive history

## Phase 8 — Archives
- [x] ZIP import with path, size, count and sensitive-name safety validation
- [x] ZIP export

## Phase 9 — Admin
- [x] /admin/login separate experience
- [x] /admin overview, users, projects, storage, activity, security, MCP, system, settings
- [ ] Platform-owner environment bootstrap UX needs deployment-specific verification

## Phase 10 — Real MCP
- [x] Modern MCP v2 Streamable HTTP handler using the 2026-07-28 SDK line
- [x] Token authentication with hashed credentials
- [x] Project-scoped permissions and read tools
- [x] Audit every MCP operation
- [ ] Guarded MCP write tools remain intentionally disabled until verification/safety review

## Phase 11 — Verification
- [ ] Browser-driven acceptance tests (user, security, admin, MCP)
- [x] Docs: architecture, setup, env example
- [ ] Production deployment verification and live MCP client interoperability test
