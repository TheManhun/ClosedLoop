**Purpose:** Record problems verified from code, tests, build output, logs or existing documentation.
**Version:** 2.0
**Last-reviewed:** 2026-08-07

Only problems verified by repository artefacts or logs are recorded here. Suspected or hypothetical issues are listed under "Unconfirmed risks." Each problem has a stable identifier.

Current blockers
- CLV2-KP-001
  - Title: Core backend integration and simulation logic are not implemented
  - Status: confirmed
  - Severity: high (blocks Stage 2+ development that depends on real data or simulation)
  - Affected stage: Stage 2+ (Api/Data/Simulation)
  - Affected files/modules: `resources/js/v2/api/ApiCoordinator.js`, `resources/js/v2/services/DataLoader.js`, `resources/js/v2/technology/TechnologyEngine.js`, `resources/js/v2/simulation/SimulationEngine.js`.
  - Observed behaviour: these modules intentionally contain placeholder or minimal methods (for Stage 1 the renderer and input subsystems are implemented; ApiCoordinator returns stubbed responses).
  - Evidence: `ApiCoordinator.fetchScenario` returns a placeholder object; SimulationEngine contains lifecycle methods but no domain calculations; Stage 1 tests and runtime checks validate renderer/input/camera/grid/hover functionality.
  - Workaround: V2 development may rely on the Laravel API endpoints (e.g., `/api/machines`) until ApiCoordinator and DataLoader are implemented.
  - Recommended resolution stage: Stage 2 (API) to implement ApiCoordinator/DataLoader and Stage 3+ to implement simulation logic.

Confirmed non-blocking issues
- CLV2-KP-002
  - Title: UIManager currently renders only a text status block for early stages
  - Status: confirmed
  - Severity: low
  - Affected files: `resources/js/v2/ui/UIManager.js`, `resources/views/simulator-v2.blade.php`
  - Observed behaviour: `UIManager.initialise()` writes a monospace text block to `#closed-loop-v2-root` rather than a full UI. Stage 1 focuses on engine/renderer; richer UI is planned for later stages.
  - Evidence: implementation in UIManager and the Blade mount point.
  - Workaround: none required for Stage 1 acceptance.
  - Recommended resolution stage: later Stage (UI improvements) when required.

- CLV2-KP-003
  - Title: WebGL context loss and legacy runtime warnings (legacy V1)
  - Status: confirmed
  - Severity: medium
  - Affected stage: V1 (legacy simulator) — observed in browser logs
  - Observed behaviour: browser logs include warnings and stack traces from legacy `simulator` assets (these are unrelated to V2 Stage 1 code changes).
  - Evidence: console logs captured when navigating to `/simulator` or `/simulator-v2` (legacy assets present in `public/build/assets/*` are referenced).
  - Workaround: these are legacy warnings; they do not block Stage 1 acceptance. Investigate legacy V1 renderer separately.
  - Recommended resolution stage: V1 maintenance or when reusing legacy assets.

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

Additional verified note
- CLV2-KP-005
  - Title: WebGL canvas pixel readback is unreliable for automated visual tests
  - Status: confirmed
  - Severity: low (affects automated visual verification only)
  - Observed behaviour: attempting to copy the WebGL canvas contents into a 2D canvas using `drawImage` returned black pixels in this environment; visual drawing is nonetheless occurring (validated by update-path logs and unit tests).
  - Evidence: automated Playwright sampling of canvas pixels produced black pixels but renderer logs and unit tests show highlights and grid drawing occurred.
  - Workaround: use unit tests and update-path logs for verification, or manual visual checks in a real browser; avoid relying on WebGL->2D pixel readback for CI visual assertions.

Future risks
- Items that are likely to become problems if not addressed before later stages are listed here as "Unconfirmed risks" below. They were not directly verified as runtime failures but represent mismatch risks between documentation and implementation.

Unconfirmed risks
- UR-001: `phaser` is a dependency and is used by the V2 renderer; confirm Phaser feature usage as Stage 1 progresses.
- UR-002: Supabase schema ownership for certain composite fields (e.g., quantity bases, units) is not fully documented in `docs/supabase.md`. API normalisation expectations may need clarification.
