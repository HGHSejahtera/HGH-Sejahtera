-- ==============================================================================
-- Migration 047: Complete Unmatched Item Resolution & OrderAmount Recalculation
-- Description:
-- Upgrades resolve_unmatched_item RPC to:
-- 1. Standardize ProductName to {Brand} {ProductName} {Variation} {Size}
-- 2. Sync PlatformSKU to Product's SellerSKU or Barcode
-- 3. Dynamically calculate UnitPrice & Subtotal using AgentPricingOverrides / ProductPricing
-- 4. Recalculate parent ImportedOrders.OrderAmount immediately so RM 0.00 is resolved
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.resolve_unmatched_item(
    p_item_id UUID,
    p_product_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_order_id UUID;
    v_agent_id UUID;
    v_new_sku VARCHAR(50);
    v_clean_name VARCHAR(255);
    v_unit_price NUMERIC(10,2);
    v_quantity INT;
    v_new_total NUMERIC(10,2);
BEGIN
    -- Ensure user is authenticated
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Not authenticated' USING ERRCODE = 'P0001';
    END IF;

    -- Get item details, order ID, quantity, and agent ID
    SELECT 
        io."ImportedOrderID",
        COALESCE(io."Quantity", 1),
        i."AgentID"
    INTO v_order_id, v_quantity, v_agent_id
    FROM public."ImportedOrderItems" io
    JOIN public."ImportedOrders" o ON o."ImportedOrderID" = io."ImportedOrderID"
    JOIN public."OrderImports" i ON i."ImportID" = o."ImportID"
    WHERE io."ItemID" = p_item_id AND io."MatchStatus" IN ('Unmatched', 'ManualMatch');

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Item not found or cannot be resolved' USING ERRCODE = 'P0002';
    END IF;

    -- 1. Look up standard Product Name and SKU/Barcode
    SELECT 
        TRIM(REGEXP_REPLACE(CONCAT_WS(' ', "Brand", "ProductName", "Variation", "Size"), '\s+', ' ', 'g')),
        CASE 
            WHEN "SellerSKU" IS NOT NULL AND "SellerSKU" != '' THEN "SellerSKU"
            ELSE "Barcode"
        END
    INTO v_clean_name, v_new_sku
    FROM public."Products"
    WHERE "ProductID" = p_product_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Product not found' USING ERRCODE = 'P0003';
    END IF;

    -- 2. Determine Agent Price / UnitPrice
    v_unit_price := NULL;

    IF v_agent_id IS NOT NULL THEN
        SELECT "OverridePrice" INTO v_unit_price
        FROM public."AgentPricingOverrides"
        WHERE "AgentID" = v_agent_id AND "ProductID" = p_product_id AND "IsActive" = true
        LIMIT 1;
    END IF;

    IF v_unit_price IS NULL THEN
        SELECT COALESCE(pp."AgentMarkup", p."Price", 0.00) INTO v_unit_price
        FROM public."Products" p
        LEFT JOIN public."ProductPricing" pp ON pp."ProductID" = p."ProductID"
        WHERE p."ProductID" = p_product_id;
    END IF;

    v_unit_price := COALESCE(v_unit_price, 0.00);

    -- 3. Update the item
    UPDATE public."ImportedOrderItems"
    SET "ProductID" = p_product_id,
        "MatchStatus" = 'ManualMatch',
        "PlatformSKU" = COALESCE(NULLIF(v_new_sku, ''), "PlatformSKU"),
        "ProductName" = COALESCE(NULLIF(v_clean_name, ''), "ProductName"),
        "UnitPrice" = v_unit_price,
        "Subtotal" = v_unit_price * v_quantity
    WHERE "ItemID" = p_item_id;

    -- 4. Recalculate parent OrderAmount
    SELECT COALESCE(SUM("Subtotal"), 0.00) INTO v_new_total
    FROM public."ImportedOrderItems"
    WHERE "ImportedOrderID" = v_order_id;

    UPDATE public."ImportedOrders"
    SET "OrderAmount" = v_new_total
    WHERE "ImportedOrderID" = v_order_id;

    RETURN jsonb_build_object(
        'success', true,
        'order_id', v_order_id,
        'item_id', p_item_id,
        'new_unit_price', v_unit_price,
        'new_subtotal', v_unit_price * v_quantity,
        'new_order_total', v_new_total,
        'clean_name', v_clean_name
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.resolve_unmatched_item(UUID, UUID) TO authenticated;
