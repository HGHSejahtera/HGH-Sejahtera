-- Migration 025: Agent Management RPCs

-- 1. RPC to update an agent's credit limit
CREATE OR REPLACE FUNCTION public.update_agent_credit_limit(p_agent_id UUID, p_new_limit DECIMAL(10,2))
RETURNS JSONB AS $$
DECLARE
    v_user_role VARCHAR(20);
BEGIN
    -- Basic authorization (must be Founder or Manager to update credit limit)
    SELECT "Role" INTO v_user_role FROM public."Users" WHERE "UserID" = auth.uid();
    
    IF v_user_role NOT IN ('Founder', 'Manager') THEN
        RAISE EXCEPTION 'Unauthorized: Only Founders and Managers can update credit limits.' USING ERRCODE = 'P0001';
    END IF;

    UPDATE public."Users"
    SET "CreditLimit" = p_new_limit, "UpdatedAt" = now()
    WHERE "UserID" = p_agent_id AND "Role" = 'Agent';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Agent % not found', p_agent_id;
    END IF;

    RETURN jsonb_build_object('success', true, 'message', 'Credit limit updated successfully');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.update_agent_credit_limit(UUID, DECIMAL(10,2)) TO authenticated;


-- 2. RPC to add a manual payment (settlement) for an agent
CREATE OR REPLACE FUNCTION public.add_agent_manual_payment(p_agent_id UUID, p_amount DECIMAL(10,2), p_reference TEXT)
RETURNS JSONB AS $$
DECLARE
    v_user_role VARCHAR(20);
    v_running_balance DECIMAL(10,2);
BEGIN
    -- Authorization
    SELECT "Role" INTO v_user_role FROM public."Users" WHERE "UserID" = auth.uid();
    
    IF v_user_role NOT IN ('Founder', 'Manager', 'Staff') THEN
        RAISE EXCEPTION 'Unauthorized: Agents cannot add their own manual payments.' USING ERRCODE = 'P0001';
    END IF;

    -- Ensure agent exists
    IF NOT EXISTS (SELECT 1 FROM public."Users" WHERE "UserID" = p_agent_id AND "Role" = 'Agent') THEN
        RAISE EXCEPTION 'Agent % not found', p_agent_id;
    END IF;

    -- Get current running balance
    SELECT "RunningBalance" INTO v_running_balance
    FROM public."AgentLedger"
    WHERE "AgentID" = p_agent_id
    ORDER BY "CreatedAt" DESC LIMIT 1;
    
    IF v_running_balance IS NULL THEN
        v_running_balance := 0.00;
    END IF;

    -- A payment REDUCES the agent's debt, so we SUBTRACT from running balance
    -- And the Amount in Ledger is stored as NEGATIVE for settlements
    v_running_balance := v_running_balance - p_amount;

    INSERT INTO public."AgentLedger" (
        "AgentID", "EntryType", "Amount", "RunningBalance", "Description"
    ) VALUES (
        p_agent_id, 'Settlement', -p_amount, v_running_balance, p_reference
    );

    RETURN jsonb_build_object('success', true, 'message', 'Manual payment added successfully');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.add_agent_manual_payment(UUID, DECIMAL(10,2), TEXT) TO authenticated;
