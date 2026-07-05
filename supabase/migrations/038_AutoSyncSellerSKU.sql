-- Migration 038: Auto-Sync Seller SKU and Remove Commission Logic from Product Matcher

-- Overwrite the resolve_unmatched_item RPC to remove all legacy commission logic
-- and implement the auto-sync of the Product's SellerSKU/Barcode into the AWB item.

CREATE OR REPLACE FUNCTION public.resolve_unmatched_item(
    p_item_id UUID,
    p_product_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_new_sku VARCHAR(50);
BEGIN
    -- Ensure the user is authenticated
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Not authenticated' USING ERRCODE = 'P0001';
    END IF;

    -- Verify item exists and is unmatched
    IF NOT EXISTS (
        SELECT 1 
        FROM public."ImportedOrderItems" 
        WHERE "ItemID" = p_item_id AND "MatchStatus" = 'Unmatched'
    ) THEN
        RAISE EXCEPTION 'Item not found or already matched' USING ERRCODE = 'P0002';
    END IF;

    -- Get the SellerSKU or Barcode from the mapped Product
    -- We prioritize SellerSKU, but fallback to Barcode if SellerSKU is empty
    SELECT 
        CASE 
            WHEN "SellerSKU" IS NOT NULL AND "SellerSKU" != '' THEN "SellerSKU"
            ELSE "Barcode"
        END INTO v_new_sku
    FROM public."Products"
    WHERE "ProductID" = p_product_id;

    -- Update the Item to Matched, link ProductID, and Sync PlatformSKU!
    -- We use COALESCE so if v_new_sku is null, we just keep the old PlatformSKU
    UPDATE public."ImportedOrderItems"
    SET "ProductID" = p_product_id,
        "MatchStatus" = 'ManualMatch',
        "PlatformSKU" = COALESCE(v_new_sku, "PlatformSKU")
    WHERE "ItemID" = p_item_id;

    RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
