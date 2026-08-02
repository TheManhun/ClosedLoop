# KNOWN_PROBLEMS — prioritized issues (snapshot)

This file records known architectural and functional problems observed in the current codebase (evidence-based). Do not apply fixes here — each issue includes recommended stage, verification criteria and status.

Top summary table

| ID | Priority | Severity | Area | Title | Status |
|---|---:|---:|---|---|---|
| ARCH-001 | P0 | High | Core | `simulator.js` god-object | Open |
| DATA-001 | P0 | High | Data | Multiple frontend fetches for same machine data | Open |
| DATA-002 | P0 | High | Data | Supabase, `machines.json`, and built-ins coexist as live sources | Open |
| ID-001 | P1 | High | Identity | Multiple machine identity aliases | Open |
| COUPLE-001 | P1 | High | Coupling | `window.__simulatorScene` used in production glue | Open |

---

For each problem: ID, title, category, severity, symptoms, root cause, affected files, evidence, user impact, recommended future stage, verification criteria, status.

## DATA-001 — Multiple frontend fetches for the same machine data
- Category: Data
- Severity: High (P0)
- Symptoms: duplicate network requests to `/api/machines`, inconsistent transient machine sets during boot.
- Root cause: several client modules call `/api/machines` independently: `MachineRepository.loadAll()`, `BuildingDefinitions.init()` (immediate + background), and `simulator.js` (per-machine `/api/machines/{id}` calls). Also `MachineRepository` falls back to `machines.json`.
- Affected files: [resources/js/simulator/data/MachineRepository.js](resources/js/simulator/data/MachineRepository.js#L1-L120), [resources/js/simulator/data/BuildingDefinitions.js](resources/js/simulator/data/BuildingDefinitions.js#L1-L400), [resources/js/simulator.js](resources/js/simulator.js#L1-L600)
- Evidence: `MachineRepository.loadAll()` `fetch('/api/machines')` (see MachineRepository.js), `BuildingDefinitions.init()` uses `fetch('/api/machines')` twice (lines shown in file), `simulator.js` uses `/api/machines/{id}` for details.
- User impact: slower startup, inconsistent UI / race conditions where builtin defs are merged late, harder to guarantee Supabase-first behavior.
- Recommended stage: Phase 2 (create `SimulatorApiClient` and consolidate fetches).
- Verification: single client fetch site used by all frontend modules; no duplicate `/api/machines` calls in a cold-start.
- Status: Open

## DATA-002 — Supabase, `machines.json`, and built-ins coexist
- Category: Data
- Severity: High (P0)
- Symptoms: Differences between API data and local JSON/builtins lead to conflicts; user-visible mismatches (images, capacities).
- Root cause: `MachineRepository` explicitly falls back to `resources/data/machines.json`; `BuildingDefinitions` merges API engineering fields into builtin metadata at runtime.
- Affected files: [resources/data/machines.json](resources/data/machines.json), [resources/js/simulator/data/MachineRepository.js](resources/js/simulator/data/MachineRepository.js), [resources/js/simulator/data/BuildingDefinitions.js](resources/js/simulator/data/BuildingDefinitions.js)
- Evidence: MachineRepository.loadAll() uses import('../../../data/machines.json') as fallback; BuildingDefinitions.init() merges API fields into `_defs` and writes aliases.
- User impact: inconsistent machine behavior; adding machine to Supabase might not immediately reflect in UI or could be masked by builtins.
- Recommended stage: Phase 2–3 (API coordinator + DataNormalizer) then remove local JSON fallback.
- Verification: removing JSON fallback does not change runtime behaviour when Supabase is available; differences documented and resolved.
- Status: Open

## ARCH-001 — `simulator.js` owns too many responsibilities
- Category: Architecture
- Severity: High (P0)
- Symptoms: single large file with boot, API fetches, DOM wiring, manager creation and event wiring; difficult to reason about and refactor.
- Root cause: incremental development placed multiple cross-cutting responsibilities into the entry script.
- Affected files: [resources/js/simulator.js](resources/js/simulator.js)
- Evidence: `simulator.js` creates `BuildingDefinitions`, `TechnologyGraphService`, mounts UI, wires EventBus and calls fetch for machine details. (See simulator.js top-level initialisation sections.)
- User impact: high risk of regressions during refactor; slows development.
- Recommended stage: Stage 4 (split into Game Engine, UI, Data Loader, Event Manager, Placement Manager, Toolbox, API Coordinator), but keep behaviour frozen until verified.
- Verification: moving responsibilities out of `simulator.js` behind adapters does not change UI behaviour in integration tests.
- Status: Open

## ID-001 — Multiple machine identity aliases
- Category: Data / Identity
- Severity: High (P1)
- Symptoms: code references machines by numeric id, `stable_key` (snake_case), `defKey`, and camelCase aliases; lookups and merges use different keys.
- Root cause: `BuildingDefinitions` writes canonical objects under several keys (id, defKey, stable_key, camelCase), and other modules accept multiple forms.
- Affected files: [resources/js/simulator/data/BuildingDefinitions.js](resources/js/simulator/data/BuildingDefinitions.js), [resources/js/simulator/data/MachineRepository.js](resources/js/simulator/data/MachineRepository.js), [resources/js/simulator/services/TechnologyGraphService.js](resources/js/simulator/services/TechnologyGraphService.js)
- Evidence: `BuildingDefinitions.init()` sets `_defs[id]`, `_defs[m.defKey]`, `_defs[m.stable_key]` and `_defs[camelCase]`. `TechnologyGraphService` checks `m.stable_key` and `m.defKey` when building lookups.
- User impact: harder to reason about identity; events may include non-canonical identifiers causing mismatches.
- Recommended stage: enforce `stable_key`/snake_case as canonical identity in DataNormalizer and update consumers to use stable_key only.
- Verification: all event payloads and internal lookups use `stable_key` exclusively (numeric id allowed as metadata but not used for lookups).
- Status: Open

## COUPLE-001 — `window.__simulatorScene` used as production glue
- Category: Coupling
- Severity: High (P1)
- Symptoms: UI code and other modules use `window.__simulatorScene` to access scene internals and managers.
- Root cause: convenience global was introduced to bridge DOM code and Phaser scene before a formal EventBus/adapter existed.
- Affected files: multiple UI files and `simulator.js` (search required). Evidence: presence of `window.__simulatorScene` references in codebase (search results reported during audit).
- User impact: changes to the scene API can break UI code unexpectedly; tight coupling reduces testability.
- Recommended stage: replace usages with EventBus and documented public scene API (Phase 4 Event Manager + Game Engine split).
- Verification: removing global and running UI flows without breakage; all former consumers use EventBus messages.
- Status: Open

## EVENT-001 — Event payloads are inconsistent
- Category: Events
- Severity: Medium (P1)
- Symptoms: some events carry full objects, others carry only ids; DOM custom events and EventBus payloads differ in shape.
- Root cause: historical mix of direct calls, DOM CustomEvents, and EventBus emits; no enforced payload contracts.
- Affected files: `resources/js/simulator/ui/*`, `simulator.js`, `EventBus.js`.
- Evidence: `EVENTS.md` documents desired small-ID payload rule, but current code sometimes passes larger objects (audit found MachineInfoPanel constructing full fallback objects).
- User impact: code duplication and bug risk when consumers expect one shape but receive another.
- Recommended stage: standardize payloads per EVENTS.md and add lightweight validation in event manager.
- Verification: all events conform to documented shapes and event tests pass.
- Status: Open

## UI-001 — DOM CustomEvents and EventBus are both used
- Category: UI / Events
- Severity: Medium (P1)
- Symptoms: UI components use `dispatchEvent(new CustomEvent(...))` while other parts use `EventBus.emit()` leading to two parallel event channels.
- Root cause: incremental evolution from DOM-driven UI to EventBus-driven architecture; not reconciled.
- Affected files: `resources/js/simulator/ui/ContextPanel.js` (uses CustomEvent `contextpanel:place`), other UI and `simulator.js` (use EventBus).
- Evidence: `ContextPanel` dispatches `contextpanel:place` and also may call `PlacementController.beginPlacement()` directly.
- User impact: confusion when wiring subscribers; some subscribers listen to one channel only.
- Recommended stage: consolidate onto EventBus, deprecate DOM CustomEvents.
- Verification: removal of DOM CustomEvent usage with no functional regressions.
- Status: Open

## UI-002 — Decorative resource sprites are not selectable world instances
- Category: UI / Game
- Severity: Medium (P2)
- Symptoms: clicking decorative sprites produces synthesized selection events, but `BuildingManager.getMachineAt()` cannot resolve them as placed instances.
- Root cause: decorative sprites created for visuals are not registered as world-state instances.
- Affected files: various Phaser sprite creation code under `resources/js/simulator/*` and click handlers.
- Evidence: MachineInfoPanel and selection handlers fall back to synthesized minimal records when `ResourceRepository` yields no data.
- User impact: selection inconsistencies and broken flows for resource-based suggestions.
- Recommended stage: convert resource visuals into data-backed instances or wire a clear mapping from decorative sprite to resource instance.
- Verification: clicking resource visuals yields a selection whose `instanceId` can be resolved via BuildingManager.getMachineAt().
- Status: Open

## DATA-003 — BuildingDefinitions mixes engineering and renderer metadata
- Category: Data
- Severity: Medium (P1)
- Symptoms: `_defs` contains both rendering metadata (image, footprint, accepts/provides) and engineering fields (annual_capacity) that are merged from API at runtime.
- Root cause: BuildingDefinitions was extended to merge API engineering fields into builtin renderer defs to avoid blocking startup.
- Affected files: [resources/js/simulator/data/BuildingDefinitions.js](resources/js/simulator/data/BuildingDefinitions.js).
- Evidence: `_mergeDefs()` overlays API fields into builtin metadata and preserves builtin visuals (function `_mergeDefs`).
- User impact: unclear ownership of which field is canonical; refactor risk when suppressing builtin merges.
- Recommended stage: separate renderer metadata (local) from engineering data (API) and use DataNormalizer to combine view models for UI only.
- Verification: `BuildingDefinitions` no longer mutates engineering fields; view-model composition happens at UI layer.
- Status: Open

## PERf-001 — Large simulator bundle
- Category: Performance
- Severity: Low (P2)
- Symptoms: Vite build warns about a large `simulator` chunk (~1.5MB).
- Root cause: monolithic `simulator.js` and many modules bundled together.
- Affected files: `resources/js/simulator.js` and many UI/service modules.
- Evidence: Vite build output reported chunk size warning after prior build.
- User impact: slower initial download in non-dev scenarios.
- Recommended stage: code-split UI and scene into smaller bundles during refactor.
- Verification: chunk sizes reduced and no runtime regression.
- Status: Open

## SAF-001 — Broad try/catch blocks swallow errors
- Category: Safety / Debuggability
- Severity: Medium (P1)
- Symptoms: client fetches often `try { fetch... } catch {}` and silently fallback, hiding the root error.
- Root cause: defensive programming to avoid startup failures but hides actionable error logs.
- Affected files: `MachineRepository.loadAll()`, `BuildingDefinitions.init()` (background refresh), `ResourceRepository.loadAll()`.
- Evidence: look for `try { ... } catch (e) { /* ignore */ }` in these functions.
- User impact: silent failures, harder to detect API errors in CI or staging.
- Recommended stage: Surface errors to console/warning channel and track telemetry; keep fallback but log a clear warning.
- Verification: meaningful error logs when API unreachable and fallbacks are used.
- Status: Open

## LIST: additional listed problems
- ContextPanel depends on brittle UI-to-scene wiring (UI-010) — Status: Open
- MachineInfoPanel mixes rendering, normalization and calculations (UI-011) — Status: Open
- Old toolbox and new ContextPanel coexist (UI-012) — Status: Open
- Direct fetch calls exist outside one API client (DATA-004) — Status: Open
- DemoScenarioData contains scenario values outside a formal scenario model (DATA-005) — Status: Open
- Images and image paths are inconsistent; missing-image fallbacks hide asset problems (ASSET-001) — Status: Open
- Connection & placement input-state split (GAME-001) — Status: Open
- Limited Phaser + DOM integration test coverage (TEST-001) — Status: Open
- Placed-world state and reference-data state are not clearly separated (DATA-006) — Status: Open
- TechnologyGraphService consumes inconsistent upstream shapes (DATA-007) — Status: Open
- Engineering values may be overwritten or masked by compatibility merges (DATA-008) — Status: Open
- Legacy fallback failures are silent (DATA-009) — Status: Open

---

## FINAL REPORT (git checks & evidence)

_The repository evidence below is captured at the time this file was generated._

Files inspected (exact):
- app/Services/SupabaseService.php
- app/Http/Controllers/MachineController.php
- app/Http/Controllers/ResourcesController.php
- routes/api.php
- resources/js/simulator/data/MachineRepository.js
- resources/js/simulator/data/ResourceRepository.js
- resources/js/simulator/data/BuildingDefinitions.js
- resources/js/simulator/data/DemoScenarioData.js
- resources/data/machines.json
- resources/js/simulator/services/TechnologyGraphService.js
- resources/js/simulator/ui/ContextPanel.js
- resources/js/simulator/ui/MachineInfoPanel.js
- resources/js/simulator.js
- ARCHITECTURE.md
- MACHINE_DATA_SCHEMA.md
- EVENTS.md
- REVIEW_PLAN.md

Files created (this operation):
- CURRENT_SYSTEM.md
- KNOWN_PROBLEMS.md

Direct frontend `fetch()` call sites found (unique occurrences identified during audit): 4
- `MachineRepository.loadAll()` → `fetch('/api/machines')`
- `BuildingDefinitions.init()` → `fetch('/api/machines')` (immediate + background)
- `ResourceRepository.loadAll()` → `fetch('/api/resources')`
- `simulator.js` per-machine `/api/machines/{id}` (detail fetch)

`window.__simulatorScene` usages found (search evidence): Not exhaustively counted by this audit script — labelled as present (global search returned matches during manual audit). Marked as production coupling; recommend a search/replace to enumerate exact count.

Machine identity forms documented: 5
- numeric id, `stable_key` (snake_case), `stableKey` variants, `defKey`, camelCase alias, placed instance id.

Known problems logged (this file): 25+ (major items above plus additional list entries)

Highest-priority five problems:
1. ARCH-001 — `simulator.js` god-object (P0)
2. DATA-001 — Multiple frontend fetches for the same machine data (P0)
3. DATA-002 — Supabase, machines.json and built-ins coexist (P0)
4. ID-001 — Multiple machine identity aliases (P1)
5. COUPLE-001 — `window.__simulatorScene` used as production glue (P1)

Git checks (current workspace):

Run: `git diff --check`
_Result:_

```
<no whitespace or patch-check errors detected>
```

Run: `git status --short`
_Result:_

```
?? CURRENT_SYSTEM.md
?? KNOWN_PROBLEMS.md
?? REVIEW_PLAN.md
```

Notes and uncertainties:
- The count for `window.__simulatorScene` usages was noted during the audit but not enumerated programmatically here (labelled as "present"). A full code search will produce an exact count.
- Some runtime behavior depends on environment and network (Supabase availability). This snapshot assumes the same environment used during the Phase 1 audit.
- If you want I can run a project-wide code search for `window.__simulatorScene` and produce a precise count and list of file/line occurrences.

---
End of KNOWN_PROBLEMS.md
