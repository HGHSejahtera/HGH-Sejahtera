-- Migration 030: Fix process_agent_order_upload AgentPrice column lookup

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
    v_tiktok_price DECIMAL(10,2);
    v_agent_price DECIMAL(10,2);
    v_profit DECIMAL(10,2);
    v_total_profit DECIMAL(10,2);
    v_order_total DECIMAL(10,2);
    v_running_balance DECIMAL(10,2);
BEGIN
    v_user_id := auth.uid();
    
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated' USING ERRCODE = 'P0001';
    END IF;

    -- Get current running balance for ledger
    SELECT COALESCE("RunningBalance", 0.00) INTO v_running_balance
    FROM public."AgentLedger"
    WHERE "AgentID" = v_user_id
    ORDER BY "CreatedAt" DESC
    LIMIT 1;
    IF v_running_balance IS NULL THEN
        v_running_balance := 0.00;
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
        v_total_orders := v_total_orders + 1;
        v_total_profit := 0.00;
        v_order_total := 0.00;

        -- Insert ImportedOrders
        INSERT INTO public."ImportedOrders" (
            "ImportID", "PlatformOrderID", "Platform", 
            "OrderStatus", "TrackingID"
        ) VALUES (
            v_import_id,
            v_order_json->>'OrderID',
            v_order_json->>'Platform',
            'Pending',
            v_order_json->>'TrackingNumber'
        ) RETURNING "ImportedOrderID" INTO v_order_id;

        -- Loop through items
        FOR v_item_json IN SELECT * FROM jsonb_array_elements(v_order_json->'Items')
        LOOP
            v_total_items := v_total_items + 1;
            v_seller_sku := v_item_json->>'Barcode'; -- Parser puts SellerSKU in Barcode
            v_quantity := (v_item_json->>'Quantity')::INT;
            
            -- Attempt to auto-match ProductID by Barcode
            SELECT "ProductID" INTO v_product_id
            FROM public."Products"
            WHERE "Barcode" = v_seller_sku
            LIMIT 1;

            IF v_product_id IS NOT NULL THEN
                v_match_status := 'Matched';
                
                -- Attempt to find Agent Price from ProductPricing
                SELECT "AgentMarkup" INTO v_agent_price
                FROM public."ProductPricing"
                WHERE "ProductID" = v_product_id
                LIMIT 1;

                -- Attempt to find TikTok Selling Price
                SELECT "SellingPrice" INTO v_tiktok_price
                FROM public."AgentTikTokProducts"
                WHERE "AgentID" = v_user_id AND "SellerSKU" = v_seller_sku
                LIMIT 1;

                IF v_tiktok_price IS NOT NULL THEN
                    -- Calculate Profit for this item
                    v_profit := (v_tiktok_price - COALESCE(v_agent_price, 0)) * v_quantity;
                    v_total_profit := v_total_profit + v_profit;
                END IF;

                -- Accumulate the OrderAmount (amount Agent pays to HQ)
                v_order_total := v_order_total + (COALESCE(v_agent_price, 0) * v_quantity);

            ELSE
                v_match_status := 'Unmatched';
            END IF;

            -- Insert ImportedOrderItems
            INSERT INTO public."ImportedOrderItems" (
                "ImportedOrderID", "ProductID", "PlatformSKU", 
                "ProductName", "Quantity", "MatchStatus"
            ) VALUES (
                v_order_id,
                v_product_id,
                v_seller_sku,
                v_item_json->>'ProductName',
                v_quantity,
                v_match_status
            );
        END LOOP;

        -- If there is profit, insert to AgentLedger
        IF v_total_profit > 0 THEN
            v_running_balance := v_running_balance + v_total_profit;
            
            INSERT INTO public."AgentLedger" (
                "AgentID", "EntryType", "Amount", "RunningBalance", "Description", "ReferenceID"
            ) VALUES (
                v_user_id,
                'Commission',
                v_total_profit,
                v_running_balance,
                'TikTok Commission for ' || (v_order_json->>'OrderID'),
                v_order_id
            );
        END IF;

        -- Update the OrderAmount in ImportedOrders
        UPDATE public."ImportedOrders"
        SET "OrderAmount" = v_order_total
        WHERE "ImportedOrderID" = v_order_id;

    END LOOP;

    -- Update totals in parent
    UPDATE public."OrderImports"
    SET "TotalOrders" = v_total_orders,
        "TotalItems" = v_total_items
    WHERE "ImportID" = v_import_id;

    RETURN jsonb_build_object('success', true, 'import_id', v_import_id, 'total_orders', v_total_orders);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
