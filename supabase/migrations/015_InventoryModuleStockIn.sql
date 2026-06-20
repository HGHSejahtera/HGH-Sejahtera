-- Migration 015: Inventory Module Stock-In Foundation
-- Adds Master SKU + platform JSONB fields and an atomic stock-in RPC.

ALTER TABLE public."Products"
    ADD COLUMN IF NOT EXISTS "MasterSKU" VARCHAR(80),
    ADD COLUMN IF NOT EXISTS "Stock" INT NOT NULL DEFAULT 0 CHECK ("Stock" >= 0),
    ADD COLUMN IF NOT EXISTS "Price" DECIMAL(10,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "ImageURL" TEXT,
    ADD COLUMN IF NOT EXISTS "WeightG" INT,
    ADD COLUMN IF NOT EXISTS "Dimensions" TEXT,
    ADD COLUMN IF NOT EXISTS "PlatformData" JSONB NOT NULL DEFAULT '{}'::jsonb;

UPDATE public."Products"
SET "MasterSKU" = COALESCE(
    NULLIF(btrim("MasterSKU"), ''),
    NULLIF(btrim("SellerSKU"), ''),
    NULLIF(btrim("Barcode"), ''),
    'SKU-' || substring("ProductID"::text, 1, 8)
)
WHERE "MasterSKU" IS NULL OR btrim("MasterSKU") = '';

ALTER TABLE public."Products"
    ALTER COLUMN "MasterSKU" SET NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'Products_MasterSKU_key'
    ) THEN
        ALTER TABLE public."Products"
            ADD CONSTRAINT "Products_MasterSKU_key" UNIQUE ("MasterSKU");
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_products_master_sku ON public."Products"("MasterSKU");
CREATE INDEX IF NOT EXISTS idx_products_platform_data ON public."Products" USING gin ("PlatformData");
CREATE INDEX IF NOT EXISTS idx_products_stock ON public."Products"("Stock");

CREATE OR REPLACE FUNCTION public.ensure_product_master_sku()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW."MasterSKU" IS NULL OR btrim(NEW."MasterSKU") = '' THEN
        NEW."MasterSKU" = COALESCE(
            NULLIF(btrim(NEW."SellerSKU"), ''),
            NULLIF(btrim(NEW."Barcode"), ''),
            'SKU-' || substring(NEW."ProductID"::text, 1, 8)
        );
    END IF;

    NEW."PlatformData" = COALESCE(NEW."PlatformData", '{}'::jsonb);
    NEW."Stock" = COALESCE(NEW."Stock", 0);
    NEW."Price" = COALESCE(NEW."Price", 0);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ensure_products_master_sku ON public."Products";
CREATE TRIGGER ensure_products_master_sku
    BEFORE INSERT OR UPDATE ON public."Products"
    FOR EACH ROW
    EXECUTE FUNCTION public.ensure_product_master_sku();

CREATE TABLE IF NOT EXISTS public."InventoryLogs" (
    "LogID" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "ProductID" UUID NOT NULL REFERENCES public."Products"("ProductID") ON DELETE CASCADE,
    "Type" VARCHAR(10) NOT NULL CHECK ("Type" IN ('IN', 'OUT')),
    "Quantity" INT NOT NULL CHECK ("Quantity" > 0),
    "StockBefore" INT NOT NULL DEFAULT 0,
    "StockAfter" INT NOT NULL DEFAULT 0,
    "Reference" TEXT,
    "Timestamp" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "ProcessedBy" UUID REFERENCES public."Users"("UserID") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_inventory_logs_product_id ON public."InventoryLogs"("ProductID");
CREATE INDEX IF NOT EXISTS idx_inventory_logs_timestamp ON public."InventoryLogs"("Timestamp" DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_logs_processed_by ON public."InventoryLogs"("ProcessedBy");

ALTER TABLE public."InventoryLogs" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_all ON public."InventoryLogs";
DROP POLICY IF EXISTS admin_select_inventory_logs ON public."InventoryLogs";
DROP POLICY IF EXISTS staff_select_inventory_logs ON public."InventoryLogs";
DROP POLICY IF EXISTS staff_insert_inventory_logs ON public."InventoryLogs";

CREATE POLICY admin_select_inventory_logs ON public."InventoryLogs"
    FOR SELECT
    USING (get_user_role() IN ('Founder', 'Manager', 'Developer'))
;

CREATE POLICY staff_select_inventory_logs ON public."InventoryLogs"
    FOR SELECT
    USING (get_user_role() = 'Staff');

CREATE OR REPLACE FUNCTION public.stock_in_product(
    product_id_input UUID,
    quantity_input INT,
    reference_input TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    user_role VARCHAR;
    stock_before INT;
    stock_after INT;
    created_log public."InventoryLogs"%ROWTYPE;
BEGIN
    user_role := public.get_user_role();

    IF user_role NOT IN ('Founder', 'Manager', 'Developer', 'Staff') THEN
        RAISE EXCEPTION 'Not allowed to process stock-in'
            USING ERRCODE = '42501';
    END IF;

    IF product_id_input IS NULL THEN
        RAISE EXCEPTION 'ProductID is required'
            USING ERRCODE = '23502';
    END IF;

    IF quantity_input IS NULL OR quantity_input <= 0 THEN
        RAISE EXCEPTION 'Quantity must be greater than zero'
            USING ERRCODE = '22023';
    END IF;

    SELECT "Stock"
    INTO stock_before
    FROM public."Products"
    WHERE "ProductID" = product_id_input
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Product not found'
            USING ERRCODE = 'P0002';
    END IF;

    stock_after := stock_before + quantity_input;

    UPDATE public."Products"
    SET
        "Stock" = stock_after,
        "UpdatedAt" = now()
    WHERE "ProductID" = product_id_input;

    INSERT INTO public."InventoryLogs" (
        "ProductID",
        "Type",
        "Quantity",
        "StockBefore",
        "StockAfter",
        "Reference",
        "ProcessedBy"
    )
    VALUES (
        product_id_input,
        'IN',
        quantity_input,
        stock_before,
        stock_after,
        NULLIF(btrim(reference_input), ''),
        auth.uid()
    )
    RETURNING * INTO created_log;

    INSERT INTO public."InventoryLedger" (
        "ProductID",
        "MovementType",
        "Quantity",
        "Channel",
        "ReferenceID",
        "ReferenceType",
        "CreatedBy"
    )
    VALUES (
        product_id_input,
        'StockIn',
        quantity_input,
        'Inventory',
        created_log."LogID",
        'InventoryLogs',
        auth.uid()
    );

    RETURN to_jsonb(created_log);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.stock_in_product(UUID, INT, TEXT) TO authenticated;
