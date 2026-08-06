**Purpose:** Record problems verified from code, tests, build output, logs or existing documentation.
**Version:** 2.0
**Last-reviewed:** 2026-08-06

Only problems verified by repository artefacts or logs are recorded here. Suspected or hypothetical issues are listed under "Unconfirmed risks." Each problem has a stable identifier.

Current blockers
- CLV2-KP-001
  - Title: Stage 0 modules are scaffolds (no functional implementation)
  - Status: confirmed
  - Severity: high (blocks Stage 1+ development that depends on data or simulation)
  - Affected stage: Stage 0 / all early stages relying on real data
  - Affected files/modules: `resources/js/v2/api/ApiCoordinator.js`, `resources/js/v2/services/DataLoader.js`, `resources/js/v2/technology/TechnologyEngine.js`, `resources/js/v2/simulation/SimulationEngine.js`, `resources/js/v2/renderer/Renderer.js`.
  - Observed behaviour: these modules contain placeholder methods or no logic (see ApiCoordinator.fetchScenario returns a stubbed object; SimulationEngine has no engineering calculations).
  - Expected behaviour: ApiCoordinator should connect to a verified API, DataLoader should normalise/cache, TechnologyEngine and SimulationEngine should implement domain logic required by roadmap stages.
  - Evidence: code in the listed files under `resources/js/v2/` (see `fetchScenario` implementation and empty methods).
  - Workaround: none (progress requires implementing real behaviour);
  - Recommended resolution stage: Stage 1 (engine) + Stage 2 (API) before feature work that depends on real data.

Confirmed non-blocking issues
- CLV2-KP-002
  - Title: UIManager currently renders only a text status block for Stage 0
  - Status: confirmed
  - Severity: low
  - Affected stage: Stage 0
  - Affected files: `resources/js/v2/ui/UIManager.js`, `resources/views/simulator-v2.blade.php`
  - Observed behaviour: `UIManager.initialise()` writes a monospace text block to `#closed-loop-v2-root` instead of a visual UI.
  - Expected behaviour: Stage 0 intentionally shows minimal info; Stage 1 should progress to a visual map.
  - Evidence: implementation in UIManager and the Blade mount point.
  - Workaround: none required; this is the designed Stage 0 behaviour.
  - Recommended resolution stage: Stage 1 (Game Engine) for visual UI.

- CLV2-KP-003
  - Title: WebGL context loss warnings present in repository logs (legacy simulator)
  - Status: confirmed
  - Severity: medium
  - Affected stage: V1 (legacy simulator) — observed in browser logs
  - Affected files/modules: legacy runtime (not V2) — referenced at runtime `/simulator`
  - Observed behaviour: `storage/logs/browser.log` contains `WebGL Context lost. Renderer disabled` warnings for simulator routes.
  - Expected behaviour: renderer should not repeatedly lose the WebGL context in normal operation.
  - Evidence: `storage/logs/browser.log` entries containing the warning and referencing `/simulator`.
  - Workaround: reload or use a browser/environment without WebGL issues; address in legacy renderer if necessary.
  - Recommended resolution stage: non-blocking; address separately for V1 maintenance or during Stage 1 if Phaser/renderer reuse occurs.

Documentation inconsistencies (confirmed)
- CLV2-KP-004
  - Title: Master plan says Supabase is the only source of truth, but V2 ApiCoordinator is not wired to Supabase yet
  - Status: confirmed
  - Severity: medium (process/policy inconsistency)
  - Affected files/modules: `docs/CLOSED_LOOP_V2_MASTERPLAN.md`, `resources/js/v2/api/ApiCoordinator.js`, `app/Services/SupabaseService.php`
  - Observed behaviour: master plan and decisions mandate Supabase as the single source of truth; V2 `ApiCoordinator` currently returns placeholder data and does not call the backend or Supabase.
  - Expected behaviour: V2 ApiCoordinator should be implemented to fetch from the Laravel API (which itself proxies Supabase via `SupabaseService`).
  - Evidence: `ApiCoordinator.fetchScenario` returns a resolved promise with `{ id, name }`; Laravel controllers call `SupabaseService` to proxy data.
  - Workaround: V2 development can rely on Laravel API endpoints (`/api/machines`, `/api/resources`) until ApiCoordinator is implemented.
  - Recommended resolution stage: Stage 2 (API) to implement ApiCoordinator and data normalisation.

Future risks
- Items that are likely to become problems if not addressed before later stages are listed here as "Unconfirmed risks" below. They were not directly verified as runtime failures but represent mismatch risks between documentation and implementation.

Unconfirmed risks
- UR-001: `phaser` is a dependency but V2 renderer currently contains no Phaser code; decision to use Phaser for V2 rendering remains unverified in code. (See `package.json` and V2 renderer.)
- UR-002: Supabase schema ownership for certain composite fields (e.g., quantity bases, units) is not fully documented in `docs/supabase.md`. API normalisation expectations may need clarification.
