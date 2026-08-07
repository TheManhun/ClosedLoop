**Purpose:** Document the verified, current implementation of Closed Loop V2 (Stage 1).
**Version:** 2.0
**Last-reviewed:** 2026-08-07

Summary
- This document records behaviour and structure that can be verified from the repository and supplied Supabase schema docs. Items labelled "Unconfirmed" indicate assertions that could not be fully verified from code or docs.

Platform and Dependencies (verified)
- PHP: ^8.3 (composer.json require)
- Laravel Framework: ^13.8 (composer.json require)
- Node / Vite: `vite` used for frontend bundling; `npm run build` uses `vite build` (package.json)
- Phaser: dependency present (`phaser` in package.json) but not invoked by V2 Stage 0 code (see Unconfirmed)
- Tests: Node `node:test` style tests present for V2 (tests/V2Stage0.test.js) and Pest/PHP tests for Laravel (composer dev deps)

Frontend structure (verified)
- Legacy simulator: `resources/js/simulator.js` and related subfolders under `resources/js/simulator/` (legacy V1 implementation).
- V2 frontend: `resources/js/v2/` with the following modules and Stage 1 implementations:
  - `events/EventBus.js` (implemented)
  - `renderer/Renderer.js` (Phaser-based renderer initialisation and lifecycle)
  - `renderer/CameraController.js` (pan & zoom handlers)
  - `renderer/GridRenderer.js` (infinite, camera-aligned grid)
  - `renderer/InputController.js` (pointer screen→world conversion and pointer-in/canvas detection)
  - `renderer/GridHighlightRenderer.js` (hovered-cell highlight)
  - `engine/GameEngine.js` (lifecycle orchestration)
  - `ui/UIManager.js` (status UI for Stage 1)
  - `api/ApiCoordinator.js`, `services/DataLoader.js`, `technology/TechnologyEngine.js`, `simulation/SimulationEngine.js`, `toolbox/ToolboxController.js`, `scenarios/ScenarioLoader.js`, `App.js`, `main.js` (module shells present; many are intentionally minimal for later stages)

Routes and browser entry points (verified)
- V1 route: `GET /simulator` → `PagesController::simulator()` → view `resources/views/simulator.blade.php` (legacy frontend entries via `@vite(['resources/js/simulator.js','resources/js/factory-editor.js'])`).
- V2 verification route: `GET /simulator-v2` → returns view `resources/views/simulator-v2.blade.php` which:
  - mounts a DOM root `div#closed-loop-v2-root`
  - includes Vite entry `resources/js/v2/main.js` via `@vite(['resources/js/v2/main.js'])`.

Vite build configuration (verified)
- `vite.config.js` includes `resources/js/v2/main.js` in the `laravel()` plugin `input` list.
- `npm run build` runs `vite build` (package.json).

V2 bootstrap sequence (verified from `resources/js/v2/main.js`)
1. Instantiate `EventBus`.
2. Instantiate `ApiCoordinator({ eventBus })`.
3. Instantiate `DataLoader({ apiCoordinator })`.
4. Instantiate `TechnologyEngine({ eventBus, dataLoader })`.
5. Instantiate `SimulationEngine({ eventBus, technologyEngine })`.
6. Instantiate `GameEngine({ eventBus, simulationEngine, technologyEngine })`.
7. Instantiate `Renderer({ eventBus })` and `ToolboxController({ eventBus })`.
8. Instantiate `ScenarioLoader({ dataLoader, eventBus })`.
9. Instantiate `UIManager({ eventBus, renderer, toolbox, statusProviders: { ... } })`.
10. Construct `App` with `{ eventBus, gameEngine, uiManager, scenario: null }` and call `app.start()`.

