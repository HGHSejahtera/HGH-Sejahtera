-- Migration 033: Order Review RPCs and Upload Improvements

-- 1. Create the RPC to resolve unmatched items manually
CREATE OR REPLACE FUNCTION public.resolve_unmatched_item(
    p_item_id UUID,
    p_product_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_order_id UUID;
    v_import_id UUID;
    v_agent_id UUID;
    v_source VARCHAR;
    v_seller_sku VARCHAR;
    v_quantity INT;
    v_tiktok_price DECIMAL(10,2);
    v_agent_price DECIMAL(10,2);
    v_profit DECIMAL(10,2) := 0;
    v_running_balance DECIMAL(10,2);
BEGIN
    -- Ensure the user is authenticated (HQ only ideally, but we rely on RLS/App logic)
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Not authenticated' USING ERRCODE = 'P0001';
    END IF;

    -- Get the item details and parent order/import info
    SELECT 
        ioi."ImportedOrderID", ioi."PlatformSKU", ioi."Quantity",
        io."ImportID",
        oi."Source", oi."AgentID"
    INTO 
        v_order_id, v_seller_sku, v_quantity,
        v_import_id,
        v_source, v_agent_id
    FROM public."ImportedOrderItems" ioi
    JOIN public."ImportedOrders" io ON ioi."ImportedOrderID" = io."ImportedOrderID"
    JOIN public."OrderImports" oi ON io."ImportID" = oi."ImportID"
    WHERE ioi."ItemID" = p_item_id AND ioi."MatchStatus" = 'Unmatched';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Item not found or already matched' USING ERRCODE = 'P0002';
    END IF;

    -- Update the Item to Matched with the new ProductID
    UPDATE public."ImportedOrderItems"
    SET "ProductID" = p_product_id,
        "MatchStatus" = 'ManualMatch'
    WHERE "ItemID" = p_item_id;

    -- If this is an AgentOrder, we need to calculate Commission and Update OrderAmount
    IF v_source = 'AgentOrder' AND v_agent_id IS NOT NULL THEN
        
        -- Get Wholesale Price (AgentMarkup)
        SELECT "AgentMarkup" INTO v_agent_price
        FROM public."ProductPricing"
        WHERE "ProductID" = p_product_id
        LIMIT 1;

        -- Try to find TikTok Selling Price in AgentTikTokProducts mapping
        SELECT "SellingPrice" INTO v_tiktok_price
        FROM public."AgentTikTokProducts"
        WHERE "AgentID" = v_agent_id AND "ProductID" = p_product_id
        LIMIT 1;

        -- If the agent mapped it but we just didn't catch it on upload, we use that price.
        -- If it's a completely new manual match and Agent has no price set, we might default it 
        -- or leave profit at 0 if no selling price is found.
        IF v_tiktok_price IS NOT NULL AND v_agent_price IS NOT NULL THEN
            v_profit := (v_tiktok_price - v_agent_price) * v_quantity;
        END IF;

        -- Add to OrderAmount on the parent order (amount Agent owes HQ)
        IF v_agent_price IS NOT NULL THEN
            UPDATE public."ImportedOrders"
            SET "OrderAmount" = COALESCE("OrderAmount", 0) + (v_agent_price * v_quantity)
            WHERE "ImportedOrderID" = v_order_id;
        END IF;

        -- Add Profit to AgentLedger
        IF v_profit > 0 THEN
            -- Get latest balance
            SELECT COALESCE("RunningBalance", 0.00) INTO v_running_balance
            FROM public."AgentLedger"
            WHERE "AgentID" = v_agent_id
            ORDER BY "CreatedAt" DESC
            LIMIT 1;
            
            IF v_running_balance IS NULL THEN
                v_running_balance := 0.00;
            END IF;

            v_running_balance := v_running_balance + v_profit;

            -- Insert Ledger Entry
            INSERT INTO public."AgentLedger" (
                "AgentID", "EntryType", "Amount", "RunningBalance", "Description", "ReferenceID"
            ) VALUES (
                v_agent_id,
                'Commission',
                v_profit,
                v_running_balance,
                'TikTok Commission (Manual Match for Order)',
                v_order_id
            );
        END IF;
    END IF;

    RETURN jsonb_build_object('success', true, 'profit_added', v_profit);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. Update process_agent_order_upload to fallback to AgentTikTokProducts for ProductID matching
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
            v_product_id := NULL;
            
            -- Attempt to auto-match ProductID by Master Barcode
            SELECT "ProductID" INTO v_product_id
            FROM public."Products"
            WHERE "Barcode" = v_seller_sku
            LIMIT 1;

            -- FALLBACK: Check if Agent mapped this SKU in AgentTikTokProducts
            IF v_product_id IS NULL THEN
                SELECT "ProductID" INTO v_product_id
                FROM public."AgentTikTokProducts"
                WHERE "AgentID" = v_user_id AND "SellerSKU" = v_seller_sku
                LIMIT 1;
            END IF;

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

    RETURN jsonb_build_object(
        'success', true, 
        'importId', v_import_id,
        'ordersProcessed', v_total_orders,
        'itemsProcessed', v_total_items
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
