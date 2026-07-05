-- Migration 040: Fix Order CreatedAt and Filename Timestamps
-- Updates process_agent_order_upload to use the actual CreatedTime/CreatedAt from uploaded AWBs

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

            -- Attach AWB if provided or update CreatedAt
            IF v_order_json->>'AwbUrl' IS NOT NULL OR v_order_json->>'CreatedTime' IS NOT NULL OR v_order_json->>'CreatedAt' IS NOT NULL THEN
                UPDATE public."ImportedOrders"
                SET "AwbUrl" = COALESCE(v_order_json->>'AwbUrl', "AwbUrl"),
                    "CreatedAt" = COALESCE(v_created_at, "CreatedAt")
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

        -- Create Order with OrderAmount = 0
        INSERT INTO public."ImportedOrders" (
            "ImportID", "PlatformOrderID", "Platform", 
            "TrackingID", "AwbUrl", "OrderAmount", "CreatedAt"
        ) VALUES (
            v_import_id, v_order_json->>'OrderID', v_order_json->>'Platform',
            v_order_json->>'TrackingNumber', v_order_json->>'AwbUrl', 0.00, v_created_at
        ) RETURNING "ImportedOrderID" INTO v_order_id;

        FOR v_item_json IN SELECT * FROM jsonb_array_elements(v_order_json->'Items')
        LOOP
            v_total_items := v_total_items + 1;
            v_seller_sku := v_item_json->>'Barcode'; 
            v_quantity := (v_item_json->>'Quantity')::INT;
            
            -- Product Lookup & Naming Convention
            SELECT 
                "ProductID", 
                TRIM(REGEXP_REPLACE(CONCAT_WS(' ', "Brand", "ProductName", "Variation"), '\s+', ' ', 'g'))
            INTO v_product_id, v_clean_name
            FROM public."Products"
            WHERE "Barcode" = v_seller_sku LIMIT 1;

            IF v_product_id IS NOT NULL THEN
                v_match_status := 'Matched';
            ELSE
                v_match_status := 'Unmatched';
                v_clean_name := v_item_json->>'ProductName'; -- Fallback to raw TikTok name
            END IF;

            -- Insert Item with UnitPrice=0 and Subtotal=0
            INSERT INTO public."ImportedOrderItems" (
                "ImportedOrderID", "ProductID", "PlatformSKU", 
                "ProductName", "Quantity", "MatchStatus", "UnitPrice", "Subtotal"
            ) VALUES (
                v_order_id, v_product_id, v_seller_sku,
                v_clean_name, v_quantity, v_match_status,
                0.00, 0.00
            );
        END LOOP;
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.process_agent_order_upload(JSONB) TO authenticated;