Module responsibilities (what is implemented vs shell)
- `EventBus` (resources/js/v2/events/EventBus.js): implemented. Provides `on`, `off`, `emit`, `initialise`, `destroy`. Behaviour verified in tests.
- Renderer-related modules (implemented for Stage 1):
  - `renderer/Renderer.js`: implements Phaser import and game creation; configures Phaser scale to `Phaser.Scale.RESIZE` and mounts the BlankScene that initialises renderer subsystems.
  - `renderer/CameraController.js`: implements pan (middle-button drag), wheel zoom (centered on pointer), and updates camera scroll/zoom.
  - `renderer/GridRenderer.js`: draws an infinite grid aligned to `camera.worldView` and avoids unnecessary redraws.
  - `renderer/InputController.js`: subscribes to Phaser pointer events, converts screen→world via the active camera, and exposes `getPointerWorld()` and `isPointerInside()` (includes a canvas-bounds fallback).
  - `renderer/GridHighlightRenderer.js`: listens to scene `update` and draws a single translucent 64×64 highlight for the hovered cell; hides when the pointer leaves the canvas.
- Other modules (shells or minimal implementations): `ApiCoordinator`, `DataLoader`, `TechnologyEngine`, `SimulationEngine`, `ToolboxController`, `ScenarioLoader` (present but intentionally minimal; real API integration and simulation logic are Stage 2+ work).

Constructor dependencies and wiring (verified)
- `DataLoader` requires `ApiCoordinator` (throws if missing).
- `ScenarioLoader` requires `DataLoader` (throws if missing).
- `GameEngine` requires `SimulationEngine` (throws if missing).
- `UIManager` constructed with `renderer` and `toolbox` references (direct coupling) and an object `statusProviders` containing references to several modules; `UIManager` reads these to display status.

Current data flow (verified)
- Boot → `DataLoader.loadScenario(id)` → `ApiCoordinator.fetchScenario(id)` (currently returns dummy scenario).
- `ScenarioLoader.load(id)` receives the scenario and emits `scenario:loaded` via `EventBus`.

Current event flow (verified)
- Events implemented and emitted from code:
  - `scenario:loaded` — produced by `ScenarioLoader.load(id)` with payload equal to whatever `DataLoader`/`ApiCoordinator` returned (currently a minimal `{ id, name }`).
  - `game:started` — produced by `GameEngine.start()` (no payload).
  - `game:stopped` — produced by `GameEngine.stop()` (no payload).
- `EventBus` supports subscription via `on(event, handler)` and unsubscription via `off(event, handler)`. `destroy()` clears all listeners.

Current rendering flow (verified)
- `UIManager.initialise()` writes a textual status into `#closed-loop-v2-root` when run in a browser environment. `Renderer.render(frame)` exists but is not invoked by the V2 bootstrap in Stage 0.

Testing and build commands (verified)
- Frontend build: `npm run build` (runs `vite build`).
- Frontend dev server: `npm run dev` (runs `vite`).
- Node / V2 unit tests exist and are structured for `node:test` (examples in `tests/V2Stage0.test.js`).
- Laravel/PHP tests: run via `php artisan test` / `composer test` (composer.json scripts).

Stage 0: What is implemented (verified)
- Stage 0 aims to provide architecture bootability with no gameplay.
- Verified Stage 0 elements:
  - EventBus implementation and tests.
  - Module shells for ApiCoordinator, DataLoader, TechnologyEngine, SimulationEngine, GameEngine, Renderer, ToolboxController, ScenarioLoader, UIManager.
  - App lifecycle (`initialise`, `start`, `destroy`) wired and tested (tests/V2Stage0.test.js).
  - Browser entry point `resources/views/simulator-v2.blade.php` that mounts `#closed-loop-v2-root` and includes Vite entry `resources/js/v2/main.js`.

What is explicitly a shell or intentionally unimplemented (verified)
- `ApiCoordinator.fetchScenario` returns a placeholder minimal object rather than querying Supabase.
- `DataLoader` is a thin proxy with no caching or normalisation implemented.
- `TechnologyEngine` contains no logic.
- `SimulationEngine` does not perform engineering calculations.
- `Renderer.render()` is a placeholder.
- No code in `resources/js/v2` performs network fetches except via `ApiCoordinator` per tests.

