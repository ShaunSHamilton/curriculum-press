# Curriculum Press Sequenced Task List

This document converts the PRD into an implementation-oriented task backlog. Tasks are ordered to reduce dependency churn and to keep the product shippable in vertical slices.

---

## 1. Delivery Rules

- Complete tasks in sequence unless a later task is explicitly marked parallelizable.
- Prefer vertical integration over isolated scaffolding when feasible.
- Reuse shared types and schemas across frontend, backend, and the React block library.
- Keep the Rust store abstraction in place from the start. No direct data manipulation outside the store layer.
- Keep the builder preview and external player on the same rendering engine.

---

## 2. Milestones

### Milestone A: Template Alignment and Design Foundation

Outcome:
The repo template is understood, the app boots, shadcn is integrated, and the very dark theme is applied consistently.

### Milestone B: Core Domain and App Skeleton

Outcome:
Core entities, store abstractions, API skeleton, shared schemas, and app shell are in place.

### Milestone C: Auth, Organizations, and Projects

Outcome:
Users can create accounts, create or join organizations, and create projects.

### Milestone D: Curriculum Builder

Outcome:
Authors can assemble curricula from predefined interactive blocks and edit block configurations.

### Milestone E: Shared Player Library and Preview

Outcome:
The same React components power block preview, curriculum preview, and external usage.

### Milestone F: Export and Integration API

Outcome:
Curricula can be exported as JSON and served to external websites.

### Milestone G: Stabilization

Outcome:
Validation, error handling, dark-theme polish, and implementation docs are complete.

---

## 3. Sequenced Tasks

## Phase 0: Repository and Template Alignment

### Task 0.1: Inspect existing workspace structure

- Identify frontend app, backend app, shared packages, and current routing/state/component setup.
- Confirm whether TanStack Router, Query, Table, and shadcn are already present.
- Document gaps between the template and the PRD.

Deliverable:

- short implementation notes describing current repo layout and required additions

### Task 0.2: Normalize workspace conventions

- Confirm package names, Rust crate layout, and import conventions.
- Establish folder structure for:
  - frontend app
  - backend app
  - shared schemas/types
  - React block library

Deliverable:

- agreed workspace structure reflected in the repo

### Task 0.3: Add or finish shadcn/ui setup

- Install/configure shadcn if not already present.
- Verify base components required for app shell, forms, dialogs, tabs, tables, sheets, and buttons.

Deliverable:

- working shadcn component foundation in the frontend

### Task 0.4: Implement the very dark theme

- Define app-wide tokens for background, foreground, border, muted, card, accent, success, warning, and destructive states.
- Apply them to layout chrome, forms, dialogs, tables, and preview surfaces.
- Ensure contrast is sufficient for long editing sessions.

Dependencies:

- Task 0.3

Deliverable:

- consistent very dark shadcn-based theme across the app shell

---

## Phase 1: Core Domain and Shared Contracts

### Task 1.1: Define core product entities

- Define frontend and backend representations for:
  - User
  - Organization
  - OrganizationMember
  - Project
  - Curriculum
  - InteractiveBlock
  - AssetReference

Deliverable:

- initial typed domain models committed in frontend/backend/shared layers

### Task 1.2: Define block catalog metadata

- Create a canonical catalog for supported interactive block types.
- Include block key, display name, description, learning objective, and MVP support status.

Deliverable:

- shared block catalog definition used by builder UI and backend validation

### Task 1.3: Define config schemas for MVP block subset

- Start with:
  - Tile Match
  - Category Sort
  - Sequence Sorter
  - Interactive Diagram
  - Syntax Sprint
  - Binary Blitz
- Each schema must describe content, settings, and validation rules.

Dependencies:

- Task 1.2

Deliverable:

- typed config schemas for the starter block set

### Task 1.4: Define store trait and domain service boundaries

- Create a Rust store trait for all domain mutation and retrieval.
- Keep Axum handlers thin and separate from store logic.
- Identify service-layer responsibilities if needed.

