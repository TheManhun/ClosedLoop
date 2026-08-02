# Simulator Event Contracts

Use the EventBus for all cross-layer communication. Do NOT mix DOM custom events and direct function calls in new code.

Event list (name → payload)

1. `selection:changed`
- payload: `null` | `SelectionDTO`

SelectionDTO
```
{
  "type": "resourceSource" | "machine" | "connection" | "ground",
  "stableKey": "anaerobic_digester" | "farm_waste" | null, // canonical stableKey for reference data
  "resourceStableKey": "farm_waste", // when selection is a resourceSource
  "instanceId": "instance-42" | null, // placed instance id when applicable
  "meta": { /* optional small metadata */ }
}
```

Notes: a `resourceSource` is a placed map instance (not the abstract resource definition). Use `resourceStableKey` + `instanceId` to reference it.

2. `placement:started`
```
{
  "stableKey": "anaerobic_digester",
  "source": "toolbox" | "contextpanel" | "hotkey",
  "options": { "rotation": 0 | 90 }
}
```

3. `placement:completed`
```
{
  "instanceId": "machine-42",
  "stableKey": "anaerobic_digester",
  "gridX": 10,
  "gridY": 6
}
```

4. `placement:cancelled`
```
{
  "stableKey": "anaerobic_digester",
  "reason": "user" | "invalid" | "error"
}
```

5. `machine:added`
```
{
  "instanceId": "machine-42",
  "stableKey": "anaerobic_digester",
  "source": "initial" | "placement" | "import"
}
```

6. `machine:moved`
```
{
  "instanceId": "machine-42",
  "gridX": 12,
  "gridY": 7
}
```

7. `machine:removed`
```
{
  "instanceId": "machine-42",
  "stableKey": "anaerobic_digester"
}
```

8. `connection:added`
```
{
  "id": "conn-7",
  "type": "conveyor" | "power" | "water" | "gas",
  "sourceInstanceId": "machine-10",
  "targetInstanceId": "machine-12",
  "resourceStableKey": "biogas"
}
```

9. `connection:removed`
```
{ "id": "conn-7" }
```

10. `toolbox:mode-changed`
```
{
  "mode": "suggested" | "all",
  "selection": SelectionDTO | null
}
```

11. `simulation:recalculated`
```
{
  "timestamp": "2026-08-03T..Z",
  "summary": { "machines": 12, "connections": 8, "unresolvedResources": [ /* small summary */ ] }
}
```

Event payload rule (important)
- Events should carry identifiers and small values only (stable keys, instance ids, small flags).
- Do not broadcast full canonical records in event payloads.
- Full canonical reference records must be read from the canonical data store cache maintained by the Data Loader/API Coordinator.
- Placed-instance (world-state) records must be read from the world-state store (e.g. `BuildingManager`).
- Do not instruct subscribers to call `fetch()` or re-run DataLoader directly for every event; use centrally-updated caches and stores.

Event rules
- Payloads must be small (IDs and stableKeys rather than whole objects).
- Subscribers should retrieve full records from the canonical data cache or the world-state store, not via ad-hoc `fetch()` calls.
