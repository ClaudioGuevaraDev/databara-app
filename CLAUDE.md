# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Databara is a Tauri v2 desktop database client: a React 19 + TypeScript frontend (Vite, Tailwind, Monaco editor) over a Rust backend that talks to PostgreSQL via `tokio-postgres`.

> `AGENTS.md` is the source of truth for contribution rules; the key points are summarized below. Use **pnpm only**, and keep dependency versions in `package.json` **exact** (no `^`/`~` ranges).

## Commands

```bash
pnpm run dev          # Vite frontend only, port 1420 (browser; no Tauri/DB access)
pnpm run tauri:dev    # full desktop app (frontend + Rust backend) — needed to exercise DB features
pnpm run build        # tsc typecheck + vite build (produces dist/)
pnpm run lint         # tsc --noEmit + eslint .
pnpm run format:check # prettier verification
```

There is **no test framework**. The validation gate for any change is: `pnpm run lint`, `pnpm run format:check`, `pnpm run build`, and `cargo check` (run inside `src-tauri/`).

`scripts/seed-postgres.sql` seeds a local database for manual testing.

## Coding conventions

- **TypeScript strict mode.** Use explicit types for shared/cross-boundary data structures. Avoid `any` unless there is a narrow, documented reason.
- **React function components only.** One component per `.tsx` file — if a file grows a second component, extract it to its own file.
- **Layering:** keep UI, domain logic, and data access separated. Components and the workspace context must **not** call database drivers or `invoke` directly — all data access goes through `databaraService.ts` → Tauri commands → Rust services (see Architecture below).
- **Naming:** `PascalCase` for components and component files (`PascalCase.tsx`); `camelCase` for hooks, utilities, and helper files (`camelCase.ts`).
- **Formatting is Prettier-controlled:** 2 spaces, semicolons, double quotes, 100-char print width, Tailwind class sorting. Run `pnpm run format` before large UI changes.

## Commits & security

- Use Conventional Commit messages (e.g. `feat: add connection dialog layout`, `fix: ignore tauri target in vite watcher`, `chore: configure prettier`). PRs should include a short summary, screenshots for UI changes, and the validation commands run.
- Never commit credentials, local database URLs, build output, or logs. Connection passwords live only in transient frontend state and are never persisted (the long-term plan is the OS keychain, never plain text — see Persistence below).

## Architecture

### Frontend ↔ backend boundary

All communication with the Rust backend funnels through **`src/app/databaraService.ts`** — the only file that calls Tauri's `invoke`. Components and the workspace context never invoke commands directly. This service also normalizes types crossing the boundary: the backend reports `engine: "PostgreSQL"`, which is normalized to the frontend's `"postgresql"` `DatabaseEngine`, and server tree-node IDs are rewritten to embed the engine.

The Rust side exposes exactly seven commands (registered in `src-tauri/src/lib.rs` via `generate_handler!`): `test_postgres_connection`, `connect_postgres`, `list_postgres_tree`, `get_postgres_object_details`, `run_postgres_query`, `set_unsaved_sql_tabs`, `close_main_window_after_unsaved_resolution`.

### Rust backend (`src-tauri/src/lib.rs`, single file)

- `AppState` (a `Mutex<AppState>` managed by Tauri) holds live connections in a `HashMap<String, PostgresSession>` keyed by a sanitized connection ID, plus the unsaved-tabs flag and a close-override flag.
- Connecting opens a `tokio-postgres` `Client` (TLS via `native_tls` for Prefer/Require, plain for Disable), stores it in the session map, and returns a profile + the object tree.
- The schema tree, column/index definitions, and row-count estimate are all built by querying `pg_catalog` directly (see `list_tree_for_client`, `load_columns`, `load_indexes`, `estimate_row_count`).
- Object IDs are strings like `table:schema.name` / `view:schema.name`, parsed by `parse_object_id`.

### Frontend state: the Workspace context

Nearly all app state lives in one provider, **`src/app/workspace/workspaceContext.tsx`** (`WorkspaceProvider`). It is split deliberately across three files:

