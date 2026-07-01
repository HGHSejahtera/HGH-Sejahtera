-- Migration 027: Agent TikTok Products & Commission Logic

-- 1. Create AgentTikTokProducts table
CREATE TABLE IF NOT EXISTS public."AgentTikTokProducts" (
    "AgentID" UUID NOT NULL REFERENCES public."Users"("UserID") ON DELETE CASCADE,
    "SellerSKU" TEXT NOT NULL,
    "SellingPrice" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "UpdatedAt" TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    PRIMARY KEY ("AgentID", "SellerSKU")
);

ALTER TABLE public."AgentTikTokProducts" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agents can view and manage their own TikTok products"
    ON public."AgentTikTokProducts"
    FOR ALL
    TO authenticated
    USING (auth.uid() = "AgentID")
    WITH CHECK (auth.uid() = "AgentID");

CREATE POLICY "Admins and Managers can view all TikTok products"
    ON public."AgentTikTokProducts"
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public."Users"
            WHERE "UserID" = auth.uid() AND "Role" IN ('Developer', 'Founder', 'Manager', 'Staff')
        )
    );

-- 2. Modify process_agent_order_upload to calculate commission instantly
CREATE OR REPLACE FUNCTION public.process_agent_order_upload(payload JSONB)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID;
    v_import_id UUID;
    v_order_json JSONB;
    v_item_json JSONB;
    v_order_id UUID;
    v_product_id UUID;
    v_agent_price DECIMAL(10,2);
    v_tiktok_price DECIMAL(10,2);
    v_profit DECIMAL(10,2);
    v_total_profit DECIMAL(10,2);
    v_quantity INT;
    v_seller_sku TEXT;
    v_match_status VARCHAR(20);
    v_total_orders INT := 0;
    v_total_items INT := 0;
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
            SELECT "ProductID", "AgentPrice" INTO v_product_id, v_agent_price
            FROM public."Products"
            WHERE "Barcode" = v_seller_sku
            LIMIT 1;

            IF v_product_id IS NOT NULL THEN
                v_match_status := 'Matched';
                
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
                "AgentID", "EntryType", "Amount", "RunningBalance", 
                "ReferenceID", "Description", "CreatedBy"
            ) VALUES (
                v_user_id,
                'Commission',
                v_total_profit, -- Credit (Positive)
                v_running_balance,
                v_order_json->>'OrderID',
                'Commission for AWB ' || (v_order_json->>'TrackingNumber'),
                v_user_id
            );
        END IF;

    END LOOP;

    -- Update totals in parent
    UPDATE public."OrderImports"
    SET "TotalOrders" = v_total_orders,
        "TotalItems" = v_total_items
    WHERE "ImportID" = v_import_id;

    RETURN jsonb_build_object('success', true, 'import_id', v_import_id, 'total_orders', v_total_orders);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- 3. Replace process_pack_order to REMOVE AgentLedger charging
DROP FUNCTION IF EXISTS public.process_pack_order(UUID);

CREATE OR REPLACE FUNCTION public.process_pack_order(p_order_id UUID)
RETURNS boolean AS $$
DECLARE
    v_user_id UUID;
    v_item RECORD;
    v_current_stock INT;
    v_agent_id UUID;
BEGIN
    v_user_id := auth.uid();
    
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated' USING ERRCODE = 'P0001';
    END IF;

    -- Verify order exists and is Pending
    SELECT "OrderImports"."AgentID" INTO v_agent_id
    FROM public."ImportedOrders"
    JOIN public."OrderImports" ON "ImportedOrders"."ImportID" = "OrderImports"."ImportID"
    WHERE "ImportedOrderID" = p_order_id AND "OrderStatus" = 'Pending';

    IF v_agent_id IS NULL THEN
        RAISE EXCEPTION 'Order not found or not in Pending status';
    END IF;

    -- Deduct Physical Stock ONLY
    FOR v_item IN 
        SELECT "ProductID", "Quantity" 
        FROM public."ImportedOrderItems" 
        WHERE "ImportedOrderID" = p_order_id AND "MatchStatus" = 'Matched'
    LOOP
        -- Check current stock
        SELECT "StockQuantity" INTO v_current_stock
        FROM public."Products"
        WHERE "ProductID" = v_item."ProductID";

        IF v_current_stock < v_item."Quantity" THEN
            RAISE EXCEPTION 'Insufficient stock for ProductID %', v_item."ProductID";
        END IF;

        -- Deduct stock
        UPDATE public."Products"
        SET "StockQuantity" = "StockQuantity" - v_item."Quantity",
            "UpdatedAt" = timezone('utc'::text, now())
        WHERE "ProductID" = v_item."ProductID";

        -- Record stock movement
        INSERT INTO public."StockMovements" (
            "ProductID", "MovementType", "Quantity", "ReferenceID", "Notes", "CreatedBy"
        ) VALUES (
            v_item."ProductID",
            'Out',
            v_item."Quantity",
            p_order_id::text,
            'Agent Order Packed',
            v_user_id
        );
    END LOOP;

    -- Update Order Status
    UPDATE public."ImportedOrders"
    SET "OrderStatus" = 'Shipped',
        "UpdatedAt" = timezone('utc'::text, now())
    WHERE "ImportedOrderID" = p_order_id;

    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- 4. Create RPC to Cancel Order and Void Commission
