-- Migration 020: Fix MasterSKU Constraint and Trigger

-- 1. Remove NOT NULL constraint so MasterSKU can be empty
ALTER TABLE public."Products" ALTER COLUMN "MasterSKU" DROP NOT NULL;

-- 2. Modify the trigger to STOP copying Barcode/SellerSKU to MasterSKU
CREATE OR REPLACE FUNCTION public.ensure_product_master_sku()
RETURNS TRIGGER AS $$
BEGIN
    -- We removed the auto-generate MasterSKU logic here.
    -- If user doesn't fill it, it stays NULL.

    NEW."PlatformData" = COALESCE(NEW."PlatformData", '{}'::jsonb);
    NEW."Stock" = COALESCE(NEW."Stock", 0);
    NEW."Price" = COALESCE(NEW."Price", 0);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Clear all incorrectly auto-generated MasterSKUs from old data
UPDATE public."Products"
SET "MasterSKU" = NULL
WHERE "MasterSKU" = "Barcode" OR "MasterSKU" = "SellerSKU";
