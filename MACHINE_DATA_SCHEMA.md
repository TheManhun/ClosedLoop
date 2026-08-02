# Machine Data Schema — canonical model

Goal: single canonical machine object used by all frontend systems. Supabase is the authoritative source; local JSON and built-in definitions are legacy fallbacks only and must not be recorded as provenance in canonical records.

Canonical shape (JSON)
```
{
  "stableKey": "anaerobic_digester",   // canonical identity (snake_case only)
  "id": 123,                            // numeric DB id (metadata only)
  "name": "Anaerobic Digester",
  "description": "Processes farm waste into biogas and digestate.",
  "category": "processing",
  "image": "anaerobic_digester.png",
  "footprint": [2,2],                   // [widthX, heightY]
  "placeable": true,
  "rotationAllowed": true,
  "engineering": {
    "annualCapacity": 40000,
    "capacityUnit": "t/year",
    "defaultOperatingLevel": 0.8,
    "powerRequired": 10,
    "powerProduced": 0,
    "waterRequired": 0,
    "waterProduced": 0,
    "heatRequired": 0,
    "heatProduced": 0,
    "gasRequired": 0,
    "gasProduced": 0,
    "buildCost": 100000,
    "maintenanceCost": 2000,
    "dataStatus": "sourced"          // sourced|placeholder|estimated
  },
  "inputs": [                            // derived from machine_resources
    {
      "resourceStableKey": "farm_waste",
      "direction": "input",
      "amount": null,
      "unit": null,
      "quantityBasis": null,
      "sortOrder": 0,
      "dataStatus": "sourced",
      "evidenceReference": "row/123"
    }
  ],
  "outputs": [
    {
      "resourceStableKey": "biogas",
      "direction": "output",
      "amount": null,
      "unit": null,
      "quantityBasis": null,
      "sortOrder": 0,
      "dataStatus": "sourced",
      "evidenceReference": "row/123"
    }
  ],
  "provenance": {
    "source": "supabase",              // canonical provenance: only 'supabase' for target system
    "updatedAt": "2026-08-03T..Z",
    "sourceReference": "row/42"
  }
}
```

Notes
- `stableKey` is the canonical cross-system identity (snake_case) and must be used in all event payloads and graph relationships.
- Numeric `id` is allowed for DB referencing but is metadata only; do not use numeric ids as primary cross-system identity.
- `inputs` / `outputs` preserve the full `machine_resources` shape including `quantityBasis`, `sortOrder`, `dataStatus`, and `evidenceReference`.
- Engineering fields use exact canonical names: `heatRequired`, `heatProduced`, `gasRequired`, `gasProduced` (do not alternate field names).
- DataLoader/DataNormalizer is responsible for translating DB rows into this canonical shape. No other module should re-normalize machine records.
