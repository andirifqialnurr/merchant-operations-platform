-- B2b2a: explicit dimensions, without inferring or rewriting legacy definitions.
CREATE TYPE "InventoryUnitDimension" AS ENUM ('MASS', 'VOLUME', 'COUNT', 'LENGTH', 'AREA');
ALTER TABLE "inventory_units" ADD COLUMN "dimension" "InventoryUnitDimension";

-- Nullable storage preserves existing unknown facts, not an implicit create default.
CREATE FUNCTION "inventory_unit_dimension_guard"() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.dimension IS NULL THEN
      RAISE EXCEPTION 'New inventory units require an explicit dimension'
        USING ERRCODE = '23514', CONSTRAINT = 'inventory_units_dimension_required_check';
    END IF;
  ELSIF NEW.dimension IS DISTINCT FROM OLD.dimension
    AND (OLD.dimension IS NOT NULL OR OLD.definition_locked) THEN
    RAISE EXCEPTION 'Inventory unit dimension is immutable'
      USING ERRCODE = '23514', CONSTRAINT = 'inventory_units_dimension_immutable_check';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public, pg_temp;

CREATE TRIGGER "inventory_units_dimension_guard"
  BEFORE INSERT OR UPDATE ON "inventory_units"
  FOR EACH ROW EXECUTE FUNCTION "inventory_unit_dimension_guard"();
-- Conversion writes remain a separate checkpoint: numeric validity alone does
-- not prove physical compatibility. No new conversion command is exposed here.
