BEGIN;

-- ===================================================================
-- PREFLIGHT: Show resource named "Farm Scraps" (do not modify it)
-- ===================================================================
-- Shows ID, name and any existing machine_resources rows referencing it.
SELECT id, name, stable_key FROM public.resources WHERE name ILIKE 'Farm Scraps' LIMIT 10;

SELECT mr.id, mr.machine_id, mr.resource_id, mr.direction, mr.amount, mr.unit, mr.quantity_basis, m.name AS machine_name
FROM public.machine_resources mr
LEFT JOIN public.machines m ON m.id = mr.machine_id
WHERE mr.resource_id IN (SELECT id FROM public.resources WHERE name ILIKE 'Farm Scraps');

-- ===================================================================
-- PREFLIGHT: Duplicate checks for new unique keys (abort if duplicates)
-- ===================================================================
-- resources.stable_key duplicates (non-null)
WITH dup_resources AS (
  SELECT stable_key, count(*) AS cnt
  FROM public.resources
  WHERE stable_key IS NOT NULL
  GROUP BY stable_key
  HAVING count(*) > 1
)
SELECT * FROM dup_resources;

-- machines.stable_key duplicates (non-null)
WITH dup_machines AS (
  SELECT stable_key, count(*) AS cnt
  FROM public.machines
  WHERE stable_key IS NOT NULL
  GROUP BY stable_key
  HAVING count(*) > 1
)
SELECT * FROM dup_machines;

-- machine_resources uniqueness duplicates using normalized quantity_basis (COALESCE)
WITH dup_mr AS (
  SELECT machine_id, resource_id, direction, COALESCE(quantity_basis,'') AS qb, count(*) AS cnt
  FROM public.machine_resources
  GROUP BY machine_id, resource_id, direction, COALESCE(quantity_basis,'')
  HAVING count(*) > 1
)
SELECT * FROM dup_mr;

-- If any of the above return rows with cnt>1, stop and resolve duplicates before proceeding.
-- The script below will raise explicit exceptions when duplicates would prevent safe index creation.

-- ===================================================================
-- ADD MISSING COLUMNS (non-destructive; IF NOT EXISTS)
-- NOTE: annual_available intentionally NOT added here (belongs to project/scenario data)
-- ===================================================================
ALTER TABLE public.resources
  ADD COLUMN IF NOT EXISTS stable_key text,
  ADD COLUMN IF NOT EXISTS physical_state text,
  ADD COLUMN IF NOT EXISTS data_status text,
  ADD COLUMN IF NOT EXISTS source_reference text,
  ADD COLUMN IF NOT EXISTS confidence numeric,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz;

ALTER TABLE public.machines
  ADD COLUMN IF NOT EXISTS stable_key text,
  ADD COLUMN IF NOT EXISTS annual_capacity numeric,
  ADD COLUMN IF NOT EXISTS capacity_unit text,
  ADD COLUMN IF NOT EXISTS default_operating_level numeric,
  ADD COLUMN IF NOT EXISTS data_status text,
  ADD COLUMN IF NOT EXISTS source_reference text,
  ADD COLUMN IF NOT EXISTS confidence numeric,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz;

ALTER TABLE public.machine_resources
  ADD COLUMN IF NOT EXISTS quantity_basis text,
  ADD COLUMN IF NOT EXISTS compatibility_metadata jsonb,
  ADD COLUMN IF NOT EXISTS data_status text,
  ADD COLUMN IF NOT EXISTS evidence_reference text,
  ADD COLUMN IF NOT EXISTS sort_order integer,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz;

-- ===================================================================
-- INFORMATIONAL COMMENTS (instead of rigid CHECK constraints)
-- ===================================================================
-- We intentionally avoid CHECK constraints for evolving vocabularies.
-- Use the comments below to document intended values and future refactor notes.

COMMENT ON COLUMN public.resources.physical_state IS
  'Intended vocabulary (informational): solid, liquid, gas, energy, heat, information, service. Consider creating a dedicated resource_states table in future to model evolving states.';

