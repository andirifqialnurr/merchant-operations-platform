-- B2b2b: enforce compatibility for new/changed definitions without rewriting history.
CREATE OR REPLACE FUNCTION "inventory_conversion_units_guard"() RETURNS trigger AS $$
DECLARE
  parent RECORD;
  parent_count INTEGER := 0;
  first_dimension "InventoryUnitDimension";
  compatible BOOLEAN := TRUE;
BEGIN
  -- Stable definitions and the same UUID lock order as the command writer,
  -- including concurrent explicitly defined reverse pairs.
  FOR parent IN
    SELECT id, dimension FROM inventory_units
    WHERE tenant_id = NEW.tenant_id AND id = ANY(ARRAY[NEW.from_unit_id, NEW.to_unit_id])
    ORDER BY id FOR NO KEY UPDATE
  LOOP
    parent_count := parent_count + 1;
    IF parent.dimension IS NULL OR (parent_count > 1 AND parent.dimension IS DISTINCT FROM first_dimension) THEN
      compatible := FALSE;
    END IF;
    IF parent_count = 1 THEN first_dimension := parent.dimension; END IF;
  END LOOP;
  -- Missing/cross-tenant parents and self-pairs are still refused by existing
  -- scoped FK/distinct checks. Unknown legacy is NEVER a compatible fallback.
  IF parent_count = 2 AND NOT compatible THEN
    RAISE EXCEPTION 'Inventory conversion requires equal known unit dimensions'
      USING ERRCODE = '23514', CONSTRAINT = 'inventory_unit_conversions_dimensions_check';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public, pg_temp;
-- Existing legacy rows remain unchanged/readable; their updates fail closed.
