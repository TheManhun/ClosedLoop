Yes — that is the right direction.

The goal should be:

> Turn the current prototype into a platform where adding a new machine is mostly database work, not surgery inside `simulator.js`.

Copilot’s review already identified the same core problems: `simulator.js` is acting as a god-object, machine data exists in too many places, and the UI/game boundary is fragile. 

## Target architecture

```text
Supabase
   ↓
Laravel API
   ↓
API Coordinator
   ↓
Data Loader
   ↓
Game State / Technology Graph
   ↓
Event Manager
   ├── Game Engine
   ├── Placement Manager
   ├── Toolbox / Context Panel
   └── UI
```

Supabase becomes the only engineering source of truth.

Local JSON and built-in machine records become temporary fallback data only, then eventually disappear.

---

# Stage 1 — Freeze and document the current system

Before moving code, create a clear baseline.

Do not add new machines or features during this stage.

Create:

```text
ARCHITECTURE.md
MACHINE_DATA_SCHEMA.md
EVENTS.md
```

Document:

* where machine data currently comes from;
* what `simulator.js` currently owns;
* how a machine is loaded, placed, selected and connected;
* every event already used;
* the exact runtime shape of a machine definition;
* which pieces are legacy.

Also create a stable Git milestone branch:

```text
refactor/simulator-architecture
```

**Completion test:** the existing simulator still runs exactly as it did before the refactor.

---

# Stage 2 — Make Supabase the only source of truth

This should happen before the major UI restructuring.

The current overlap between Supabase, `machines.json`, `MachineRepository`, `BuildingDefinitions` and built-in arrays is one of the biggest sources of complexity. 

## Supabase should own

For each machine:

```text
stable_key
name
description
category
image
footprint_x
footprint_y
placeable
rotation_allowed

annual_capacity
capacity_unit
default_operating_level

power_required
power_produced
water_required
water_produced
heat_required
heat_generated
gas_required
gas_produced

build_cost
maintenance_cost
data_status
source_reference
confidence
notes
```

Relationships remain in:

```text
machine_resources
```

That table determines inputs and outputs.

## Remove eventually

```text
resources/data/machines.json
builtInMachines arrays
hard-coded annual capacities
hard-coded machine images
hard-coded accepts/provides lists
```

Some simulator-only rendering values may remain locally at first, but they should be separated clearly from engineering data.

**Completion test:** adding a machine to Supabase makes it appear in the application without editing JavaScript.

---

# Stage 3 — Create one canonical machine model

Right now different parts of the project use:

```text
stable_key
stableKey
defKey
camelCase
snake_case
numeric id
```

That must be normalized once.

Create a single canonical shape:

```javascript
{
  id,
  stableKey,
  name,
  category,
  image,
  footprint,
  placeable,
  engineering,
  inputs,
  outputs,
  provenance
}
```

Only the Data Loader should translate database fields into this format.

Nothing else should normalize machine data.

This replaces the overlap between `MachineRepository` and `BuildingDefinitions`, which Copilot specifically flagged. 

**Completion test:** every system receives the same machine object shape.

---

# Stage 4 — Break `simulator.js` into the seven parts

## 1. Game Engine

Suggested file:

```text
simulator/core/SimulatorEngine.js
```

Responsibilities:

* own the running simulator state;
* start and stop the scene;
* manage update ticks;
* coordinate managers;
* expose a small public API.

It should not:

* build DOM;
* fetch Supabase;
* populate toolbox cards;
* normalize machine records.

---

## 2. UI

Suggested folder:

```text
simulator/ui/
```

Responsibilities:

* Operations Centre;
* machine information panel;
* context panel;
* dialogs;
* status bars;
* visual rendering only.

UI receives prepared view models.

It should not calculate engineering values or call Supabase directly.

---

## 3. Data Loader

Suggested files:

```text
simulator/data/MachineDataLoader.js
simulator/data/ResourceDataLoader.js
simulator/data/DataNormalizer.js
```

Responsibilities:

* request API data;
* normalize machine and resource records;
* cache results;
* validate required fields;
* expose canonical records.

It should not know about Phaser or the DOM.

---

## 4. Event Manager

Suggested file:

```text
simulator/core/SimulatorEventBus.js
```

Use one event system only.

Remove the mix of:

* DOM custom events;
* direct manager calls;
* `window.__simulatorScene`;
* inconsistent payloads.

Define event contracts such as:

```text
selection:changed
placement:started
placement:completed
placement:cancelled
machine:added
machine:moved
machine:removed
connection:added
connection:removed
simulation:recalculated
toolbox:mode-changed
```

Every event should have a documented payload.

For example:

```javascript
{
  type: "machine",
  stableKey: "anaerobic_digester",
  instanceId: "machine-42"
}
```

The current inconsistent selection payloads are a known weakness. 

---

## 5. Placement Manager

Suggested file:

```text
simulator/managers/PlacementManager.js
```

You already have a good base in `PlacementController`, which Copilot identified as one of the stronger components. 

Responsibilities:

* placement mode;
* preview;
* footprint validation;
* rotation;
* placing a machine;
* cancelling placement;
* selecting the newly placed machine.

It should consume canonical machine records only.

---

## 6. Toolbox / Context Panel

Suggested files:

```text
simulator/ui/ContextPanel.js
simulator/ui/ContextPanelModel.js
simulator/services/TechnologyGraphService.js
```

