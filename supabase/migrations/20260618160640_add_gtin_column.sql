-- Add GTIN column as Shopee reference
ALTER TABLE "Products" ADD COLUMN IF NOT EXISTS "GTIN" TEXT DEFAULT NULL;

-- Function to automatically sync Barcode to SellerSKU and GTIN
CREATE OR REPLACE FUNCTION sync_barcode_identifiers()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW."Barcode" IS NOT NULL AND NEW."Barcode" != '' THEN
        NEW."SellerSKU" = NEW."Barcode";
        NEW."GTIN" = NEW."Barcode";
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger on the Products table
DROP TRIGGER IF EXISTS auto_sync_barcode ON "Products";
CREATE TRIGGER auto_sync_barcode
    BEFORE INSERT OR UPDATE ON "Products"
    FOR EACH ROW
    EXECUTE FUNCTION sync_barcode_identifiers();

-- One-time backfill: Sync existing products that have Barcode but missing SellerSKU/GTIN
UPDATE "Products"
SET "SellerSKU" = "Barcode",
    "GTIN" = "Barcode"
WHERE "Barcode" IS NOT NULL 
  AND "Barcode" != ''
  AND ("GTIN" IS NULL OR "SellerSKU" IS NULL OR "SellerSKU" = '' OR "GTIN" = '');
