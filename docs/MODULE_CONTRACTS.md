**Purpose:** Define clear contracts for V2 modules to prevent architectural drift, enable independent implementation and provide a checklist for reviewers.
**Version:** 2.0
**Last-reviewed:** 2026-08-07

Guidelines
- Each contract below describes a module's responsibilities. Modules must adhere to "Must NOT own" constraints to avoid tight coupling. Events are the preferred communication mechanism for behavioural interactions between independent modules unless a module is explicitly documented as the owner of a resource.

App
- Purpose: Coordinate application lifecycle (initialise, start, destroy) and wire top-level modules together.
- Owns: Application lifecycle orchestration only.
- Must NOT own: Simulation logic, rendering internals, API calls, domain data.
- Dependencies: `GameEngine`, `UIManager`, `EventBus` (injected), optionally `ScenarioLoader`.
- Produces Events: none (may emit lifecycle events if needed, but prefer GameEngine emits `game:started`).
- Consumes Events: none by default.
- Public Responsibilities: call `initialise()` on UI and Game, start the game lifecycle, call `destroy()` on shutdown.
- Future Notes: Keep App minimal; avoid adding domain logic here.

EventBus
- Purpose: Lightweight publish/subscribe dispatcher for decoupled communication.
- Owns: Listener registry and dispatch semantics.
- Must NOT own: Application domain state or lifecycle; must not perform heavy processing.
- Dependencies: none.
- Produces Events: N/A (dispatches producer events).
- Consumes Events: N/A.
- Public Responsibilities: provide `on(event, handler)`, `off(event, handler)`, `emit(event, payload)`, `destroy()`.
- Future Notes: Intentionally minimal for Stage 0. Consider adding `once()` or safe-catch dispatch in Stage 1 only if a clear need arises.

ApiCoordinator
- Purpose: Single HTTP client for frontend; centralise all remote data access and network concerns.
- Owns: Outbound HTTP calls and response error handling for the frontend.
- Must NOT own: Domain normalisation (DataLoader owns that), simulation logic, rendering.
- Dependencies: `EventBus` (optional for signaling), low-level fetch/HTTP library.
- Produces Events: optional diagnostic events (e.g., `api:error`) if implemented.
- Consumes Events: none by default.
- Public Responsibilities: provide clear promise-based methods (e.g., `fetchScenario(id)`, `fetchMachines()`, `fetchResources()`), surface controlled errors, and implement minimal caching if appropriate.
- Future Notes: Implement network retry/backoff and attach request cancellation only when needed (Stage 2+).

DataLoader
- Purpose: Normalise and cache domain data coming from `ApiCoordinator` into canonical frontend models.
- Owns: In-memory canonical representations of machines, resources, scenarios, and their caches.
- Must NOT own: Network transport (ApiCoordinator) or UI/Renderer responsibilities.
- Dependencies: `ApiCoordinator`.
- Produces Events: `data:loaded`, `data:updated` (optional—documented payloads required before use).
- Consumes Events: optional API lifecycle events.
- Public Responsibilities: expose query methods (`loadScenario`, `getMachineById`, `getResources`) that return stable shapes; implement caching and consistent normalisation across consumers.
- Future Notes: Add invalidation policies and persistence only if required by roadmap stages.

TechnologyEngine
- Purpose: Encapsulate domain logic for technology compatibility and relationship queries (e.g., "what consumes X").
- Owns: Algorithms and lookups that answer compatibility questions and technology metadata caches.
- Must NOT own: Supabase access (ApiCoordinator/DataLoader), simulation execution, rendering.
- Dependencies: `EventBus`, `DataLoader`.
- Produces Events: `technology:updated` (optional).
- Consumes Events: `data:loaded` (when DataLoader provides updated machine/resource lists).
- Public Responsibilities: provide query APIs used by UI and SimulationEngine to determine compatibility and technology metadata.
- Future Notes: Keep algorithms side-effect free to ease unit testing.

SimulationEngine
- Purpose: Perform engineering calculations (material flow, power, water, heat, gas, pollution, circularity) and expose simulation results.
- Owns: The simulation model, tick lifecycle, and authoritative runtime state for placed machines.
- Must NOT own: Rendering or DOM manipulation; API transport; raw data normalisation (DataLoader responsibility).
- Dependencies: `EventBus`, `TechnologyEngine` (for consumption/production rules), `DataLoader` (for static data during initialisation).
- Produces Events: `simulation:tick`, `simulation:updated`, `simulation:error` (payload schemas to be documented in EVENTS.md before Stage 8 usage).
- Consumes Events: `scenario:loaded`, placement/connection events (to be defined in Stage 4-7), and control events (`simulation:start`, `simulation:stop`).
- Public Responsibilities: initialise simulation state, accept commands to add/remove machines, run ticks (synchronously or via scheduler) and emit well-defined simulation result events.
- Future Notes: Define public API for deterministic stepping (for tests) and asynchronous runs, and provide an adapter for potential server-side offload if scaling is required.

GameEngine
- Purpose: High-level orchestrator of the game runtime (connects SimulationEngine lifecycle to the UI and Renderer flows).
- Owns: Game lifecycle (start, stop) and coordination of simulation engine runs.
- Must NOT own: Simulation calculation logic, rendering details, data normalisation.
- Dependencies: `SimulationEngine`, `EventBus`, `TechnologyEngine` (read-only access allowed), `Renderer` (used via interface), `UIManager` (indirect via events).
- Produces Events: `game:started`, `game:stopped`.
- Consumes Events: control events (e.g., `game:pause`, `game:resume`) as implemented.
- Public Responsibilities: start/stop/stop-and-cleanup lifecycle methods and emit lifecycle events. Keep orchestration logic minimal and testable.
- Future Notes: Prefer emitting events rather than calling deep methods on UI or Renderer.

