# Closed Loop — Simulator Architecture (baseline)

Purpose
- Capture current responsibilities and provide a clean baseline before refactor.
- Preserve behaviour while moving responsibility out of `simulator.js`.

Top-level components
- Backend
  - Supabase: canonical engineering data store (sole authoritative source for machine/resource engineering data).
  - Laravel API: authenticated gateway exposing `/api/machines`, `/api/resources`, `/api/technologies`, `/api/scenarios`.
- Frontend
  - `simulator/api/SimulatorApiClient.js`: single HTTP client for simulator API (API Coordinator).
  - `simulator/data/*`: Data Loader and Data Normalizer producing canonical records.
  - `simulator/services/TechnologyGraphService.js`: graph queries (inputs, outputs, next machines, compatibility).
  - Game Engine (Phaser scene): rendering, update ticks, grid and camera; exposes a small, documented public API only.
  - Managers: `BuildingManager`, `ConnectionManager`, `PlacementManager` (world-state management).
  - UI: DOM panels (Toolbox, ContextPanel, MachineInfoPanel); receive small view models and emit events via EventBus.
  - EventBus: single cross-layer event system for well-defined contracts.

Canonical data flow (target)
```
Supabase → Laravel API → SimulatorApiClient → DataLoader/DataNormalizer → CanonicalMachineModel →
TechnologyGraphService → Managers / Game Engine → UI (via EventBus)
```

Baseline problems observed
- `simulator.js` is a god-object: it fetches, normalizes, builds DOM, and holds duplicated machine records.
- Multiple data sources for machine definitions (Supabase, `resources/data/machines.json`, built-in arrays) causing drift.
- Global coupling via `window.__simulatorScene`, mixing DOM and Phaser internals.
- Broad `try/catch` blocks that swallow actionable errors.

Non-negotiable architectural rules
- Supabase is the only engineering source of truth for machines, resources and relationships.
- `simulator.js` must become a thin bootstrap that wires components; it must not hold business logic.
- UI never calls `fetch()` directly; all API calls go through the API Coordinator.
- UI never reaches directly into Phaser internals; communication must use EventBus and the public scene API.
- Phaser/game logic never creates DOM; rendering and DOM are the UI layer's responsibility.
- One EventBus contract is used for cross-layer communication; payloads are small identifiers only.
- Reference (canonical) machine data and placed machine instances are different models and must remain distinct.
- Stable keys are snake_case everywhere and are the canonical cross-system identity.
- Refactor moves responsibility while preserving behaviour; verify at each step.

Migration status — current legacy systems still present (temporary)
- `resources/data/machines.json`
- built-in machine definitions (arrays in `simulator.js`)
- `BuildingDefinitions` aliases and multiple normalizers
- `window.__simulatorScene` debug coupling
- DOM custom events and ad-hoc `dispatchEvent` usage
- direct `fetch()` calls from UI code
- decorative resource sprites that are not data-backed resource instances

These items are temporary compatibility layers and scheduled for removal only after replacement paths are verified.

Baseline goals
- Do not change runtime behaviour before Stage 1 verification.
- Document responsibilities and runtime shapes in `MACHINE_DATA_SCHEMA.md` and `EVENTS.md`.
- Prepare for Data Loader + canonical model extraction.

Git workflow (short)
- Before changing files: run `git status --short`. Do not switch branches with uncommitted work that could be lost.
- If you have uncommitted changes: report them, and create an explicit checkpoint (commit or stash) before proceeding.
- Create/switch to `refactor/simulator-architecture` for the refactor baseline.
- Add and commit only the baseline docs in this branch; do not stage other files.

Completion test for Stage 1
- The existing simulator runs exactly as before.
- Documentation files present on `refactor/simulator-architecture`.