-- Migration 034: Monthly Agent Settlement

-- 1. Modify process_agent_order_upload to remove per-order profit & ledger logic
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

    RETURN jsonb_build_object('success', true, 'import_id', v_import_id, 'total_orders', v_total_orders);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. Create the Monthly Statement Close RPC
CREATE OR REPLACE FUNCTION public.close_agent_monthly_statement(
    p_agent_id UUID,
    p_month INT,
    p_year INT,
    p_total_payout DECIMAL(10,2)
)
RETURNS JSONB AS $$
DECLARE
    v_total_cogs DECIMAL(10,2) := 0;
    v_net_profit DECIMAL(10,2) := 0;
    v_running_balance DECIMAL(10,2);
    v_month_name VARCHAR;
BEGIN
    -- Calculate Total COGS for the specified month and year
    -- We use the ImportedOrders creation date.
    SELECT COALESCE(SUM(o."OrderAmount"), 0) INTO v_total_cogs
    FROM public."ImportedOrders" o
    JOIN public."OrderImports" i ON o."ImportID" = i."ImportID"
    WHERE i."AgentID" = p_agent_id 
      AND EXTRACT(MONTH FROM o."CreatedAt") = p_month
      AND EXTRACT(YEAR FROM o."CreatedAt") = p_year;

    -- Calculate Net Profit
    v_net_profit := p_total_payout - v_total_cogs;

    -- Get current running balance for ledger
    SELECT COALESCE("RunningBalance", 0.00) INTO v_running_balance
    FROM public."AgentLedger"
    WHERE "AgentID" = p_agent_id
    ORDER BY "CreatedAt" DESC
    LIMIT 1;

    -- Add the Net Profit to the agent's balance
    v_running_balance := v_running_balance + v_net_profit;

    -- Determine month name
    v_month_name := to_char(to_date(p_month::text, 'MM'), 'Month');

    -- Insert into AgentLedger
    INSERT INTO public."AgentLedger" (
        "AgentID", "EntryType", "Amount", "RunningBalance", "Description"
    ) VALUES (
        p_agent_id,
        'Commission',
        v_net_profit,
        v_running_balance,
        'Commission Settlement for ' || TRIM(v_month_name) || ' ' || p_year
    );

    RETURN jsonb_build_object(
        'success', true, 
        'total_cogs', v_total_cogs, 
        'total_payout', p_total_payout, 
        'net_profit', v_net_profit
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.close_agent_monthly_statement(UUID, INT, INT, DECIMAL) TO authenticated;
