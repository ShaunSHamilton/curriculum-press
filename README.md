# Curriculum Press

Curriculum Press is a browser-based builder for interactive curricula. The repo now includes:

- an Axum backend with a `Store` trait and `InMemoryStore` MVP implementation
- a React authoring app with organization, project, curriculum, preview, and export flows
- a shared local React block library in `packages/blocks` used by both builder preview and curriculum playback

## Workspace

- `client/`: Vite + React builder application
- `server/`: Axum API, domain models, validation, and in-memory store
- `packages/blocks/`: shared learner-facing block renderers and shared block schemas
- `docs/`: implementation notes and maintainership docs

## Core Flow

1. Sign up or sign in with a lightweight MVP auth flow.
2. Create an organization and add members.
3. Create a project, which automatically creates its curriculum container.
4. Add interactive blocks from the catalog and configure them with structured forms.
5. Preview a single block or the full curriculum with the shared player.
6. Export curriculum JSON or fetch the public payload from `/api/v1/public/projects/:projectId`.

## Running

Backend:

```bash
cargo run
```

Frontend:

```bash
npm install
npm run dev
```

Production build:

```bash
npm run build
```

Note:
The current environment used during implementation had Node `18.19.1`, which produced successful builds but emitted a Vite warning recommending Node `20.19+` or `22.12+`.

## Extending Blocks

Shared block types live in [packages/blocks/src/types.ts](/home/shauh/constellations/curriculum-press/packages/blocks/src/types.ts).

To add a new interactive block:

1. Add the new config type and catalog metadata in `packages/blocks/src/types.ts`.
2. Add its renderer in [packages/blocks/src/index.tsx](/home/shauh/constellations/curriculum-press/packages/blocks/src/index.tsx).
3. Mirror its validation in [server/domain/validation.rs](/home/shauh/constellations/curriculum-press/server/domain/validation.rs).
4. Add its structured form in [client/components/block-editor.tsx](/home/shauh/constellations/curriculum-press/client/components/block-editor.tsx).

## Store Swap Guidance

The backend mutation boundary is the `Store` trait in [server/domain/store.rs](/home/shauh/constellations/curriculum-press/server/domain/store.rs).

To replace the in-memory implementation:

1. Add a new store type that implements `Store`.
2. Preserve the existing domain return types so Axum handlers stay thin.
3. Swap the store initialization in [server/app.rs](/home/shauh/constellations/curriculum-press/server/app.rs).

## Export Format

The public/export payload shape is:

```json
{
  "project": { "...": "project metadata" },
  "curriculum": { "...": "curriculum metadata plus ordered block ids" },
  "blocks": [
    {
      "id": "uuid",
      "type": "tile-match",
      "title": "Block title",
      "description": "Optional helper copy",
      "config": {},
      "settings": {}
    }
  ]
}
```

That same block payload is what the builder preview and `CurriculumPlayer` consume.

