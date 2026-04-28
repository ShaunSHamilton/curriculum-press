# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Frontend (from repo root)
bun install          # install deps
bun run dev          # Vite dev server on :1420 (proxies /api → :8080)
bun run build        # tsc + vite build

# Backend (from repo root)
cargo run            # Axum server on :8080
RUST_LOG=server=debug cargo run  # with debug logging

# Docker (full stack)
docker build -t curriculum-press .
docker run -p 8080:8080 curriculum-press
```

No test framework is configured yet.

## Environment

Copy `sample.env` to `.env`. Required vars:

| Var | Default | Notes |
|-----|---------|-------|
| `PORT` | `8080` | Backend port |
| `COOKIE_KEY` | — | 64+ UTF-8 chars, required |
| `ALLOWED_ORIGINS` | `http://127.0.0.1:<PORT>` | CORS |
| `REQUEST_BODY_SIZE_LIMIT` | `5242880` | bytes |
| `REQUEST_TIMEOUT_IN_MS` | `5000` | |

## Architecture

**Monorepo:** Vite workspace with two packages — `client/` (React builder app) and `packages/blocks/` (shared renderers). Backend is a separate Rust crate.

### Backend (`server/`)

Axum on Tokio. All routes under `/api/v1/`. Request flow:

```
Route handler → validation.rs → Store trait → InMemoryStore (RwLock<HashMap>)
```

`state.rs` holds `ServerState<S: Store>`. The Store trait is the persistence boundary — swap `InMemoryStore` for a DB impl without touching handlers. Business rules live in `domain/validation.rs`, not handlers.

Domain models: `User`, `Organization`, `OrganizationMember`, `Project`, `Curriculum`, `Block`. UUIDs everywhere, serde for JSON.

### Frontend (`client/`)

React 19 + Vite. State via TanStack React Query. Routing via TanStack Router (file-based, rooted at `client/pages/root.tsx`).

All API calls go through `client/lib/api.ts` (fetch wrapper). Auth is a custom header `x-curriculum-user-id` (no sessions/JWT).

UI: sidebar with orgs/projects + tabbed main area (edit, preview, export).

### Shared Blocks (`packages/blocks/`)

Block types: `tile-match`, `category-sort`, `sequence-sorter`, `interactive-diagram`, `syntax-sprint`, `binary-blitz`.

Exports:
- `InteractiveBlockRenderer` — renders a single block
- `CurriculumPlayer` — full playback experience
- Type definitions in `types.ts`

Both the builder (`client/`) and any learner-facing app consume this package.

### Key patterns

- **Chunking:** vite.config.ts splits React, TanStack Query, Router, and icons into separate chunks.
- **React compiler:** babel-plugin-react-compiler enabled — avoid manual `useMemo`/`useCallback` unless profiling shows a need.
- **Strict TypeScript:** `noUnusedLocals` and `noUnusedParameters` are on. Fix them, don't suppress.
- **Prisma:** present in Dockerfile build but not wired into server code — stub for future DB integration.
