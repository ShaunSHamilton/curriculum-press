# Curriculum Press PRD

This document is the master product and implementation brief for **Curriculum Press**. It is written to support agentic, task-based delivery across product, frontend, backend, shared types, and integration workstreams.

---

## 1. Product Summary

**Curriculum Press** is a browser-based builder for interactive learning curricula. It lets teams create accounts, collaborate inside organizations, build projects, add predefined interactive learning blocks, configure each block with content data, preview the learner experience, and publish or export the resulting curriculum for use on external websites.

The product should feel like a **website builder for interactive lessons**:

- authors assemble a curriculum from reusable blocks
- each block has a predefined interaction model
- authors supply the content, assets, rules, and settings
- the platform renders both editor previews and learner-facing output from the same block engine

For MVP, all domain data manipulation must go through an abstract Rust store interface backed by an **in-memory implementation**. The architecture must keep replacement with a persistent datastore straightforward. Dolt-backed versioning is an intended follow-on capability and should be designed for, but not required to complete MVP.

---

## 2. Terminology

Use **Interactive Blocks** as the primary product term.

- Avoid calling them "games" in the product UI and technical docs.
- "Interactive Blocks" keeps the tone professional for education, training, and enterprise buyers while still signaling engagement.
- Individual block types may still be playful in presentation, but the platform language should remain builder-oriented.

Other terms:

- **Organization**: a collaborative tenant/workspace
- **Project**: a curriculum-building workspace inside an organization
- **Curriculum**: the ordered sequence of interactive blocks and related metadata inside a project
- **Block Configuration**: the structured content/settings for a single interactive block
- **Player**: the learner-facing renderer for one block or a full curriculum

---

## 3. Product Goals

### Primary goals

- Enable non-developer content authors to build interactive browser-based curricula from predefined templates.
- Support collaborative organization/project workflows.
- Ensure each block can be previewed individually and inside the full curriculum flow.
- Expose curriculum data through export and HTTP APIs for use on external websites.
- Reuse the exact same React block components in the editor preview and in external integrations.

### Secondary goals

- Make it easy to add new block types later without reshaping the entire system.
- Support pedagogically different interaction patterns suited to memorization, fluency, sequencing, inspection, classification, and decision-making.
- Prepare the domain architecture for future persistence, versioning, analytics, and publishing workflows.

### Non-goals for MVP

- Rich WYSIWYG page layout editing beyond curriculum composition
- Real-time multiplayer editing
- SCORM/LTI support
- Deep analytics dashboards
- Full Git-like branching/merging UX
- AI-generated curriculum content

---

## 4. Target Users

### Primary users

- Instructional designers
- Teachers and tutors
- Corporate training teams
- Subject matter experts working with a content editor

### Secondary users

- Developers embedding curricula into external sites/apps
- Reviewers/stakeholders who need to preview and approve a curriculum before release

---

## 5. Core User Outcomes

- I can sign up and start working without needing engineering support.
- I can organize content under my organization and project structure.
- I can choose from a set of proven interactive block patterns instead of building interactions from scratch.
- I can enter my own data and assets into each block template.
- I can immediately preview whether a block teaches the concept the way I expect.
- I can run through the full curriculum as a learner would.
- I can export or serve the curriculum to another website without rewriting the interaction logic.

---

## 6. Experience Principles

- **Builder-first:** authoring must feel clear, structured, and low-friction.
- **Same engine everywhere:** preview, curriculum player, and external embed must use the same React block implementations.
- **Schema-driven authoring:** each block type must have a clear config schema and editor form model.
- **Pedagogy-aware templates:** block types should map cleanly to the kinds of concepts and skills they teach best.
- **Dark, focused workspace:** the app should use a very dark shadcn-based theme that feels serious, modern, and high-contrast without becoming neon or game-like.

---

## 7. UI and Theme Requirements

The repository already contains the stack/tooling template. The implementation must add a **very dark shadcn theme** and keep it consistent across app shell, forms, preview surfaces, dialogs, tables, and navigation.

