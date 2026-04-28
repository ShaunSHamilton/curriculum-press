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
