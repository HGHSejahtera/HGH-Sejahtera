-- Migration: Add AwbUrl to ImportedOrders and Update RPC

-- 1. Add AwbUrl column to store the R2 path for the AWB PDF
ALTER TABLE "public"."ImportedOrders"
ADD COLUMN IF NOT EXISTS "AwbUrl" TEXT;

-- 2. Update process_agent_order_upload to insert AwbUrl and prevent duplicates
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
    v_agent_price DECIMAL(10,2);
    v_order_total DECIMAL(10,2);
    v_existing_order UUID;
    v_skipped_orders INT := 0;
    v_awb_updated INT := 0;
BEGIN
    v_user_id := auth.uid();
    
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated' USING ERRCODE = 'P0001';
    END IF;

    -- Create parent OrderImports record
    INSERT INTO public."OrderImports" (
        "Platform", "Source", "FileType", "FileName", "AgentID", 
        "ImportStatus", "ImportedBy"
    ) VALUES (
        payload->>'Platform',
        'AgentOrder',
        payload->>'FileType',
        payload->>'FileName',
        v_user_id,
        'Completed',
        v_user_id
    ) RETURNING "ImportID" INTO v_import_id;

    -- Loop through each order in the payload
    FOR v_order_json IN SELECT * FROM jsonb_array_elements(payload->'OrderList')
    LOOP
        -- Duplicate check: Ensure this PlatformOrderID does not already exist for this Agent
        SELECT o."ImportedOrderID" INTO v_existing_order
        FROM public."ImportedOrders" o
        JOIN public."OrderImports" i ON o."ImportID" = i."ImportID"
        WHERE o."PlatformOrderID" = v_order_json->>'OrderID'
          AND i."AgentID" = v_user_id
        LIMIT 1;

        IF v_existing_order IS NOT NULL THEN
            -- Re-upload logic: Attach AWB to the existing order if provided
            IF v_order_json->>'AwbUrl' IS NOT NULL THEN
                UPDATE public."ImportedOrders"
                SET "AwbUrl" = v_order_json->>'AwbUrl'
                WHERE "ImportedOrderID" = v_existing_order;
                
                v_awb_updated := v_awb_updated + 1;
            END IF;

            v_skipped_orders := v_skipped_orders + 1;
            CONTINUE; -- Skip this order
        END IF;

        v_total_orders := v_total_orders + 1;
        v_order_total := 0.00;

        -- Insert ImportedOrders with AwbUrl
        INSERT INTO public."ImportedOrders" (
            "ImportID", "PlatformOrderID", "Platform", 
            "OrderStatus", "TrackingID", "AwbUrl"
        ) VALUES (
            v_import_id,
            v_order_json->>'OrderID',
            v_order_json->>'Platform',
            'Pending',
            v_order_json->>'TrackingNumber',
            v_order_json->>'AwbUrl'
        ) RETURNING "ImportedOrderID" INTO v_order_id;

        -- Loop through items
        FOR v_item_json IN SELECT * FROM jsonb_array_elements(v_order_json->'Items')
        LOOP
            v_total_items := v_total_items + 1;
            v_seller_sku := v_item_json->>'Barcode'; -- Parser puts SellerSKU in Barcode
            v_quantity := (v_item_json->>'Quantity')::INT;
            v_agent_price := 0.00;
            
            -- Attempt to auto-match ProductID by Barcode
            SELECT "ProductID" INTO v_product_id
            FROM public."Products"
            WHERE "Barcode" = v_seller_sku
            LIMIT 1;

            IF v_product_id IS NOT NULL THEN
                v_match_status := 'Matched';
                
                -- Attempt to find Agent Price from AgentPricingOverrides first
                SELECT "OverridePrice" INTO v_agent_price
                FROM public."AgentPricingOverrides"
                WHERE "AgentID" = v_user_id AND "ProductID" = v_product_id AND "IsActive" = true
                LIMIT 1;

                -- Fallback to ProductPricing if no override exists
                IF v_agent_price IS NULL THEN
                    SELECT "AgentMarkup" INTO v_agent_price
                    FROM public."ProductPricing"
                    WHERE "ProductID" = v_product_id
                    LIMIT 1;
                END IF;

                -- Accumulate the OrderAmount (amount Agent pays to HQ)
                v_order_total := v_order_total + (COALESCE(v_agent_price, 0) * v_quantity);

            ELSE
                v_match_status := 'Unmatched';
            END IF;

            -- Insert ImportedOrderItems
            INSERT INTO public."ImportedOrderItems" (
                "ImportedOrderID", "ProductID", "PlatformSKU", 
                "ProductName", "Quantity", "MatchStatus", "UnitPrice", "Subtotal"
            ) VALUES (
                v_order_id,
                v_product_id,
                v_seller_sku,
                v_item_json->>'ProductName',
                v_quantity,
                v_match_status,
                v_agent_price,
                v_agent_price * v_quantity
            );
        END LOOP;

        -- Update the OrderAmount in ImportedOrders (This is the COGS)
        UPDATE public."ImportedOrders"
        SET "OrderAmount" = v_order_total
        WHERE "ImportedOrderID" = v_order_id;

    END LOOP;

    -- Update totals in parent
    UPDATE public."OrderImports"
    SET "TotalOrders" = v_total_orders,
        "TotalItems" = v_total_items
    WHERE "ImportID" = v_import_id;

    RETURN jsonb_build_object(
        'success', true, 
        'import_id', v_import_id, 
        'total_orders', v_total_orders,
        'skipped_orders', v_skipped_orders,
        'awb_updated', v_awb_updated
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
