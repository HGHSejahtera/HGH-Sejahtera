-- ==============================================================================
-- Migration 045: Order Print Queue & Walk-in Agent Direct Print Handling
-- Description:
-- 1. Adds "IsPrinted" and "PrintedAt" columns to "ImportedOrders".
-- 2. Creates RPC "mark_orders_as_printed" to batch update print status.
-- 3. Updates "process_agent_order_upload" to accept "SkipPrintQueue" parameter
--    to handle walk-in agent direct TikTok Shop printing scenarios.
-- ==============================================================================

BEGIN;

-- 1. Add IsPrinted and PrintedAt columns if they do not exist
ALTER TABLE public."ImportedOrders"
ADD COLUMN IF NOT EXISTS "IsPrinted" BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS "PrintedAt" TIMESTAMPTZ DEFAULT null;

COMMIT;

-- 2. Create RPC mark_orders_as_printed
CREATE OR REPLACE FUNCTION public.mark_orders_as_printed(p_order_ids UUID[], p_is_printed BOOLEAN)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE public."ImportedOrders"
    SET "IsPrinted" = p_is_printed,
        "PrintedAt" = CASE WHEN p_is_printed THEN NOW() ELSE NULL END
    WHERE "ImportedOrderID" = ANY(p_order_ids);
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.mark_orders_as_printed(UUID[], BOOLEAN) TO authenticated;


-- 3. Update process_agent_order_upload to support SkipPrintQueue
CREATE OR REPLACE FUNCTION public.process_agent_order_upload(payload JSONB)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID;
    v_import_id UUID;
    v_order_json JSONB;
    v_item_json JSONB;
    v_order_id UUID;
    v_product_id UUID;
    v_match_status VARCHAR(20);
    v_total_orders INT := 0;
    v_total_items INT := 0;
    v_seller_sku VARCHAR(50);
    v_quantity INT;
    v_existing_order UUID;
    v_skipped_orders INT := 0;
    v_awb_updated INT := 0;
    v_clean_name VARCHAR(255);
    v_created_at TIMESTAMPTZ;
    v_agent_price NUMERIC(10,2);
    v_order_total NUMERIC(10,2);
    v_skip_queue BOOLEAN := COALESCE((payload->>'SkipPrintQueue')::boolean, false);