- `workspaceCore.ts` — context type definitions plus narrow **selector hooks** (`useExplorer`, `useSqlEditor`, `useResults`, `useObjectDetailsPanel`, `useDialogs`, etc.). Components subscribe through these, not the raw context.
- `workspaceContext.tsx` — the provider implementation (all `useState`/`useCallback` logic).
- `workspaceContext.utils.ts` / `workspaceSqlTabs.ts` — pure helpers for tree merging, connection keys, and SQL-tab persistence.

When adding state or actions, extend the `WorkspaceState`/`WorkspaceActions` types in `workspaceCore.ts`, implement in the provider, and expose via the relevant selector hook.

### Persistence (localStorage, not the backend)

Saved connection drafts and per-connection SQL tabs are persisted in **`window.localStorage`** under versioned keys (`databara.connections.v1`, `databara.sqlTabs.v1:<connectionKey>`). Both loaders include migration paths from legacy keys. **Passwords are never persisted** — `StoredConnectionDraft` omits `password`, and reconnecting a saved connection prompts for it (`PasswordConnectionDialog`).

### SQL tabs: temporary vs official

Tabs have a `state` of `"temporary"` or `"official"` (VS Code "preview tab" pattern). Single-clicking an object opens/reuses a temporary tab; confirming (double-click) "officializes" it. Only official tabs are persisted. The officialize/merge logic lives in `workspaceSqlTabs.ts` (`officializeSqlTab`).

> **SQL execution is implemented.** `runQuery` runs the active tab's SQL via the `run_postgres_query` command (which uses `query_raw` to also report `rowsAffected`/`commandTag`) and renders rows in the results grid — for SELECT/WITH and for any statement that returns rows (e.g. `RETURNING`); non-row statements show a status message like "DELETE · 3 rows affected" (`formatCommandMessage`). Read queries are paginated at the SQL level: the helpers in `workspaceContext.utils.ts` (`isReadQuery`, `normalizeBaseSql`, `buildCountSql`, `buildPageSql`) wrap the query as a subquery, run a `COUNT(*)` once per Run, and fetch each page with `LIMIT`/`OFFSET` (default 50; footer `ResultsFooter.tsx`). **Query results are per-tab**: the provider keeps a `resultsByTab` map keyed by SQL-tab id (in-memory, never persisted); `useResults` exposes the active tab's `queryState`/`queryResult`/`queryPagination`/`queryError`. Errors render inline in the Results section; all `notify(...)` calls surface through the `Toaster` (`components/ui/Toaster.tsx`, mounted in `WorkspaceShell`) reading `state.toast`. The Rust `cell_to_string` helper converts arbitrary column types to strings (NULL → `None`). `previewObject` is still a stub.

### Multi-engine abstraction (PostgreSQL-only today)

Despite "postgres" naming throughout, the code is structured for future engines: `DatabaseEngine` type, the `connectionEngines.ts` registry, and engine normalization in `databaraService.ts`. Only `postgresql` is supported — `ensureSupportedConnectionEngine` throws for anything else.

### Unsaved-tabs-on-close flow

Closing the window with dirty tabs is intercepted in Rust (`on_window_event` → `prevent_close`), which dispatches a `databara-unsaved-tabs-close-requested` DOM event. The frontend listens for it (and Tauri's `onCloseRequested`) to show `UnsavedTabsDialog`; resolving calls `close_main_window_after_unsaved_resolution`, which sets the close-override flag and closes the window.

### Component layout

`src/app/components/` groups UI by area: `explorer/` (DB tree sidebar), `workspace/` (editor + tabs + Monaco), `results/` (data grid, schema/columns views), `object-details/`, `dialogs/`, `layout/`, and reusable primitives in `ui/`. SQL autocompletion for Monaco is built in `src/app/editor/sqlCompletion.ts`. Tailwind theming uses CSS-variable tokens (`background`, `foreground`, `primary`, `muted`, `destructive`) defined in `src/styles/globals.css`.