Deliverable:

- store trait plus domain module boundaries

### Task 1.5: Implement `InMemoryStore`

- Back the store with `RwLock<HashMap<...>>` or similar.
- Support users, organizations, projects, curricula, and blocks.
- Accept that data resets on process restart.

Dependencies:

- Task 1.4

Deliverable:

- functioning in-memory backend store for MVP flows

---

## Phase 2: Backend API Skeleton

### Task 2.1: Create Axum application skeleton

- Define router structure, app state, error mapping, and JSON conventions.
- Wire the store abstraction into application state.

Dependencies:

- Task 1.4
- Task 1.5

Deliverable:

- booting Axum API with structured module layout

### Task 2.2: Implement health and bootstrap endpoints

- Add basic health/version endpoint.
- Add optional seed/bootstrap endpoint if useful for local development.

Deliverable:

- development-friendly backend bootstrap layer

### Task 2.3: Implement validation strategy

- Decide how request validation is performed in Rust.
- Ensure block config validation can be enforced server-side.

Dependencies:

- Task 1.3

Deliverable:

- request and domain validation pattern used consistently in the API

---

## Phase 3: Frontend App Shell

### Task 3.1: Build app shell and navigation

- Create sidebar/topbar layout for organization and project navigation.
- Include theme-consistent empty/loading/error states.

Dependencies:

- Task 0.4

Deliverable:

- navigable dark-themed shell for the builder app

### Task 3.2: Configure frontend data layer

- Set up TanStack Query and any routing patterns used by the app.
- Add typed API client helpers.

Dependencies:

- Task 2.1

Deliverable:

- frontend query and API integration foundation

### Task 3.3: Establish reusable page primitives

- Create layout primitives for dashboards, forms, detail screens, and preview panes.
- Keep these aligned with the dark theme tokens.

Deliverable:

- reusable frontend scaffolding for later feature work

---

## Phase 4: Identity and Organization Flows

### Task 4.1: Implement account creation and sign-in backend flows

- Create account endpoints and minimal session/token behavior for MVP.
- Keep auth implementation simple but replaceable.

Dependencies:

- Task 2.1

Deliverable:

- functioning auth endpoints

### Task 4.2: Implement account creation and sign-in frontend flows

- Build forms, client-side validation, and authenticated navigation behavior.

Dependencies:

- Task 4.1
- Task 3.1
- Task 3.2

Deliverable:

- user can sign up and sign in from the frontend

### Task 4.3: Implement organization create/list/switch flows

- Create backend endpoints and frontend screens for organizations.
- Support basic organization membership association for the authenticated user.

Dependencies:

- Task 4.1
- Task 4.2

Deliverable:

- user can create and switch organizations

### Task 4.4: Implement organization invite or join placeholder flow

- Provide a minimal member-add flow suitable for MVP.
- It can be simplified if full email invite infrastructure is out of scope.

Deliverable:

- basic organization collaboration path exists for MVP

---

## Phase 5: Projects and Curriculum Containers

### Task 5.1: Implement project CRUD backend endpoints

- Create project create/list/get/update endpoints scoped to organizations.

Dependencies:

- Task 1.5
- Task 4.3

Deliverable:

- project management API

### Task 5.2: Implement project dashboard frontend

- Build project list and create flows.
- Add project detail entry point.

Dependencies:

- Task 5.1

Deliverable:

- user can create and open projects

### Task 5.3: Implement curriculum container model

- Decide whether curriculum is separate from project or embedded within it.
- Implement the chosen shape consistently in backend and frontend.

Dependencies:

- Task 1.1
- Task 5.1

Deliverable:

- stable project-to-curriculum model used by the builder

---

## Phase 6: Block Catalog and Builder Framework

### Task 6.1: Build block catalog picker UI

- Show available block types with description and learning objective guidance.
- Make the catalog useful for authors choosing the right interaction model.

Dependencies:

- Task 1.2
- Task 3.3

Deliverable:

