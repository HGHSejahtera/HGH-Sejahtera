-- Migration 046: Fix Agent Monthly Settlement COGS & Override Support

-- Drop old 4-argument signature
DROP FUNCTION IF EXISTS public.close_agent_monthly_statement(UUID, INT, INT, DECIMAL);

-- Recreate function with p_total_cogs parameter
CREATE OR REPLACE FUNCTION public.close_agent_monthly_statement(
    p_agent_id UUID,
    p_month INT,
    p_year INT,
    p_total_payout DECIMAL(10,2),
    p_total_cogs DECIMAL(10,2) DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_total_cogs DECIMAL(10,2) := 0;
    v_net_profit DECIMAL(10,2) := 0;
    v_running_balance DECIMAL(10,2);
    v_month_name VARCHAR;
BEGIN
    -- If p_total_cogs is provided and >= 0, honor the manual/UI override.
    -- Otherwise, calculate Total COGS from ImportedOrders for the specified month and year.
    IF p_total_cogs IS NOT NULL AND p_total_cogs >= 0 THEN
        v_total_cogs := p_total_cogs;
    ELSE
        SELECT COALESCE(SUM(o."OrderAmount"), 0) INTO v_total_cogs
        FROM public."ImportedOrders" o
        JOIN public."OrderImports" i ON o."ImportID" = i."ImportID"
        WHERE i."AgentID" = p_agent_id 
          AND EXTRACT(MONTH FROM o."CreatedAt") = p_month
          AND EXTRACT(YEAR FROM o."CreatedAt") = p_year;
    END IF;

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

GRANT EXECUTE ON FUNCTION public.close_agent_monthly_statement(UUID, INT, INT, DECIMAL, DECIMAL) TO authenticated;