### Theme direction

- Use shadcn/ui patterns and tokens.
- Default to a very dark interface, roughly in the range of charcoal/near-black surfaces.
- Keep contrast strong enough for long editing sessions.
- Use restrained accent colors for state and emphasis rather than colorful gradients everywhere.
- The product should feel like a professional creative tool, not a marketing site.

### Theme acceptance criteria

- Global color tokens are defined and applied consistently.
- Navigation, cards, tables, dialogs, inputs, and tabs all match the same dark system.
- Interactive preview areas are visually distinct from editing chrome.
- Empty states, validation states, and disabled states remain legible in the dark theme.

---

## 8. Functional Scope

### 8.1 Identity and organizations

- User sign up
- User sign in/out
- Organization creation
- Organization membership/invitation model
- Organization switcher

### 8.2 Project and curriculum management

- Create project
- List/search projects within organization
- Open project dashboard
- Maintain project metadata such as name, description, audience, status
- Create curriculum within the project if curriculum is modeled separately, or treat project as the curriculum container

### 8.3 Interactive block authoring

- Add a block from a predefined catalog
- Configure block-specific content and settings
- Reorder blocks in the curriculum
- Duplicate/delete blocks
- Save draft changes

### 8.4 Preview

- Preview a single block
- Preview the whole curriculum in sequence
- Use the same rendering engine as the external player

### 8.5 Delivery and integration

- Export curriculum JSON
- Serve curriculum JSON over HTTP API
- Provide a React component library for external embedding
- Allow external sites to render either single blocks or a full curriculum player

---

## 9. Interactive Block Catalog

Each block type exists because it is well-suited to a specific kind of learning objective. The authoring UI should help authors choose a block based on what they are trying to teach, not only on visual format.

### Initial block catalog for MVP planning

| Block Type | Best For | Core Interaction | MVP Complexity |
| :--- | :--- | :--- | :--- |
| Tile Match | Memorization of paired concepts | Match image-text or text-text pairs | Low |
| Interactive Diagram | Anatomy, part identification, location-based recall | Click hotspots or label regions | Medium |
| Spot the Difference | Visual discrimination and nuance | Compare two visuals and identify differences | Medium |
| Category Sort | Classification and grouping | Drag items into buckets | Low |
| Sequence Sorter | Timelines, processes, assembly order | Arrange items in order | Low |
| Ranking Battle | Prioritization and relative judgment | Rank items top-to-bottom by a metric | Medium |
| Syntax Sprint | Typing accuracy, formula recall, syntax fluency | Type displayed text accurately under constraints | Medium |
| Scrambled Sentence | Grammar, code ordering, logical sequence | Rebuild a sentence or snippet in correct order | Low |
| Binary Blitz | Rapid recognition and classification | Fast yes/no or left/right judgments | Low |
| Whack-a-Concept | Distractor filtering and quick recall | Click only valid targets in a field of distractors | Low |
| Hidden Hotspots | Inspection, anomaly detection, quality review | Find required targets in an image | Medium |
| Branching Narrative | Decision-making, diagnostics, soft skills | Choose paths through a scenario tree | High |
| Simulation | Math/physics/system behavior | Manipulate variables and observe outcomes | High |

### Examples of concept fit

- birds, knots, plants: Tile Match, Category Sort, Spot the Difference, Binary Blitz
- fastener anatomy or assembly: Interactive Diagram, Sequence Sorter, Hidden Hotspots
- software bug triage or emergency response: Ranking Battle, Branching Narrative
- language, programming syntax, formula recall: Syntax Sprint, Scrambled Sentence
- mathematics and physics: Simulation

### Gamification levers to support across block types where relevant

- streaks
- score
- timer
- lives/hearts
- difficulty presets
- retries
- distractor density
- speed ramping
- guided mode versus expert mode
- ghost/personal best comparison

Not every block needs every lever in MVP, but the domain model should allow block-level settings for these concepts where relevant.

---

## 10. Product Decisions

### React library