What is explicitly NOT implemented (verified)
- Any engineering or simulation calculations (material flow, power, heat, gas, circularity computations) are not present in Stage 0.
- Any database synchronisation/loading from Supabase is not performed by V2 modules yet.
- Placement, connection or toolbox behaviour (interactive map) is not implemented in V2 Stage 0.

Known external services (verified)
- Supabase: the Laravel backend `SupabaseService` (app/Services/SupabaseService.php) is the bridge to Supabase REST endpoints. The project README and `docs/supabase.md` provide exported schema snippets. The V2 code currently does not call Supabase directly — the Laravel backend exposes `GET /api/machines`, `GET /api/machines/{id}`, and `GET /api/resources` which call SupabaseService.

Unconfirmed or Requires Verification
- Phaser usage: `phaser` is present in `package.json` but V2 Stage 0 renderer does not instantiate or import Phaser; verify intended renderer implementation (Phaser vs custom canvas) before Stage 1.
- Supabase schema ownership and precise FK constraints: `docs/supabase.md` lists columns; foreign key constraints are inferred in `SupabaseService` usage (e.g., `machine_resources` joined to `resources`) but true DB FK constraints were not contained in the exported table column report — treat relationships as verified where used by `SupabaseService`, otherwise mark unconfirmed.
- Event payload shapes beyond `scenario:loaded` are not defined; any code relying on specific payload properties should be verified when implementation progresses.

Stage 1 notes and readiness
- Readiness: Stage 1 renderer, camera, grid, pointer handling and hover highlight are implemented and verified by unit tests and browser checks.
- Remaining Stage 2+ items: `ApiCoordinator` and `DataLoader` remain to be implemented to fetch and normalise backend data (Stage 2).
- Documentation action: update `EVENTS.md` with confirmed events and note that selection events are not yet implemented (Selection is Stage 4).

Stage status

- Stage 0: complete
- Stage 1: complete
- Stage 2: complete

Current data path

Browser V2 → ApiCoordinator → Laravel API → Supabase

Backend and data notes

- Machines load from Supabase through Laravel (`/api/machines`).
- Resources load from Supabase through Laravel (`/api/resources`).
- Scenarios load from Supabase through Laravel (`/api/scenarios/{id}`).
- The Dandenong South scenario currently loads at startup (default scenario id 2).
- Canonical `DataLoader` caches machines, resources and scenarios in memory (in-memory cache only).
- The `/api/scenarios/{id}` endpoint returns normalized scenario objects and `scenario_resources` ordered by numeric `sort_order`.
- Protected scenario data is read server-side using the Supabase service-role key; this credential is SERVER-SIDE ONLY and is never exposed to browser clients.

Current Dandenong scenario proof

- stable_key: dandenong-south
- population: 860060
- scenario_resources: 6 inputs

Notes

- Do not assume Stage 3 rendering or stockpile loading has been implemented; those remain for Stage 3 and later.

ApiCoordinator expected Stage 2 contract (summary)
- Purpose: sole client for frontend HTTP requests that require domain data. All V2 modules must obtain remote data exclusively via `ApiCoordinator` (no direct fetch()).
- API endpoints expected to be used (examples):
  - `GET /api/machines` → list machines (JSON)
  - `GET /api/machines/{id}` → single machine (normalised shape matching `SupabaseService::getMachine` output)
  - `GET /api/resources` → list of resources
- Responsibilities at Stage 2: handle network errors, add simple caching for repeated reads, and normalise any backend payload into the canonical shape consumed by `DataLoader` and other modules.

Notes
- This document contains only information verifiable from repository files and `docs/supabase.md`. It does not speculate about future feature designs beyond what the master plan and roadmap explicitly state.