BEGIN
    v_user_id := auth.uid();
    
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated' USING ERRCODE = 'P0001';
    END IF;

    INSERT INTO public."OrderImports" (
        "Platform", "Source", "FileType", "FileName", "AgentID", 
        "ImportStatus", "ImportedBy"
    ) VALUES (
        payload->>'Platform', 'AgentOrder', payload->>'FileType',
        payload->>'FileName', v_user_id, 'Completed', v_user_id
    ) RETURNING "ImportID" INTO v_import_id;

    FOR v_order_json IN SELECT * FROM jsonb_array_elements(payload->'OrderList')
    LOOP
        v_order_total := 0.00;

        -- Duplicate check
        SELECT o."ImportedOrderID" INTO v_existing_order
        FROM public."ImportedOrders" o
        JOIN public."OrderImports" i ON o."ImportID" = i."ImportID"
        WHERE o."PlatformOrderID" = v_order_json->>'OrderID'
          AND i."AgentID" = v_user_id
        LIMIT 1;

        IF v_existing_order IS NOT NULL THEN
            BEGIN
                v_created_at := COALESCE(NULLIF(v_order_json->>'CreatedTime', '')::TIMESTAMPTZ, NULLIF(v_order_json->>'CreatedAt', '')::TIMESTAMPTZ, NOW());
            EXCEPTION WHEN OTHERS THEN
                v_created_at := NOW();
            END;

            -- Attach AWB if provided, update CreatedAt, or apply SkipQueue if set
            IF v_order_json->>'AwbUrl' IS NOT NULL OR v_order_json->>'CreatedTime' IS NOT NULL OR v_order_json->>'CreatedAt' IS NOT NULL OR v_skip_queue THEN
                UPDATE public."ImportedOrders"
                SET "AwbUrl" = COALESCE(v_order_json->>'AwbUrl', "AwbUrl"),
                    "CreatedAt" = COALESCE(v_created_at, "CreatedAt"),
                    "IsPrinted" = CASE WHEN v_skip_queue THEN true ELSE "IsPrinted" END,
                    "PrintedAt" = CASE WHEN v_skip_queue AND "PrintedAt" IS NULL THEN NOW() ELSE "PrintedAt" END
                WHERE "ImportedOrderID" = v_existing_order;
                
                v_awb_updated := v_awb_updated + 1;
            END IF;

            v_skipped_orders := v_skipped_orders + 1;
            CONTINUE; 
        END IF;

        v_total_orders := v_total_orders + 1;

        BEGIN
            v_created_at := COALESCE(NULLIF(v_order_json->>'CreatedTime', '')::TIMESTAMPTZ, NULLIF(v_order_json->>'CreatedAt', '')::TIMESTAMPTZ, NOW());
        EXCEPTION WHEN OTHERS THEN
            v_created_at := NOW();
        END;

        -- Create Order initially (we will update OrderAmount after items loop)
        INSERT INTO public."ImportedOrders" (
            "ImportID", "PlatformOrderID", "Platform", 
            "TrackingID", "AwbUrl", "OrderAmount", "CreatedAt",
            "IsPrinted", "PrintedAt"
        ) VALUES (
            v_import_id, v_order_json->>'OrderID', v_order_json->>'Platform',
            v_order_json->>'TrackingNumber', v_order_json->>'AwbUrl', 0.00, v_created_at,
            v_skip_queue, CASE WHEN v_skip_queue THEN NOW() ELSE NULL END
        ) RETURNING "ImportedOrderID" INTO v_order_id;

        FOR v_item_json IN SELECT * FROM jsonb_array_elements(v_order_json->'Items')
        LOOP
            v_total_items := v_total_items + 1;
            v_seller_sku := v_item_json->>'Barcode'; 
            v_quantity := (v_item_json->>'Quantity')::INT;
            v_agent_price := 0.00;
            
            -- Product Lookup & Naming Convention
            SELECT 
                "ProductID", 
                TRIM(REGEXP_REPLACE(CONCAT_WS(' ', "Brand", "ProductName", "Variation"), '\s+', ' ', 'g'))
            INTO v_product_id, v_clean_name
            FROM public."Products"
            WHERE "Barcode" = v_seller_sku LIMIT 1;

            IF v_product_id IS NOT NULL THEN
                v_match_status := 'Matched';
                
                -- Look up OverridePrice first
                SELECT "OverridePrice" INTO v_agent_price
                FROM public."AgentPricingOverrides"
                WHERE "AgentID" = v_user_id AND "ProductID" = v_product_id AND "IsActive" = true
                LIMIT 1;

                -- Fallback to ProductPricing AgentMarkup
                IF v_agent_price IS NULL THEN
                    SELECT "AgentMarkup" INTO v_agent_price
                    FROM public."ProductPricing"
                    WHERE "ProductID" = v_product_id
                    LIMIT 1;
                END IF;

                v_order_total := v_order_total + (COALESCE(v_agent_price, 0) * v_quantity);
            ELSE
                v_match_status := 'Unmatched';
                v_clean_name := v_item_json->>'ProductName'; -- Fallback to raw TikTok name
                v_agent_price := 0.00;
            END IF;

            -- Insert Item with calculated UnitPrice and Subtotal
            INSERT INTO public."ImportedOrderItems" (
                "ImportedOrderID", "ProductID", "PlatformSKU", 
                "ProductName", "Quantity", "MatchStatus", "UnitPrice", "Subtotal"
            ) VALUES (
                v_order_id, v_product_id, v_seller_sku,
                v_clean_name, v_quantity, v_match_status,
                COALESCE(v_agent_price, 0), COALESCE(v_agent_price, 0) * v_quantity
            );
        END LOOP;

        -- Update the OrderAmount in ImportedOrders with calculated total
        UPDATE public."ImportedOrders"
        SET "OrderAmount" = v_order_total
        WHERE "ImportedOrderID" = v_order_id;

    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'total_orders', v_total_orders,
        'skipped_orders', v_skipped_orders,
        'awb_updated', v_awb_updated,
        'total_items', v_total_items,
        'import_id', v_import_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.process_agent_order_upload(JSONB) TO authenticated;
