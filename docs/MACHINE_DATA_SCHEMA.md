**Purpose:** Describe the Supabase-backed machine/resource schema as used and referenced by the application.
**Version:** 2.0
**Last-reviewed:** 2026-08-06

Authoritative source
- The Supabase instance (accessed by `app/Services/SupabaseService.php`) is the single source of truth for machine and resource definitions. This document summarises the relevant tables and fields exported in `docs/supabase.md` and the fields consumed by the application.

General notes and rules
- Only fields and relationships verified in code or `docs/supabase.md` are documented here. Where ownership or FK constraints are not explicit in the exported column list, the item is marked as Unconfirmed.
- The Laravel `SupabaseService::getMachine()` demonstrates expected joined relations and the frontend/API shape the application uses.

Primary tables and key fields (verified)

- `machines` (primary identifier: `id`)
  - `id` (bigint, NOT NULL): primary identifier (used by API endpoints and frontend).
  - `name` (text, NOT NULL): human readable name.
  - `description` (text, NULLABLE): descriptive text.
  - `image` (text, NULLABLE): URL or path for an image.
  - `power_required` (numeric, NULLABLE): power demand (units not enforced in schema).
  - `water_required` (numeric, NULLABLE)
  - `footprint_x` (integer, NOT NULL, default 2): X footprint size on the grid.
  - `footprint_y` (integer, NOT NULL, default 2): Y footprint size on the grid.
  - `configurable` (boolean, NOT NULL, default false)
  - `category` (text, NULLABLE)
  - `stable_key` (text, NULLABLE): optional stable key present in the schema (used for durable references across environments).
  - `annual_capacity`, `capacity_unit`, `default_operating_level`, `heat_required`, `heat_generated`, `co2_generated`, `methane_generated` (present and nullable in schema; meaning inferred from column name) — treat values as domain data owned by Supabase.

- `machine_resources` (relationship between machines and resources)
  - `id` (bigint, NOT NULL)
  - `machine_id` (bigint, NULLABLE) — expected to reference `machines.id` (relationship used by `SupabaseService` when joining `machine_resources` to `resources` — FK not present in column dump but used by REST join).
  - `resource_id` (bigint, NULLABLE) — expected to reference `resources.id` (see Unconfirmed note below).
  - `direction` (text, NULLABLE): direction of flow (e.g., `in`, `out`); used by application as `direction`.
  - `amount` (numeric, NULLABLE)
  - `unit` (text, NULLABLE)
  - `quantity_basis` (text, NULLABLE)
  - `compatibility_metadata` (jsonb, NULLABLE): structured compatibility hints.
  - `evidence_reference`, `confidence`, `data_status` (nullable): metadata about the record.

- `resources` (inferred from Supabase usage)
  - `id`, `name`, `description`, `category`, `image` — fields referenced in joined selects by `SupabaseService` (`resources(id,name,category,image)`). The full `resources` exported column list is present in `docs/supabase.md` but not repeated here in full.

- `machine_links` (machine -> external link objects)
  - `id` (bigint), `machine_id` (bigint), `title` (text), `url` (text), `link_type` (text), `organisation` (text, nullable), `description` (text, nullable), `publication_date` (date, nullable), `verified` (boolean, default false), `publisher`, `confidence`, `notes`.

- `machine_technologies` and `technologies`
  - `machine_technologies` contains `machine_id`, `technology_id`, `role`, `description`.
  - `technologies` table fields such as `id`, `name`, `description`, `category`, `maturity_level`, `image`, `notes` are referenced in `SupabaseService` and returned to API consumers.

- `machine_profiles` (profile metadata for machines)
  - Fields include `id`, `machine_id`, `profile_name`, `annual_capacity`, `power_required`, `water_required`, `heat_required` and associated metadata fields.

- `resource_composition` (resource -> component resources)
  - `parent_resource_id`, `component_resource_id`, `quantity`, `unit`, `quantity_basis`, `recoverable` (boolean default true), etc.

Fields used by V2 (explicitly referenced in code)
- The following fields are explicitly selected and normalised by `app/Services/SupabaseService::getMachine()` and therefore are required by consumers (including V2 when it calls the Laravel API):
  - From `machines`: `id`, `name`, `description`, `category`, `image`, `configurable`, `power_required`, `water_required`, `footprint_x`, `footprint_y`.
  - From `machine_resources` joined->`resources`: `direction`, `amount`, `unit`, and the joined `resources(id,name,category,image)` properties.
  - From `machine_links`: `title`, `url`, `link_type`, `organisation`, `description`, `publication_date`, `verified`.
  - From `machine_technologies` joined->`technologies`: `role`, `description` (from the join table) and `id`, `name`, `description`, `category`, `maturity_level`, `image`, `notes` (from `technologies`).

Nullable status and meaning (verified where possible)
- All `..._required` numeric fields (power_required, water_required, heat_required) are nullable in the schema and mean "per-unit or per-year requirement depending on profile" — exact unit semantics are not enforced by the schema and should be treated as domain-level information owned by Supabase.
- `machine_resources.amount` and `unit` are nullable — absence should be handled gracefully by consumers.

Ownership and source
- Supabase (accessed via `SupabaseService`) is the canonical owner of machine and resource data. The Laravel API (`MachineController` and `ResourcesController`) proxies Supabase to the frontend.
- Frontend `resources/js/v2` is expected to request data via ApiCoordinator → DataLoader → backend API. At present ApiCoordinator is a placeholder; the Laravel controllers and `SupabaseService` demonstrate the real data shape.

Relationships (verified vs unconfirmed)
- Verified (by code):
  - `machines` joined to `machine_resources` and `machine_links` and `machine_technologies` in `SupabaseService::getMachine()` call. `machine_resources` are joined to `resources` in that same call.
- Unconfirmed (schema export does not show FK constraints):
  - Whether the database enforces FK constraints for `machine_resources.machine_id`, `machine_resources.resource_id`, `machine_technologies.technology_id` — the export lists column names but not explicit FK constraints. Supabase REST join usage implies relations exist but authoritative FK presence must be verified in the database schema.

Units and quantity bases
- Units and `quantity_basis` fields exist in several tables (`machine_resources.unit`, `machine_profiles.capacity_unit`, `resource_composition.unit`, etc.). The schema does not enforce a unit ontology; unit semantics (e.g., tonnes/year, m3, MJ) must be defined by data owners and documented separately.

Schema questions requiring a decision
- Q-001: Confirm authoritative unit system: what units and quantity bases should the frontend assume when performing calculations? (e.g., `amount` is per-cycle, per-year or absolute quantity?)
- Q-002: Confirm which relationships are guaranteed by FK constraints in the database (to allow safe server-side joins without defensive checks).
- Q-003: Confirm the canonical field for joined resource relations inside `machine_resources` — `SupabaseService` accepts either `resources` or `resource` returned names; standardise the REST select and document the consistent relation names used by Supabase.

Guidance for frontend implementers
- Do not duplicate machine or resource definitions in the frontend. Use the Laravel API endpoints that proxy Supabase and normalise responses as `SupabaseService::getMachine()` does.
- Treat missing numeric fields as nullable and implement fallbacks.
