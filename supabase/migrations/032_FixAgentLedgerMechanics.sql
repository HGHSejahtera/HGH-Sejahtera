-- Migration 032: Fix Agent Ledger Mechanics (Commission Wallet Model)

-- 1. Replace get_agent_summaries to return Commission instead of Debt/Limit
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
                SELECT l."RunningBalance"
                FROM public."AgentLedger" l
                WHERE l."AgentID" = u."UserID"
                ORDER BY l."CreatedAt" DESC
                LIMIT 1
            ), 0.00) AS "Commission"
        FROM public."Users" u
        WHERE u."Role" = 'Agent'
        ORDER BY u."DisplayName" ASC
    ) agent_data;

    RETURN COALESCE(result, '[]'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.get_agent_summaries() TO authenticated;


-- 2. Create record_agent_payout (replaces add_agent_manual_payment)
CREATE OR REPLACE FUNCTION public.record_agent_payout(p_agent_id UUID, p_amount DECIMAL(10,2), p_reference TEXT)
RETURNS JSONB AS $$
DECLARE
    v_user_role VARCHAR(20);
    v_running_balance DECIMAL(10,2);
BEGIN
    -- Authorization
    SELECT "Role" INTO v_user_role FROM public."Users" WHERE "UserID" = auth.uid();
    
    IF v_user_role NOT IN ('Founder', 'Manager', 'Staff') THEN
        RAISE EXCEPTION 'Unauthorized: Agents cannot record payouts.' USING ERRCODE = 'P0001';
    END IF;

    -- Ensure agent exists
    IF NOT EXISTS (SELECT 1 FROM public."Users" WHERE "UserID" = p_agent_id AND "Role" = 'Agent') THEN
        RAISE EXCEPTION 'Agent % not found', p_agent_id;
    END IF;

    -- Get current running balance (Commission Wallet)
    SELECT "RunningBalance" INTO v_running_balance
    FROM public."AgentLedger"
    WHERE "AgentID" = p_agent_id
    ORDER BY "CreatedAt" DESC LIMIT 1;
    
    IF v_running_balance IS NULL THEN
        v_running_balance := 0.00;
    END IF;

    -- A payout REDUCES the agent's commission wallet, so we SUBTRACT from running balance
    v_running_balance := v_running_balance - p_amount;

    INSERT INTO public."AgentLedger" (
        "AgentID", "EntryType", "Amount", "RunningBalance", "Description"
    ) VALUES (
        p_agent_id, 'Payout', -p_amount, v_running_balance, p_reference
    );

    RETURN jsonb_build_object('success', true, 'message', 'Payout recorded successfully');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.record_agent_payout(UUID, DECIMAL(10,2), TEXT) TO authenticated;

-- Drop the old manual payment function
DROP FUNCTION IF EXISTS public.add_agent_manual_payment(UUID, DECIMAL(10,2), TEXT);


-- 3. Replace process_pack_order to REMOVE AgentLedger charging
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

            -- Attempt to find Agent Price from Products / ProductPricing
            IF v_agent_price IS NULL THEN
                SELECT pp."AgentMarkup" INTO v_agent_price
                FROM public."Products" p
                JOIN public."ProductPricing" pp ON p."ProductID" = pp."ProductID"
                WHERE p."ProductID" = item."ProductID"
                LIMIT 1;
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

    -- 3. Just save the OrderAmount onto the ImportedOrders table for easy reference
    IF v_source = 'AgentOrder' AND v_agent_id IS NOT NULL AND v_total_order_charge > 0 THEN
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

GRANT EXECUTE ON FUNCTION public.process_pack_order(UUID) TO authenticated;