Renderer
- Purpose: Responsible for visual rendering, camera, grid, and viewport; isolates rendering technology (Phaser) behind a minimal adapter API.
- Owns: Rendering layer, Phaser game instance, scenes, and renderer-owned subsystems.
- Must NOT own: Game logic, simulation state mutations, API calls.
- Dependencies: `EventBus` (subscribe to render-ready events), Phaser instance or canvas context.
- Produces Events: `render:frame` (optional diagnostic), `renderer:ready`.
- Consumes Events: `simulation:updated`, `game:started`, `game:stopped`, `viewport:resize`.
- Public Responsibilities: provide `initialise()`, `render(frame)` and `destroy()`; expose only the minimal interface needed by UI and GameEngine.
- Renderer-owned subsystems (Stage 1 implementations):
	- `InputController`: subscribes to Phaser pointer events, translates pointer screen coordinates to world coordinates using the active camera, and exposes `getPointerWorld()` and `isPointerInside()`.
	- `CameraController`: implements pan (middle-button drag) and wheel zoom centred at the pointer; updates camera scroll and zoom.
	- `GridRenderer`: draws a camera-aligned infinite grid based on the camera.worldView and avoids unnecessary redraws.
	- `GridHighlightRenderer`: draws a translucent 64×64 highlight on the hovered grid cell; listens to `scene.update` and hides when pointer leaves the canvas.
- Future Notes: Keep these subsystems small, lifecycle-managed by `Renderer`, and accessible only through the renderer's public interface where possible.

UIManager
- Purpose: Presentational UI layer; DOM interaction and widgets. Renders panels, toolbox UI and status; subscribes to EventBus for data updates.
- Owns: DOM components and UI state (selection state, open panels) only.
- Must NOT own: Simulation calculations, API calls, canonical domain data stores (DataLoader owns canonical copies).
- Dependencies: `EventBus`, `Renderer` (if tightly coupled), `ToolboxController`.
- Produces Events: user interaction events (e.g., `ui:select`, `ui:request-place`) — to be documented before broader use.
- Consumes Events: `scenario:loaded`, `simulation:updated`, `game:started`, `game:stopped`, and other domain events.
- Public Responsibilities: mount/unmount UI, render status panels, forward user requests into events on EventBus.
- Future Notes: Avoid probing internal module state via `statusProviders` in production; prefer event-driven status updates.

ToolboxController
- Purpose: Manage available tools and categories presented in the toolbox UI; compute suggested technologies for selected resources.
- Owns: Toolbox state (available tools, favourites, search index cache for UI responsiveness).
- Must NOT own: Technology domain logic (TechnologyEngine), simulation execution.
- Dependencies: `EventBus`, `TechnologyEngine`, `DataLoader`.
- Produces Events: `toolbox:updated`, `toolbox:select`.
- Consumes Events: `scenario:loaded`, `ui:select`.
- Public Responsibilities: supply toolbox items to UI via events or callbacks and maintain search/favourite state.
- Future Notes: Keep toolbox purely presentational data and compute heavy queries in TechnologyEngine.

ScenarioLoader
- Purpose: Load scenario metadata and initial scenario state via `DataLoader` and emit scenario lifecycle events.
- Owns: Scenario load lifecycle for the frontend.
- Must NOT own: Domain data caches or simulation logic.
- Dependencies: `DataLoader`, `EventBus`.
- Produces Events: `scenario:loaded`.
- Consumes Events: none by default.
- Public Responsibilities: perform `load(id)` and emit `scenario:loaded` with the normalised scenario object returned by `DataLoader`.
- Future Notes: Scenario formats and payload schemas must be defined at Stage 2 and documented in EVENTS.md.

Stage 2 Implemented Contracts (verified)

ApiCoordinator
- `fetchMachines()` — GET `/api/machines`, returns parsed JSON or throws descriptive error.
- `fetchResources()` — GET `/api/resources`, returns parsed JSON array or throws descriptive error.
- `fetchScenario(id)` — GET `/api/scenarios/{id}`, returns parsed JSON object or throws descriptive error.

DataLoader
- `loadMachines()` — calls `ApiCoordinator.fetchMachines()` and stores in-memory `_machines`.
- `getMachines()` — returns a shallow copy of `_machines`.
- `getMachineById(id)` — returns a machine by id from `_machines`.
- `loadResources()` — calls `ApiCoordinator.fetchResources()` and stores `_resources` in-memory.
- `getResources()` — returns a shallow copy of `_resources`.
- `getResourceById(id)` — returns a resource by id from `_resources`.
- `loadScenario(id)` — calls `ApiCoordinator.fetchScenario(id)`, normalises scenario, links embedded resources, stores in-memory `_scenarios`.
- `getScenarioById(id)` — returns a cached scenario by id.

Cache
- in-memory only (DataLoader caches `_machines`, `_resources`, `_scenarios`).
- no TTL, no invalidation, no browser persistent cache yet.

ScenarioLoader
- `load(id)` — delegates to `DataLoader.loadScenario(id)` and emits `scenario:loaded` with the returned object.