Responsibilities:

* selection-aware suggestions;
* Show All mode;
* recent machines;
* connection tools;
* filtering buildable machines;
* explaining why a machine is suggested.

It should read the technology graph and emit placement requests.

It should never hard-code chains such as:

```text
Farm Waste → Anaerobic Digester
```

That must come from `machine_resources`.

---

## 7. API Coordinator

Suggested backend-facing module:

```text
simulator/api/SimulatorApiClient.js
```

Responsibilities:

```text
GET /api/machines
GET /api/resources
GET /api/technologies
GET /api/scenarios
```

It handles:

* HTTP errors;
* retries;
* response validation;
* version mismatches;
* authentication later;
* API health status.

The Data Loader uses the API Coordinator.

The rest of the simulator never calls `fetch()` directly.

---

# Stage 5 — Separate engineering logic from rendering

Create pure calculation services:

```text
AnnualFlowCalculator
PowerBalanceCalculator
WaterBalanceCalculator
GasFlowCalculator
HeatFlowCalculator
UtilisationCalculator
ScenarioCalculator
```

Each service should accept plain data and return plain results.

Example:

```javascript
calculateAnnualFlow({
  sourceAvailability,
  machineCapacity,
  operatingLevel,
  connectionExists
})
```

Phaser, DOM and Supabase should not appear in these modules.

**Completion test:** all engineering calculations can run in Node tests without opening the simulator.

---

# Stage 6 — Make resources first-class selectable objects

At present, some waste icons are decorative sprites rather than real selectable objects. That is why the Context Panel failed when clicking Farm Waste.

Create a clean model:

```text
ResourceSourceInstance
```

Example:

```javascript
{
  id: "farm-waste-source-1",
  stableKey: "farm_waste",
  annualAvailable: 32000,
  unit: "t/year",
  position: { x, y },
  selectable: true,
  movable: false
}
```

The map starts with these resource sources.

They are not buildable.

They should participate in:

* selection;
* connection validation;
* annual-flow calculations;
* context suggestions;
* highlighting.

**Completion test:** clicking any waste source selects it through the same event system as clicking a machine.

---

# Stage 7 — Rebuild the Context Panel cleanly

Only after selection and event contracts are stable.

Modes:

```text
Suggested
Show All
```

## Suggested mode

When a resource is selected:

```text
Compatible Technologies
```

When a machine is selected:

```text
Inputs
Outputs
Suggested Next Technologies
```

## Show All mode

Displays all buildable machines exactly once.

Resources never appear here.

Connections remain accessible.

**Completion test:** the panel works entirely from the graph service and selection events, without direct access to `window.__simulatorScene`.

---

# Stage 8 — Simplify connection architecture

Connections should have one shared model:

```javascript
{
  id,
  type,
  sourceInstanceId,
  targetInstanceId,
  resourceStableKey,
  capacity,
  status
}
```

Then specialized renderers:

```text
PowerConnectionRenderer
WaterConnectionRenderer
GasConnectionRenderer
ConveyorConnectionRenderer
HeatConnectionRenderer
```

Validation and graphics should remain separate.

```text
ConnectionValidator
ConnectionManager
ConnectionRenderer
```

**Completion test:** moving a machine changes only connection geometry, not connection logic.

---

# Stage 9 — Remove legacy layers

Once the new path is working, remove:

* legacy toolbox population;
* built-in machine arrays;
* duplicate machine aliases;
* old resource dialog selection hacks;
* direct `fetch()` calls;
* direct DOM events;
* broad empty `catch` blocks;
* `window.__simulatorScene` production usage;
* stale JSON data.

Copilot specifically identified global access, silent error swallowing and duplicate UI plumbing as major technical debt. 

Do this last, not first.

---

# Stage 10 — Establish the easy-to-build-on workflow

The final developer workflow should be:

## To add a new resource

Add it to Supabase:

```text
resources
```

## To add a new machine

Add it to:

```text
machines
```

## To define inputs and outputs

Add rows to:

```text
machine_resources
```

## To attach evidence

Add:

```text
machine_links
resource_links
technologies
machine_technologies
```

## To add the image

Upload the image and set:

```text
machines.image
```

No JavaScript edits should be required unless the new technology introduces an entirely new physical connection type or calculation rule.

---

# Recommended order

I would do this in five milestones:

### Milestone 1 — Foundation

* architecture documents;
* Supabase-only source of truth;
* canonical machine model;
* API coordinator;
* data loader.

### Milestone 2 — Clean core

* split `simulator.js`;
* game engine;
* event manager;
* placement manager;
* remove global coupling.

### Milestone 3 — Real selectable world

* resource source instances;
* consistent selection DTO;
* technology graph;
* context panel.

### Milestone 4 — Simulation systems

* annual flow;
* power;
* water;
* gas;
* heat;
* utilisation.

### Milestone 5 — Cleanup and scale

* delete legacy paths;
* bundle splitting;
* integration tests;
* documentation;
* deployment preparation.

## The most important rule

Do not try to split all seven parts in one Copilot prompt.

Do them one at a time, with this rule:

```text
Move responsibility.
Preserve behaviour.
Run tests.
Verify in browser.
Commit.
Then continue.
```

That gives you a controlled refactor instead of another large wave of code with no visible result.
