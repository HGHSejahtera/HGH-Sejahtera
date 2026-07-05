-- Migration 038: Update Agent Summaries to show Total Sales instead of Commission

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
                SELECT SUM(o."OrderAmount")
                FROM public."ImportedOrders" o
                JOIN public."OrderImports" i ON o."ImportID" = i."ImportID"
                WHERE i."AgentID" = u."UserID"
            ), 0.00) AS "TotalSales"
        FROM public."Users" u
        WHERE u."Role" = 'Agent'
        ORDER BY u."DisplayName" ASC
    ) agent_data;

    RETURN COALESCE(result, '[]'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.get_agent_summaries() TO authenticated;