COMMENT ON COLUMN public.machines.annual_capacity IS
  'Machine nominal annual capacity (legacy single-profile). For multiple engineering profiles consider adding a machine_capacity_profiles table instead of hard-wiring capacities here.';

COMMENT ON COLUMN public.machine_resources.sort_order IS
  'Optional integer for UI ordering of machine resource inputs/outputs (lower numbers displayed first). NULL = unspecified.';

-- No CHECK constraints are created. This keeps schema flexible for future vocab changes.

-- ===================================================================
-- CREATE UNIQUE INDEXES (only if safe)
-- ===================================================================
-- resources.stable_key unique when not null
DO $$
BEGIN
  -- verify duplicates
  IF EXISTS (
    SELECT 1 FROM (
      SELECT stable_key, count(*) AS cnt
      FROM public.resources
      WHERE stable_key IS NOT NULL
      GROUP BY stable_key
      HAVING count(*) > 1
    ) t
  ) THEN
    RAISE EXCEPTION 'Duplicate non-null resources.stable_key values exist. Resolve duplicates before creating unique index.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'resources_stable_key_unique_idx') THEN
    CREATE UNIQUE INDEX resources_stable_key_unique_idx ON public.resources (stable_key) WHERE stable_key IS NOT NULL;
  END IF;
END$$;

-- machines.stable_key unique when not null
DO $$
BEGIN
  -- verify duplicates
  IF EXISTS (
    SELECT 1 FROM (
      SELECT stable_key, count(*) AS cnt
      FROM public.machines
      WHERE stable_key IS NOT NULL
      GROUP BY stable_key
      HAVING count(*) > 1
    ) t
  ) THEN
    RAISE EXCEPTION 'Duplicate non-null machines.stable_key values exist. Resolve duplicates before creating unique index.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'machines_stable_key_unique_idx') THEN
    CREATE UNIQUE INDEX machines_stable_key_unique_idx ON public.machines (stable_key) WHERE stable_key IS NOT NULL;
  END IF;
END$$;