- authors can browse and select block types

### Task 6.2: Implement backend block CRUD and ordering

- Add endpoints for create, update, delete, duplicate, and reorder operations.

Dependencies:

- Task 1.3
- Task 5.3

Deliverable:

- complete block management API

### Task 6.3: Build curriculum outline UI

- Display the ordered list of blocks in a project.
- Support selection, duplication, deletion, and reordering.

Dependencies:

- Task 6.2

Deliverable:

- usable curriculum outline/editor sidebar

### Task 6.4: Build block editor framework

- Create common editor pattern:
  - metadata section
  - structured config form
  - settings panel
  - validation panel
- Support optional raw JSON inspection/edit mode for advanced users if feasible.

Dependencies:

- Task 1.3
- Task 6.3

Deliverable:

- reusable editing framework for block-specific forms

---

## Phase 7: Shared React Block Library

### Task 7.1: Create library package and shared exports

- Create package for block renderers and shared frontend types.
- Ensure it can be consumed by the builder app.

Dependencies:

- Task 0.2
- Task 1.3

Deliverable:

- working local library package integrated into the workspace

### Task 7.2: Build shared player primitives

- Create shared components/utilities for prompts, scoring, status, progression, and feedback.

Deliverable:

- common primitives used across multiple block types

### Task 7.3: Implement Tile Match renderer

- Build learner-facing component from typed config.

Dependencies:

- Task 7.1

Deliverable:

- renderable Tile Match block

### Task 7.4: Implement Category Sort renderer

- Build learner-facing component from typed config.

Deliverable:

- renderable Category Sort block

### Task 7.5: Implement Sequence Sorter renderer

- Build learner-facing component from typed config.

Deliverable:

- renderable Sequence Sorter block

### Task 7.6: Implement Interactive Diagram renderer

- Build learner-facing hotspot/labeling interaction from typed config.

Deliverable:

- renderable Interactive Diagram block

### Task 7.7: Implement Syntax Sprint renderer

- Build learner-facing typing interaction from typed config.

Deliverable:

- renderable Syntax Sprint block

### Task 7.8: Implement Binary Blitz renderer

- Build learner-facing fast yes/no classification interaction from typed config.

Deliverable:

- renderable Binary Blitz block

### Task 7.9: Implement curriculum player

- Render an ordered sequence of blocks.
- Support next/previous or auto-advance behavior as appropriate for MVP.

Dependencies:

- Tasks 7.3 through 7.8

Deliverable:

- shared curriculum player component

Parallelizable note:

- Tasks 7.3 through 7.8 may be implemented in parallel after Tasks 7.1 and 7.2 are complete.

---

## Phase 8: Builder Form Implementations for MVP Blocks

### Task 8.1: Build Tile Match editor form

- Support prompt text, item pairs, media references, and settings.

Dependencies:

- Task 6.4
- Task 7.3

Deliverable:

- author can configure Tile Match blocks end-to-end

### Task 8.2: Build Category Sort editor form

- Support categories, items, media references, and validation.

Deliverable:

- author can configure Category Sort blocks end-to-end

### Task 8.3: Build Sequence Sorter editor form

- Support ordered steps/items and optional explanatory content.

Deliverable:

- author can configure Sequence Sorter blocks end-to-end

### Task 8.4: Build Interactive Diagram editor form

- Support image/asset references and hotspot definitions.

Deliverable:

- author can configure Interactive Diagram blocks end-to-end

### Task 8.5: Build Syntax Sprint editor form

- Support target text, speed/difficulty settings, and feedback rules.

Deliverable:

- author can configure Syntax Sprint blocks end-to-end

### Task 8.6: Build Binary Blitz editor form

- Support classification prompt, item list, correctness labels, and speed settings.

Deliverable:

- author can configure Binary Blitz blocks end-to-end

Parallelizable note:

- Tasks 8.1 through 8.6 may run in parallel once the editor framework and corresponding renderers exist.

---

## Phase 9: Preview Integration

