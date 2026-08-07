**Purpose:** Catalogue all EventBus events that can be verified in the repository and describe EventBus behaviour and lifecycle.
**Version:** 2.0
**Last-reviewed:** 2026-08-07

EventBus implementation (verified)
- Location: `resources/js/v2/events/EventBus.js`
- Public methods:
  - `initialise()` — no-op placeholder (prepares the bus).
  - `on(event, handler)` — register `handler` for `event`. Internally uses a `Map` of `Set` of handlers.
  - `off(event, handler)` — remove a previously registered handler from the event's handler set.
  - `emit(event, payload)` — synchronously call every handler registered for `event` with `payload`. If no handlers exist, returns without error.
  - `destroy()` — clears the internal listeners `Map`.

Notes on EventBus policy for Stage 0
- The EventBus implementation is intentionally minimal for Stage 0. Do not extend with convenience methods (`once()`, automatic exception wrapping, or weakref cleanup) until a concrete use case and tests justify those additions. Treat EventBus as a small, synchronous dispatcher for now; planned enhancements should be added during Stage 1 or later when required by real consumers.

Listener lifecycle and cleanup (verified)
- `off(event, handler)` must be called by consumers to remove handlers; otherwise the handler set remains until either the specific event handler is removed, or `destroy()` is called.
- `destroy()` clears all listeners at once. There is no automatic weak reference or DOM-tied automatic cleanup present in the implementation.

Guidance for consumers (required)
- Document event payload contracts before consumers rely on specific properties. For Stage 0 mark payload shapes as TODO in this document; Stage 2 should define canonical payload schemas for `scenario:loaded` and subsequent events.
- Consumers are responsible for unsubscribing handlers when their owning module is destroyed. Implementations should call `off()` during their `destroy()` lifecycle method to prevent memory leaks.
- Producers should emit only the documented properties. Consumers must defensively check payload fields rather than assuming presence.


Event catalogue (implemented & verified)
- `scenario:loaded`
  - Exact name: `scenario:loaded`
  - Producer: `resources/js/v2/scenarios/ScenarioLoader.js` (method `load(id)` emits this after `DataLoader.loadScenario`).
  - Consumer(s): none found in `resources/js/v2` (no `on('scenario:loaded', ...)` usages discovered). Consumers may be implemented later.
  - Payload shape: the object returned by `DataLoader.loadScenario(id)` / `ApiCoordinator.fetchScenario(id)`. For Stage 2 the payload is a full scenario object with properties including at least: `id`, `stable_key`, `name`, `population`, `reference_year`, `data_status`, and `scenario_resources` (array). `scenario_resources` entries include `id`, `scenario_id`, `resource_id`, `instance_key`, `display_name`, `initial_quantity`, `current_quantity`, `unit`, `sort_order`, `fixed`, `selectable`, `notes`, and an embedded `resource` object where available.
  - When it fires: when `ScenarioLoader.load(id)` completes.
  - Fires once or repeatedly: fires whenever `load(id)` completes — can fire repeatedly for multiple loads.
  - Roadmap stage: Stage 3 (Scenario System) — currently used in Stage 0 as part of boot scaffolding.
  - Implementation status: implemented in code, payload limited to placeholder data until ApiCoordinator is implemented.

- `game:started`
  - Exact name: `game:started`
  - Producer: `resources/js/v2/engine/GameEngine.js` (emitted from `start()`).
  - Consumer(s): none found in `resources/js/v2` (no `on('game:started', ...)` usages discovered).
  - Payload shape: none (no payload passed in current implementation).
  - When it fires: when `GameEngine.start()` is called by `App.start()`.
  - Fires once or repeatedly: each time `start()` is invoked while the game lifecycle starts; can fire multiple times across lifecycle.
  - Roadmap stage: Stage 1 (Game Engine) and Stage 0 lifecycle signalling; implemented.
  - Implementation status: implemented (emits event synchronously when starting simulation engine).

- `game:stopped`
  - Exact name: `game:stopped`
  - Producer: `resources/js/v2/engine/GameEngine.js` (emitted from `stop()`).
  - Consumer(s): none found in `resources/js/v2`.
  - Payload shape: none currently.
  - When it fires: when `GameEngine.stop()` is called.
  - Fires once or repeatedly: each stop call.
  - Roadmap stage: Stage 1 (Game Engine).
  - Implementation status: implemented.

Events not implemented but mentioned in docs/roadmap
- The master plan and roadmap imply many future events for selection, placement, toolbox updates, simulation ticks, metric updates, and hint engine events. These events are NOT present in the codebase and therefore reside in a "Not implemented" section below.

Not implemented / roadmap events (proposed by roadmap; not present in code)
- Examples mentioned in docs (no code evidence):
  - `selection:changed` — (expected) when user selects a machine/resource.
  - `placement:begin` / `placement:confirm` / `placement:cancel` — placement lifecycle.
  - `simulation:tick` / `simulation:updated` — periodic simulation results.
  - `toolbox:updated` — toolbox contents changed.
  - `hint:recommended` — hint engine suggestions.

  Note: hover highlighting of grid cells is implemented inside the renderer (`GridHighlightRenderer`) and is not emitted as an EventBus event in Stage 1. Selection and selection-related events (e.g., `selection:changed`) remain unimplemented and are planned for Stage 4; do not document payload contracts for these events until they are implemented.

Direct module communication (bypassing EventBus) (verified)
- `resources/js/v2/main.js` wires modules together by passing direct object references into constructors (e.g., `UIManager({ renderer, toolbox, statusProviders: { ... } })`). This is deliberate but means some interactions are direct references rather than strictly event-driven.

Duplicate or inconsistent event names (verified)
- No duplicate or inconsistent event names were found in `resources/js/v2` beyond the three implemented events documented above.

Unconfirmed / Requires verification
- Any event payload structure beyond the minimal `scenario:loaded` `{ id, name }` must be treated as Unconfirmed until ApiCoordinator and DataLoader are implemented and emit fuller scenario shapes.