-- machine_resources unique composite using normalized quantity_basis (COALESCE)
DO $$
BEGIN
  -- verify duplicates for normalized key
  IF EXISTS (
    SELECT 1 FROM (
      SELECT machine_id, resource_id, direction, COALESCE(quantity_basis,'') AS qb, count(*) AS cnt
      FROM public.machine_resources
      GROUP BY machine_id, resource_id, direction, COALESCE(quantity_basis,'')
      HAVING count(*) > 1
    ) t
  ) THEN
    RAISE EXCEPTION 'Duplicate normalized machine_resources rows exist (machine_id,resource_id,direction,COALESCE(quantity_basis,'''')). Resolve duplicates before creating unique index.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'machine_resources_unique_idx') THEN
    CREATE UNIQUE INDEX machine_resources_unique_idx
      ON public.machine_resources (machine_id, resource_id, direction, COALESCE(quantity_basis,''::text));
  END IF;
END$$;

-- ===================================================================
-- INSERT / UPSERT the seed rows (idempotent)
-- ===================================================================
-- 1) Upsert Resource: Farm Waste
-- Uses stable_key unique index for conflict target.
INSERT INTO public.resources (
  stable_key, name, physical_state, unit, data_status, source_reference, confidence, notes, updated_at
)
VALUES (
  'farm_waste',
  'Farm Waste',
  'solid',
  'tonnes',
  'placeholder',
  'seed:manual-farm-waste',
  NULL,
  'Placeholder resource row for demo. Annual availability is scenario-scoped and is not set here.',
  now()
)
ON CONFLICT (stable_key) DO UPDATE
  SET
    name = EXCLUDED.name,
    physical_state = EXCLUDED.physical_state,
    unit = EXCLUDED.unit,
    data_status = EXCLUDED.data_status,
    source_reference = EXCLUDED.source_reference,
    -- preserve existing confidence if already set, else use excluded
    confidence = COALESCE(EXCLUDED.confidence, public.resources.confidence),
    notes = COALESCE(EXCLUDED.notes, public.resources.notes),
    updated_at = now();

-- 2) Upsert Machine: Anaerobic Digester
INSERT INTO public.machines (
  stable_key, name, annual_capacity, capacity_unit, default_operating_level, data_status, source_reference, confidence, notes, updated_at, build_cost, maintenance_cost, power_required, water_required
)
VALUES (
  'anaerobic_digester',
  'Anaerobic Digester',
  40000,
  't/year',
  0.8,
  'placeholder',
  'seed:manual-anaerobic-digester',
  NULL,
  'Placeholder capacity for demo (annual capacity in input material units).',
  now(),
  NULL, NULL, NULL, NULL
)
ON CONFLICT (stable_key) DO UPDATE
  SET
    name = EXCLUDED.name,
    annual_capacity = EXCLUDED.annual_capacity,
    capacity_unit = EXCLUDED.capacity_unit,
    default_operating_level = EXCLUDED.default_operating_level,
    data_status = EXCLUDED.data_status,
    source_reference = EXCLUDED.source_reference,
    confidence = COALESCE(EXCLUDED.confidence, public.machines.confidence),
    notes = COALESCE(EXCLUDED.notes, public.machines.notes),
    updated_at = now();

-- 3) Upsert Relationship: Farm Waste -> Anaerobic Digester
-- This represents the process input ratio (1 t of Farm Waste per 1 t of machine input)
DO $$
DECLARE
  _mid INT;
  _rid INT;
BEGIN
  SELECT id INTO _rid FROM public.resources WHERE stable_key = 'farm_waste' LIMIT 1;
  SELECT id INTO _mid FROM public.machines WHERE stable_key = 'anaerobic_digester' LIMIT 1;

  IF _rid IS NULL THEN
    RAISE EXCEPTION 'Resource farm_waste not found; aborting machine_resources upsert.';
  END IF;
  IF _mid IS NULL THEN
    RAISE EXCEPTION 'Machine anaerobic_digester not found; aborting machine_resources upsert.';
  END IF;

  -- Update if an exact normalized match already exists (same normalized quantity_basis)
  UPDATE public.machine_resources
    SET amount = 1,
        unit = 't/t',
        quantity_basis = 'per_input',
        data_status = 'placeholder',
        evidence_reference = 'seed: farm_waste -> anaerobic_digester',
        sort_order = COALESCE(sort_order, 1),
        updated_at = now()
  WHERE machine_id = _mid
    AND resource_id = _rid
    AND direction = 'input'
    AND COALESCE(quantity_basis,'') = 'per_input';

  IF NOT FOUND THEN
    -- Insert new row (safe: unique index created above uses COALESCE(quantity_basis,''))
    INSERT INTO public.machine_resources (
      machine_id, resource_id, direction, amount, unit, quantity_basis, data_status, evidence_reference, sort_order, updated_at
    ) VALUES (
      _mid, _rid, 'input', 1, 't/t', 'per_input', 'placeholder', 'seed: farm_waste -> anaerobic_digester', 1, now()
    );
  END IF;
END$$;

-- ===================================================================
-- VERIFICATION SELECTS: show created/updated rows
-- ===================================================================
-- Show Farm Waste resource
SELECT id, stable_key, name, physical_state, unit, data_status, source_reference, confidence, notes, updated_at
FROM public.resources
WHERE stable_key = 'farm_waste';

-- Show Anaerobic Digester machine
SELECT id, stable_key, name, annual_capacity, capacity_unit, default_operating_level, data_status, source_reference, confidence, notes, updated_at, build_cost, maintenance_cost, power_required, water_required
FROM public.machines
WHERE stable_key = 'anaerobic_digester';

-- Show machine_resources linking them (normalized quantity_basis)
SELECT mr.id, mr.machine_id, mr.resource_id, mr.direction, mr.amount, mr.unit, mr.quantity_basis, mr.data_status, mr.evidence_reference, mr.sort_order, mr.updated_at
FROM public.machine_resources mr
WHERE mr.machine_id IN (SELECT id FROM public.machines WHERE stable_key = 'anaerobic_digester')
  AND mr.resource_id IN (SELECT id FROM public.resources WHERE stable_key = 'farm_waste');

COMMIT;