### Task 9.1: Implement single-block preview pane

- Render selected block using the shared library inside the builder.
- Ensure form changes update preview quickly and reliably.

Dependencies:

- Tasks 7.3 through 7.8
- Tasks 8.1 through 8.6

Deliverable:

- live or near-live block preview in the editor

### Task 9.2: Implement full curriculum preview

- Allow authors/reviewers to play through the whole curriculum from the project.

Dependencies:

- Task 7.9
- Task 6.3

Deliverable:

- end-to-end curriculum preview experience

### Task 9.3: Verify preview parity

- Check that preview output matches the shared library behavior used for external consumption.

Deliverable:

- explicit parity check completed

---

## Phase 10: Export and Integration API

### Task 10.1: Define export payload shape

- Establish the stable JSON format for curriculum export and external consumption.

Dependencies:

- Task 1.3
- Task 5.3

Deliverable:

- documented export schema

### Task 10.2: Implement curriculum export endpoint

- Support download/export of project curriculum JSON.

Dependencies:

- Task 10.1

Deliverable:

- export endpoint and frontend trigger

### Task 10.3: Implement public/integration curriculum fetch endpoint

- Expose published or current curriculum payload for external websites.
- Keep editor-only metadata out of the public payload where possible.

Dependencies:

- Task 10.1

Deliverable:

- external-consumption API endpoint

### Task 10.4: Validate external library usage path

- Demonstrate that a separate consumer can render exported or fetched curriculum data using the shared library.

Dependencies:

- Task 10.3
- Task 7.9

Deliverable:

- verified integration path for external websites

---

## Phase 11: Hardening and MVP Finish

### Task 11.1: Improve validation and error messaging

- Ensure backend and frontend validation messages are specific and actionable.

Deliverable:

- polished error states for common authoring failures

### Task 11.2: Improve empty, loading, and disabled states

- Cover project lists, block lists, editor states, and preview states.

Deliverable:

- resilient UX across common state transitions

### Task 11.3: Dark theme QA pass

- Verify theme consistency across every major screen and state.
- Resolve low-contrast or off-theme components.

Deliverable:

- theme is cohesive and production-ready

### Task 11.4: Builder workflow QA pass

- Validate complete flow:
  - sign up
  - create organization
  - create project
  - add blocks
  - configure blocks
  - preview block
  - preview curriculum
  - export curriculum

Deliverable:

- core MVP journey verified end-to-end

### Task 11.5: Developer documentation

- Document workspace structure, store abstraction, block extension pattern, export format, and future datastore swap guidance.

Deliverable:

- implementation docs for maintainers and future agents

---

## 4. Suggested Agent Execution Order

If multiple agents are used, split work only after the foundational tasks are complete.

### Recommended order

1. Phase 0
2. Phase 1
3. Phase 2 and Phase 3
4. Phase 4 and Phase 5
5. Phase 6
6. Phase 7
7. Phase 8
8. Phase 9
9. Phase 10
10. Phase 11

### Good parallel splits after the foundation is stable

- backend API work versus frontend shell work after Phases 1 and 2 begin
- shared library block renderers in parallel across block types after Task 7.2
- block editor forms in parallel after Task 6.4 and the related renderer tasks exist

---

## 5. MVP Exit Checklist

- account creation works
- organization creation works
- project creation works
- curriculum outline works
- at least six MVP block types are authorable
- single-block preview works
- full curriculum preview works
- JSON export works
- HTTP curriculum delivery works
- shared React library works in an external consumer path
- the app uses a consistent very dark shadcn-based theme

---

## 6. Post-MVP Tasks

- persistent datastore implementation
- draft/published workflow
- version history and compare
- Dolt-backed versioning exploration if still desired
- analytics events and reporting
- asset upload pipeline
- richer collaboration roles
- additional block types:
  - Scrambled Sentence
  - Whack-a-Concept
  - Hidden Hotspots
  - Ranking Battle
  - Spot the Difference
  - Branching Narrative
  - Simulation