**Decision:** yes, Curriculum Press should ship a React library.

Rationale:

- it guarantees parity between builder preview and production usage
- it avoids rebuilding block logic inside customer websites
- it creates a clean separation between authoring platform and rendering engine

Suggested package direction:

- `@curriculum-press/blocks` for individual block components and shared types
- `@curriculum-press/player` or a combined package if keeping scope small

### Versioning strategy

**Decision:** MVP uses an abstract store with an in-memory implementation. Future persistence and versioning must be planned but deferred.

Rationale:

- the user requested in-memory data manipulation abstraction for initial implementation
- this keeps the first build simpler and faster
- the store trait and domain boundaries should make a Dolt-backed or SQL-backed implementation replaceable later

### Data delivery strategy

**Decision:** support both JSON export and HTTP API delivery in MVP.

Rationale:

- some customers will want static export workflows
- others will want runtime integration from their own websites

---

## 11. User Stories

### Identity and organization

- As a new user, I want to create an account so that I can start building curricula.
- As a user, I want to create an organization so that my team’s projects are grouped together.
- As an organization admin, I want to invite or add members so we can collaborate on the same work.
- As a user belonging to multiple organizations, I want to switch between them easily.

### Project setup

- As a content creator, I want to create a project so that I can organize one curriculum around a topic or training goal.
- As a content creator, I want to define project metadata such as title, audience, and description so the curriculum has clear context.

### Block authoring

- As a content creator, I want to browse a catalog of interactive blocks so I can choose the best interaction style for a learning objective.
- As a content creator, I want to add a block to my project and configure it with my own data so I can turn content into an interactive lesson.
- As a content creator, I want the editor to use structured forms for common fields so that I do not need to hand-author JSON for routine work.
- As a more technical creator, I want optional access to raw configuration data so I can troubleshoot or work faster.
- As a content creator, I want to reorder blocks so I can shape the learner journey.
- As a content creator, I want to duplicate a block so I can reuse a pattern with small changes.

### Preview and review

- As a creator, I want to preview an individual block so I can validate its content, behavior, and appearance.
- As a reviewer, I want to play through the full curriculum so I can evaluate the flow from a learner perspective.
- As a stakeholder, I want preview output to match production rendering so I can trust approvals.

### Integration and publishing

- As a developer, I want to fetch curriculum data from an HTTP API so I can integrate it into an external website.
- As a developer, I want to export curriculum JSON so I can use it in static or offline workflows.
- As a developer, I want a React library of the interactive blocks so I can render them without reimplementing the interaction logic.
- As a developer, I want to render either a single block or a full curriculum player depending on my embedding needs.

### Future versioning stories

- As a creator, I want draft/published versions so I can edit safely before release.
- As a lead reviewer, I want to compare revisions so I can understand what changed.
- As an admin, I want rollback capability so I can recover from bad publishes.

---

## 12. System Architecture

### Frontend

- Vite
- React
- TypeScript
- TanStack Query for server state
- TanStack Router if the template already includes it or it aligns with the app shell
- TanStack Table for management screens where useful
- shadcn/ui for components

### Backend

- Rust
- Axum
- Tokio
- domain-oriented modules for business logic
- store abstraction with in-memory backing implementation for MVP

### Shared contract

- shared schema/types between frontend and backend for core entities where practical
- stable serialized config shape per block type
- explicit validation layer on both client and server boundaries

### Component library

- React component library for interactive blocks and curriculum player
- consumed by the builder preview and by external integrators

---

## 13. Domain Model

These models may be refined during implementation, but the core relationships should hold.

### Core entities

- `User`
- `Organization`
- `OrganizationMember`
- `Project`
- `Curriculum`
- `InteractiveBlock`
- `BlockDefinition`
- `BlockConfig`
- `AssetReference`
- `PublishableExport`

### Suggested relationships

- a user can belong to many organizations
- an organization has many projects
- a project owns one active curriculum for MVP
- a curriculum contains an ordered list of interactive blocks
- each interactive block references one block definition/type and one config object

