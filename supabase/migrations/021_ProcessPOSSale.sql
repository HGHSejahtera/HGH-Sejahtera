-- Migration 021: Process POS Sale RPC

CREATE OR REPLACE FUNCTION public.process_pos_sale(sale_data JSONB)
RETURNS JSONB AS $$
DECLARE
    user_id UUID;
    new_sale_id UUID;
    item JSONB;
    current_stock INT;
    prod_id UUID;
    qty INT;
    new_stock INT;
    created_log_id UUID;
BEGIN
    user_id := auth.uid();

    IF user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated' USING ERRCODE = 'P0001';
    END IF;

    -- 1. Insert into POSSales
    INSERT INTO public."POSSales" (
        "CustomerTier",
        "PaymentMethod",
        "PaymentReference",
        "AmountReceived",
        "ChangeGiven",
        "TotalAmount",
        "CustomerName",
        "CustomerCompany",
        "CustomerPhone",
        "CreatedBy"
    ) VALUES (
        sale_data->>'CustomerTier',
        sale_data->>'PaymentMethod',
        NULLIF(sale_data->>'PaymentReference', ''),
        (sale_data->>'AmountReceived')::DECIMAL,
        (sale_data->>'ChangeGiven')::DECIMAL,
        (sale_data->>'TotalAmount')::DECIMAL,
        NULLIF(sale_data->>'CustomerName', ''),
        NULLIF(sale_data->>'CustomerCompany', ''),
        NULLIF(sale_data->>'CustomerPhone', ''),
        user_id
    ) RETURNING "SaleID" INTO new_sale_id;

    -- 2. Process each item
    FOR item IN SELECT * FROM jsonb_array_elements(sale_data->'Items')
    LOOP
        prod_id := (item->>'ProductID')::UUID;
        qty := (item->>'Quantity')::INT;

        -- 2a. Check and lock stock
        SELECT "Stock" INTO current_stock
        FROM public."Products"
        WHERE "ProductID" = prod_id
        FOR UPDATE;

        IF current_stock IS NULL THEN
            RAISE EXCEPTION 'Product % not found', prod_id;
        END IF;

        IF current_stock < qty THEN
            RAISE EXCEPTION 'Insufficient stock for product % (Available: %, Requested: %)', prod_id, current_stock, qty;
        END IF;

        new_stock := current_stock - qty;

        -- 2b. Update stock
        UPDATE public."Products"
        SET "Stock" = new_stock, "UpdatedAt" = now()
        WHERE "ProductID" = prod_id;

        -- 2c. Insert into POSSaleItems
        INSERT INTO public."POSSaleItems" (
            "SaleID",
            "ProductID",
            "Quantity",
            "UnitPrice",
            "Subtotal",
            "IsPriceOverride"
        ) VALUES (
            new_sale_id,
            prod_id,
            qty,
            (item->>'UnitPrice')::DECIMAL,
            (item->>'Subtotal')::DECIMAL,
            COALESCE((item->>'IsPriceOverride')::BOOLEAN, false)
        );

        -- 2d. Insert into InventoryLogs
        INSERT INTO public."InventoryLogs" (
            "ProductID",
            "Type",
            "Quantity",
            "StockBefore",
            "StockAfter",
            "Reference",
            "ProcessedBy"
        ) VALUES (
            prod_id,
            'OUT',
            qty,
            current_stock,
            new_stock,
            'POS Sale: ' || new_sale_id::text,
            user_id
        ) RETURNING "LogID" INTO created_log_id;

        -- 2e. Insert into InventoryLedger
        INSERT INTO public."InventoryLedger" (
            "ProductID",
            "MovementType",
            "Quantity",
            "Channel",
            "ReferenceID",
            "ReferenceType",
            "CreatedBy"
        ) VALUES (
            prod_id,
            'POSSale',
            -qty,
            'POS',
            created_log_id,
            'InventoryLogs',
            user_id
        );
    END LOOP;

    RETURN jsonb_build_object('success', true, 'SaleID', new_sale_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.process_pos_sale(JSONB) TO authenticated;
