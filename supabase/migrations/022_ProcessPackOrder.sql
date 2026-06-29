-- Migration 022: Process Pack Order RPC

CREATE OR REPLACE FUNCTION public.process_pack_order(p_order_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID;
    v_platform_order_id VARCHAR(30);
    v_platform VARCHAR(20);
    v_status VARCHAR(20);
    item RECORD;
    v_current_stock INT;
    v_new_stock INT;
    v_log_id UUID;
BEGIN
    v_user_id := auth.uid();

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated' USING ERRCODE = 'P0001';
    END IF;

    -- 1. Fetch and lock the order
    SELECT "PlatformOrderID", "Platform", "OrderStatus"
    INTO v_platform_order_id, v_platform, v_status
    FROM public."ImportedOrders"
    WHERE "ImportedOrderID" = p_order_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order % not found', p_order_id;
    END IF;

    IF v_status = 'Packed' OR v_status = 'Shipped' THEN
        RAISE EXCEPTION 'Order is already %', v_status;
    END IF;

    -- 2. Process each matched item
    FOR item IN (
        SELECT "ProductID", "Quantity", "ProductName", "Variation"
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
            "ProductID",
            "Type",
            "Quantity",
            "StockBefore",
            "StockAfter",
            "Reference",
            "ProcessedBy"
        ) VALUES (
            item."ProductID",
            'OUT',
            item."Quantity",
            v_current_stock,
            v_new_stock,
            'PackOrder: ' || v_platform_order_id,
            v_user_id
        ) RETURNING "LogID" INTO v_log_id;

        -- 2d. Insert into InventoryLedger
        INSERT INTO public."InventoryLedger" (
            "ProductID",
            "MovementType",
            "Quantity",
            "Channel",
            "ReferenceID",
            "ReferenceType",
            "CreatedBy"
        ) VALUES (
            item."ProductID",
            'PackOrder',
            -item."Quantity",
            v_platform,
            v_log_id,
            'InventoryLogs',
            v_user_id
        );
    END LOOP;

    -- 3. Update the order status to Packed
    UPDATE public."ImportedOrders"
    SET 
        "OrderStatus" = 'Packed',
        "PackedAt" = now(),
        "PackedBy" = v_user_id
    WHERE "ImportedOrderID" = p_order_id;

    RETURN jsonb_build_object('success', true, 'message', 'Order packed successfully');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.process_pack_order(UUID) TO authenticated;
