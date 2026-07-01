-- Migration 031: Include StaffID in get_agent_summaries

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
            u."CreditLimit",
            u."IsActive",
            CASE WHEN u."IsActive" THEN 'Active' ELSE 'Suspended' END AS "Status",
            COALESCE((
                SELECT l."RunningBalance"
                FROM public."AgentLedger" l
                WHERE l."AgentID" = u."UserID"
                ORDER BY l."CreatedAt" DESC
                LIMIT 1
            ), 0.00) AS "TotalDebt"
        FROM public."Users" u
        WHERE u."Role" = 'Agent'
        ORDER BY u."DisplayName" ASC
    ) agent_data;

    RETURN COALESCE(result, '[]'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.get_agent_summaries() TO authenticated;
