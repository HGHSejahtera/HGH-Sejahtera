-- ==============================================================================
-- Migration 044: Fix Agent Total Sales Calculation & Order Upload Pricing
-- Description:
-- 1. Updates get_agent_summaries() to dynamically compute TotalSales from item
--    subtotals or AgentMarkup when OrderAmount is 0.00.
-- 2. Backfills existing ImportedOrderItems and ImportedOrders where UnitPrice/OrderAmount is 0.
-- 3. Updates process_agent_order_upload to restore real pricing accumulation
--    using AgentPricingOverrides and ProductPricing.AgentMarkup.
-- ==============================================================================

-- 1. Update get_agent_summaries() to compute real sales even if OrderAmount is 0
CREATE OR REPLACE FUNCTION public.get_agent_summaries()
RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    SELECT jsonb_agg(agent_data)
    INTO result
    FROM (
        SELECT 
            u."UserID" AS "AgentID",
            u."StaffID",
            u."DisplayName" AS "Name",
            u."Email",
            u."IsActive",
            CASE WHEN u."IsActive" THEN 'Active' ELSE 'Suspended' END AS "Status",
            COALESCE((
                SELECT SUM(
                    CASE 
                        WHEN COALESCE(o."OrderAmount", 0) > 0 THEN o."OrderAmount"
                        ELSE (
                            SELECT COALESCE(SUM(
                                CASE 
                                    WHEN COALESCE(io."Subtotal", 0) > 0 THEN io."Subtotal"
                                    ELSE COALESCE(pp."AgentMarkup", p."Price", 0) * COALESCE(io."Quantity", 1)
                                END
                            ), 0.00)
                            FROM public."ImportedOrderItems" io
                            LEFT JOIN public."Products" p ON p."ProductID" = io."ProductID"
                            LEFT JOIN public."ProductPricing" pp ON pp."ProductID" = p."ProductID"
                            WHERE io."ImportedOrderID" = o."ImportedOrderID"
                        )
                    END
                )
                FROM public."ImportedOrders" o
                JOIN public."OrderImports" i ON o."ImportID" = i."ImportID"
                WHERE i."AgentID" = u."UserID"
            ), 0.00) AS "TotalSales"
        FROM public."Users" u
        WHERE u."Role" = 'Agent'
        ORDER BY u."DisplayName" ASC
    ) agent_data;

    RETURN COALESCE(result, '[]'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.get_agent_summaries() TO authenticated;


-- 2. Backfill existing 0.00 order items with real AgentMarkup or Price
UPDATE public."ImportedOrderItems" io
SET "UnitPrice" = COALESCE(pp."AgentMarkup", p."Price", 0),
    "Subtotal" = COALESCE(pp."AgentMarkup", p."Price", 0) * COALESCE(io."Quantity", 1)
FROM public."Products" p
JOIN public."ProductPricing" pp ON pp."ProductID" = p."ProductID"
WHERE io."ProductID" = p."ProductID" AND (io."Subtotal" IS NULL OR io."Subtotal" = 0);

-- 3. Backfill existing 0.00 order headers with the sum of their items
UPDATE public."ImportedOrders" o
SET "OrderAmount" = sub."CalcTotal"
FROM (
    SELECT "ImportedOrderID", SUM("Subtotal") AS "CalcTotal"
    FROM public."ImportedOrderItems"
    GROUP BY "ImportedOrderID"
) sub
WHERE o."ImportedOrderID" = sub."ImportedOrderID" AND (o."OrderAmount" IS NULL OR o."OrderAmount" = 0);


-- 4. Update process_agent_order_upload to restore price calculation on upload
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

        -- Create Order initially (we will update OrderAmount after items loop)
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.process_agent_order_upload(JSONB) TO authenticated;
