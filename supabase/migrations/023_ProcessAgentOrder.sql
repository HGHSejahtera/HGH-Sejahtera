-- Migration 023: Agent Order Upload & Ledger Integration

-- 1. Create a secure RPC to handle bulk order uploads from agents
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
        v_total_orders := v_total_orders + 1;

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
            
            -- Attempt to auto-match ProductID by Barcode
            SELECT "ProductID" INTO v_product_id
            FROM public."Products"
            WHERE "Barcode" = v_item_json->>'Barcode'
            LIMIT 1;

            IF v_product_id IS NOT NULL THEN
                v_match_status := 'Matched';
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
                v_item_json->>'Barcode',
                v_item_json->>'ProductName',
                (v_item_json->>'Quantity')::INT,
                v_match_status
            );
        END LOOP;
    END LOOP;

    -- Update totals in parent
    UPDATE public."OrderImports"
    SET "TotalOrders" = v_total_orders,
        "TotalItems" = v_total_items
    WHERE "ImportID" = v_import_id;

    RETURN jsonb_build_object('success', true, 'import_id', v_import_id, 'total_orders', v_total_orders);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.process_agent_order_upload(JSONB) TO authenticated;


-- 2. Replace process_pack_order to include AgentLedger charging
CREATE OR REPLACE FUNCTION public.process_pack_order(p_order_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID;
    v_platform_order_id VARCHAR(30);
    v_platform VARCHAR(20);
    v_status VARCHAR(20);
    v_source VARCHAR(20);
    v_agent_id UUID;
    item RECORD;
    v_current_stock INT;
    v_new_stock INT;
    v_log_id UUID;
    v_agent_price DECIMAL(10,2);
    v_item_subtotal DECIMAL(10,2);
    v_total_order_charge DECIMAL(10,2) := 0;
    v_running_balance DECIMAL(10,2);
BEGIN
    v_user_id := auth.uid();

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated' USING ERRCODE = 'P0001';
    END IF;

    -- 1. Fetch and lock the order + source info
    SELECT o."PlatformOrderID", o."Platform", o."OrderStatus", i."Source", i."AgentID"
    INTO v_platform_order_id, v_platform, v_status, v_source, v_agent_id
    FROM public."ImportedOrders" o
    JOIN public."OrderImports" i ON o."ImportID" = i."ImportID"
    WHERE o."ImportedOrderID" = p_order_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order % not found', p_order_id;
    END IF;

    IF v_status = 'Packed' OR v_status = 'Shipped' THEN
        RAISE EXCEPTION 'Order is already %', v_status;
    END IF;

    -- 2. Process each matched item
    FOR item IN (
        SELECT "ProductID", "Quantity", "ProductName", "Variation", "ItemID"
        FROM public."ImportedOrderItems"
        WHERE "ImportedOrderID" = p_order_id
    )
    LOOP
        IF item."ProductID" IS NULL THEN
            RAISE EXCEPTION 'Cannot pack order: Item "% - %" is unmatched (No ProductID)', item."ProductName", item."Variation";
        END IF;

        -- 2a. Check and lock stock
        SELECT "Stock" INTO v_current_stock
        FROM public."Products"
        WHERE "ProductID" = item."ProductID"
        FOR UPDATE;

        IF v_current_stock IS NULL THEN
            RAISE EXCEPTION 'Product % not found in inventory', item."ProductID";
        END IF;

        IF v_current_stock < item."Quantity" THEN
            RAISE EXCEPTION 'Insufficient stock for product % (Available: %, Requested: %)', item."ProductID", v_current_stock, item."Quantity";
        END IF;

        v_new_stock := v_current_stock - item."Quantity";

        -- 2b. Update stock
        UPDATE public."Products"
        SET "Stock" = v_new_stock, "UpdatedAt" = now()
        WHERE "ProductID" = item."ProductID";

        -- 2c. Insert into InventoryLogs
        INSERT INTO public."InventoryLogs" (
            "ProductID", "Type", "Quantity", "StockBefore", "StockAfter", "Reference", "ProcessedBy"
        ) VALUES (
            item."ProductID", 'OUT', item."Quantity", v_current_stock, v_new_stock, 'PackOrder: ' || v_platform_order_id, v_user_id
        ) RETURNING "LogID" INTO v_log_id;

        -- 2d. Insert into InventoryLedger
        INSERT INTO public."InventoryLedger" (
            "ProductID", "MovementType", "Quantity", "Channel", "ReferenceID", "ReferenceType", "CreatedBy"
        ) VALUES (
            item."ProductID", 'PackOrder', -item."Quantity", v_platform, v_log_id, 'InventoryLogs', v_user_id
        );

        -- 2e. Calculate Agent Price if this is an AgentOrder
        IF v_source = 'AgentOrder' AND v_agent_id IS NOT NULL THEN
            -- Find specific agent override or fallback to standard Agent channel price
            SELECT "OverridePrice" INTO v_agent_price
            FROM public."AgentPricingOverrides"
            WHERE "AgentID" = v_agent_id AND "ProductID" = item."ProductID" AND "IsActive" = true;

            IF v_agent_price IS NULL THEN
                SELECT "CalculatedSellingPrice" INTO v_agent_price
                FROM public."PricingRules"
                WHERE "ProductID" = item."ProductID" AND "Channel" = 'Agent';
            END IF;

            IF v_agent_price IS NULL THEN
                RAISE EXCEPTION 'No Agent Price found for product %', item."ProductID";
            END IF;

            v_item_subtotal := v_agent_price * item."Quantity";
            v_total_order_charge := v_total_order_charge + v_item_subtotal;

            -- Update the ImportedOrderItem with the calculated price
            UPDATE public."ImportedOrderItems"
            SET "UnitPrice" = v_agent_price, "Subtotal" = v_item_subtotal
            WHERE "ItemID" = item."ItemID";
        END IF;

    END LOOP;

    -- 3. If AgentOrder, charge the AgentLedger
    IF v_source = 'AgentOrder' AND v_agent_id IS NOT NULL AND v_total_order_charge > 0 THEN
        -- Get current running balance
        SELECT "RunningBalance" INTO v_running_balance
        FROM public."AgentLedger"
        WHERE "AgentID" = v_agent_id
        ORDER BY "CreatedAt" DESC LIMIT 1;
        
        IF v_running_balance IS NULL THEN
            v_running_balance := 0;
        END IF;

        v_running_balance := v_running_balance + v_total_order_charge;

        INSERT INTO public."AgentLedger" (
            "AgentID", "ReferenceID", "EntryType", "Amount", "RunningBalance", "Description"
        ) VALUES (
            v_agent_id, p_order_id, 'Charge', v_total_order_charge, v_running_balance, 'Dropship Order: ' || v_platform_order_id
        );

        -- Also save the OrderAmount onto the ImportedOrders table for easy reference
        UPDATE public."ImportedOrders"
        SET "OrderAmount" = v_total_order_charge
        WHERE "ImportedOrderID" = p_order_id;
    END IF;

    -- 4. Update the order status to Packed
    UPDATE public."ImportedOrders"
    SET 
        "OrderStatus" = 'Packed',
        "PackedAt" = now(),
        "PackedBy" = v_user_id
    WHERE "ImportedOrderID" = p_order_id;

    RETURN jsonb_build_object('success', true, 'message', 'Order packed successfully', 'charge_amount', v_total_order_charge);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
