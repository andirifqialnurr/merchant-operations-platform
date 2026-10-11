-- Tax and service charge per outlet (M2-FT-09). The defaults keep the M1 rule
-- for every existing outlet: the menu price is the final price.
ALTER TABLE "outlets"
  ADD COLUMN "charges_included" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "tax_rate_bp" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "service_charge_rate_bp" INTEGER NOT NULL DEFAULT 0,
  ADD CONSTRAINT "outlets_charge_rates_check" CHECK (
    "tax_rate_bp" BETWEEN 0 AND 5000 AND "service_charge_rate_bp" BETWEEN 0 AND 5000
  );

-- What applied when the bill was made, so a receipt reads the same after the
-- outlet changes its rates. The amounts themselves were already on the bill.
ALTER TABLE "billing_bills"
  ADD COLUMN "charges_included" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "tax_rate_bp" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "service_charge_rate_bp" INTEGER NOT NULL DEFAULT 0,
  ADD CONSTRAINT "billing_bills_charge_rates_check" CHECK (
    "tax_rate_bp" BETWEEN 0 AND 5000 AND "service_charge_rate_bp" BETWEEN 0 AND 5000
  );
