-- Migration 035: Clean False Commission Entries

DO $$
DECLARE
    v_agent_id UUID;
    v_entry RECORD;
    v_current_balance DECIMAL(10,2);
BEGIN
    -- 1. Delete all old incorrect commission entries
    -- This ONLY deletes EntryType = 'Commission'. 
    -- Payouts and Returns are kept. Orders in ImportedOrders are NOT touched.
    DELETE FROM public."AgentLedger" WHERE "EntryType" = 'Commission';

    -- 2. Recalculate running balance for all agents based on remaining entries
    FOR v_agent_id IN SELECT DISTINCT "AgentID" FROM public."AgentLedger"
    LOOP
        v_current_balance := 0.00;
        
        -- Loop through remaining entries for this agent chronologically
        FOR v_entry IN 
            SELECT "LedgerEntryID", "Amount" 
            FROM public."AgentLedger" 
            WHERE "AgentID" = v_agent_id 
            ORDER BY "CreatedAt" ASC
        LOOP
            v_current_balance := v_current_balance + v_entry."Amount";
            
            -- Update the RunningBalance for this specific row
            UPDATE public."AgentLedger"
            SET "RunningBalance" = v_current_balance
            WHERE "LedgerEntryID" = v_entry."LedgerEntryID";
        END LOOP;
    END LOOP;
END;
$$ LANGUAGE plpgsql;
