# Curriculum Press Implementation Notes

## Current Workspace Layout

- `client/`: Vite + React frontend application
- `server/`: Axum backend service
- `packages/blocks/`: local React block library for shared preview/player rendering
- `docs/`: implementation notes and maintainership documentation

## Template Gaps Found

- The frontend started as a near-empty TanStack Router shell.
- The backend only exposed a health check with no domain model or store layer.
- No shared block catalog, authoring workflow, or export path existed yet.
- No cohesive dark product theme had been implemented.

## Implementation Direction

- Keep all backend mutations behind the Rust `Store` trait.
- Use `InMemoryStore` for MVP data flows so future persistence remains swappable.
- Build the learner-facing block renderers in `packages/blocks` and reuse them inside the builder preview.
- Keep the frontend as a builder-first workspace with dark, high-contrast styling and structured block forms.

## Export and Integration Notes

- Export JSON is served from `/api/v1/projects/:projectId/export`.
- Public curriculum consumption is served from `/api/v1/public/projects/:projectId`.
- The payload shape intentionally matches the prop contract expected by `CurriculumPlayer`.

## Future Persistence Swap

- The in-memory store currently owns users, organizations, memberships, projects, curricula, and blocks in `RwLock<HashMap<...>>` collections.
- New persistence layers should implement the same `Store` trait and preserve validation before data is written.
- Keep route handlers transport-focused and continue pushing business rules into the store and validation modules.