### Example Rust abstraction

```rust
pub trait Store: Send + Sync {
    fn create_user(&self, input: CreateUser) -> Result<User, StoreError>;
    fn create_organization(&self, input: CreateOrganization) -> Result<Organization, StoreError>;
    fn add_member(&self, input: AddOrganizationMember) -> Result<OrganizationMember, StoreError>;

    fn create_project(&self, input: CreateProject) -> Result<Project, StoreError>;
    fn get_project(&self, project_id: Uuid) -> Result<Project, StoreError>;
    fn list_projects(&self, organization_id: Uuid) -> Result<Vec<Project>, StoreError>;

    fn create_curriculum(&self, input: CreateCurriculum) -> Result<Curriculum, StoreError>;
    fn update_curriculum(&self, curriculum: Curriculum) -> Result<Curriculum, StoreError>;

    fn create_block(&self, input: CreateBlock) -> Result<InteractiveBlock, StoreError>;
    fn update_block(&self, block: InteractiveBlock) -> Result<InteractiveBlock, StoreError>;
    fn reorder_blocks(&self, curriculum_id: Uuid, ordered_ids: Vec<Uuid>) -> Result<(), StoreError>;
}
```

### MVP store implementation

- `InMemoryStore`
- internal maps can use `RwLock<HashMap<...>>` or `DashMap` depending on implementation preference
- no persistence guarantees
- data reset on process restart is acceptable for MVP

### Future store implementations

- SQL-backed persistent store
- Dolt-backed curriculum/version store

---

## 14. Block Configuration Model

Every block type must have:

- a stable `type`
- a human-readable `name`
- a config schema
- editor metadata for rendering forms
- validation rules
- preview support

Suggested common shape:

```ts
type InteractiveBlock = {
  id: string
  type: string
  title: string
  description?: string
  config: Record<string, unknown>
  settings: {
    timerSeconds?: number
    showScore?: boolean
    allowRetry?: boolean
    difficulty?: "easy" | "medium" | "hard"
  }
}
```

Implementation guidance:

- use schema-first validation such as Zod on the frontend if already aligned with the template
- mirror core validation in Rust on the backend
- avoid free-form unvalidated JSON as the only editing path

---

## 15. API Requirements

### Authenticated app API

- create account
- sign in
- create/list organizations
- create/list projects
- create/update/delete/reorder blocks
- preview data retrieval
- export curriculum JSON

### Public or integration API

- fetch project/curriculum by published identifier
- fetch full curriculum JSON
- optionally fetch a single block payload if needed for external embeds

### API design requirements

- version endpoints cleanly
- keep learner-facing payloads separate from internal editor-only metadata where possible
- include enough metadata for external consumers to choose the correct block renderer

---

## 16. Frontend Requirements

### App areas

- auth screens
- organization/project selection
- project dashboard
- curriculum builder
- block catalog picker
- block configuration editor
- single-block preview
- full curriculum preview
- export/publish area

### Builder workflow

1. user opens a project
2. user sees the curriculum outline
3. user adds a block from the catalog
4. user configures content/settings
5. user previews the block
6. user reorders blocks
7. user previews the full curriculum
8. user exports or publishes via API

### UX requirements

- the outline and editor should support efficient repeated authoring
- preview must be one click away from editing
- forms should be structured per block type and not force raw JSON by default
- validation errors should be specific and actionable

---

## 17. Backend Requirements

### Service responsibilities

- authentication and session/token handling
- organization/project/curriculum CRUD
- block validation and persistence through store abstraction
- export serialization
- integration API responses

### Architecture requirements

- keep HTTP handlers thin
- place domain logic in reusable Rust modules
- isolate store trait from transport concerns
- make it easy to swap `InMemoryStore` for another implementation later

---

## 18. External Integration Requirements

### React library requirements

- expose individual block components
- expose a curriculum player that sequences blocks
- accept typed props only, no backend dependency
- emit completion/progress events where useful

### External usage patterns