CREATE OR REPLACE FUNCTION public.cancel_agent_order(p_order_id UUID)
RETURNS boolean AS $$
DECLARE
    v_user_id UUID;
    v_agent_id UUID;
    v_status VARCHAR;
    v_commission_amount DECIMAL(10,2);
    v_platform_order_id TEXT;
    v_running_balance DECIMAL(10,2);
BEGIN
    v_user_id := auth.uid();
    
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated' USING ERRCODE = 'P0001';
    END IF;

    -- Check if user is the agent who owns it, or a manager
    SELECT o."AgentID", i."OrderStatus", i."PlatformOrderID"
    INTO v_agent_id, v_status, v_platform_order_id
    FROM public."ImportedOrders" i
    JOIN public."OrderImports" o ON i."ImportID" = o."ImportID"
    WHERE i."ImportedOrderID" = p_order_id;

    IF v_agent_id IS NULL THEN
        RAISE EXCEPTION 'Order not found';
    END IF;

    IF v_user_id != v_agent_id THEN
        -- Only allow if user is Developer/Founder/Manager/Staff
        IF NOT EXISTS (
            SELECT 1 FROM public."Users" 
            WHERE "UserID" = v_user_id AND "Role" IN ('Developer', 'Founder', 'Manager', 'Staff')
        ) THEN
            RAISE EXCEPTION 'Unauthorized to cancel this order';
        END IF;
    END IF;

    IF v_status = 'Cancelled' THEN
        RAISE EXCEPTION 'Order is already cancelled';
    END IF;

    -- Find if a commission was given for this order
    SELECT "Amount" INTO v_commission_amount
    FROM public."AgentLedger"
    WHERE "AgentID" = v_agent_id 
      AND "EntryType" = 'Commission' 
      AND "ReferenceID" = v_platform_order_id
    LIMIT 1;

    -- If there was a commission, we must void it
    IF v_commission_amount IS NOT NULL THEN
        -- Get current running balance
        SELECT COALESCE("RunningBalance", 0.00) INTO v_running_balance
        FROM public."AgentLedger"
        WHERE "AgentID" = v_agent_id
        ORDER BY "CreatedAt" DESC
        LIMIT 1;

        -- The void entry is a negative commission (Debit)
        v_running_balance := v_running_balance - v_commission_amount;

        INSERT INTO public."AgentLedger" (
            "AgentID", "EntryType", "Amount", "RunningBalance", 
            "ReferenceID", "Description", "CreatedBy"
        ) VALUES (
            v_agent_id,
            'Void',
            -v_commission_amount, -- Debit (Negative)
            v_running_balance,
            v_platform_order_id,
            'Commission Voided for Cancelled Order ' || v_platform_order_id,
            v_user_id
        );
    END IF;

    -- If order was Shipped, we need to return the physical stock!
    IF v_status = 'Shipped' THEN
        DECLARE
            v_item RECORD;
        BEGIN
            FOR v_item IN 
                SELECT "ProductID", "Quantity" 
                FROM public."ImportedOrderItems" 
                WHERE "ImportedOrderID" = p_order_id AND "MatchStatus" = 'Matched'
            LOOP
                -- Add stock back
                UPDATE public."Products"
                SET "StockQuantity" = "StockQuantity" + v_item."Quantity",
                    "UpdatedAt" = timezone('utc'::text, now())
                WHERE "ProductID" = v_item."ProductID";

                -- Record stock movement
                INSERT INTO public."StockMovements" (
                    "ProductID", "MovementType", "Quantity", "ReferenceID", "Notes", "CreatedBy"
                ) VALUES (
                    v_item."ProductID",
                    'In',
                    v_item."Quantity",
                    p_order_id::text,
                    'Agent Order Cancelled / Returned',
                    v_user_id
                );
            END LOOP;
        END;
    END IF;

    -- Update Order Status
    UPDATE public."ImportedOrders"
    SET "OrderStatus" = 'Cancelled',
        "UpdatedAt" = timezone('utc'::text, now())
    WHERE "ImportedOrderID" = p_order_id;

    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.cancel_agent_order(UUID) TO authenticated;