- host app fetches curriculum JSON and renders locally
- host app passes already-fetched JSON into the player
- host app renders a single interactive block in a custom page

### Why this matters

- editor preview and external rendering stay consistent
- integration remains lightweight
- future SDK growth is easier

---

## 19. MVP Definition

MVP is complete when:

- users can create accounts
- users can create and join organizations
- users can create projects
- users can add interactive blocks from a predefined catalog
- users can configure at least a meaningful starter subset of block types
- users can preview individual blocks
- users can preview the whole curriculum
- users can export curriculum JSON
- backend can serve curriculum JSON over HTTP
- a React library can render the same block definitions externally
- the builder uses a coherent very dark shadcn theme

### Recommended MVP block subset

- Tile Match
- Category Sort
- Sequence Sorter
- Interactive Diagram
- Syntax Sprint
- Binary Blitz

This gives a good spread of memorization, sorting, identification, typing, and fluency interactions without overloading the first release.

---

## 20. Post-MVP Roadmap

### Persistence

- replace in-memory store with persistent database implementation

### Versioning

- add draft/published states
- add revision history
- add Dolt-backed branching, commit, compare, merge, rollback if the product still benefits from Git-like content workflows

### Analytics

- capture learner completion and score events
- expose analytics summaries to authors

### Collaboration

- richer membership roles
- review/approval flow
- comments

### Distribution

- npm package publishing
- embeddable script loader if React-only integration proves too restrictive

---

## 21. Risks and Open Questions

### Risks

- too many block types in MVP could slow delivery
- schema design can become inconsistent if block configs are not standardized early
- preview/editor parity will break if the library and app diverge
- drag-and-drop plus structured editing can become cumbersome if the curriculum outline UX is weak

### Open questions to resolve during implementation

- whether curriculum is a distinct entity or just the ordered content inside a project
- which auth model the template already favors
- whether assets are uploaded in MVP or referenced by URL only
- whether external API access requires published snapshots or can read current draft data

---

## 22. Agentic Implementation Plan

This section is the execution-oriented breakdown agents should follow.

### Phase 0: align the template

- inspect the existing Vite/React/TypeScript/TanStack and Rust/Axum template
- confirm package/workspace structure
- add shadcn/ui if missing
- implement the very dark theme tokens and app shell foundation

### Phase 1: establish shared domain contracts

- define core frontend/backend types
- define block catalog metadata
- define config schemas for initial MVP block subset
- create store trait and in-memory implementation

### Phase 2: auth, organization, and project flows

- implement account and session flow
- implement organization create/join flows
- implement project CRUD and navigation

### Phase 3: curriculum builder

- implement curriculum outline
- implement block picker
- implement block editor forms
- implement reordering and duplication

### Phase 4: player library and preview

- create shared React block library
- implement starter block components
- wire single-block preview and full curriculum preview to the shared library

### Phase 5: export and API delivery

- implement export JSON flow
- implement integration API endpoints
- verify external rendering with the React library

### Phase 6: hardening

- add validation, error states, and empty states
- test theme consistency
- test builder/player parity
- document extension points for future persistent store and versioning

---

## 23. Acceptance Criteria by Workstream

### Product and UX

- block catalog explains what each block is good for
- authors can complete the main workflow without reading technical docs
- the dark theme feels cohesive across the app

### Frontend

- builder supports project, block, preview, and export flows
- forms validate block configs cleanly
- curriculum ordering is usable and stable

### Backend

- store abstraction is the only path to domain data mutation
- in-memory store satisfies all MVP flows
- API responses are stable and typed

### Shared library

- external app can render a single block with typed config
- external app can render an ordered curriculum player
- preview and external output match behaviorally

---

## 24. Done Definition

The PRD is considered satisfied by implementation when:

- the application delivers the MVP outcomes above
- the store abstraction is cleanly separated from transport and UI
- the shared React library is used by both the builder preview and external consumers
- the initial interactive block catalog is implemented in a deliberate, schema-driven way
- the product ships with a very dark shadcn-based interface rather than an unstyled starter template

