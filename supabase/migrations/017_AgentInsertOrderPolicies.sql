-- Migration 017: Add Agent INSERT policies for ImportedOrders and ImportedOrderItems
-- Agents need to insert orders and items when submitting AWB

-- Agent can insert ImportedOrders if the parent OrderImport belongs to them
CREATE POLICY agent_insert_orders ON public."ImportedOrders" 
FOR INSERT 
WITH CHECK (
    get_user_role() = 'Agent' 
    AND "ImportID" IN (
        SELECT "ImportID" FROM public."OrderImports" WHERE "AgentID" = auth.uid()
    )
);

-- Agent can insert ImportedOrderItems if the parent ImportedOrder belongs to their import
CREATE POLICY agent_insert_orderitems ON public."ImportedOrderItems" 
FOR INSERT 
WITH CHECK (
    get_user_role() = 'Agent' 
    AND "ImportedOrderID" IN (
        SELECT "ImportedOrderID" FROM public."ImportedOrders" 
        WHERE "ImportID" IN (
            SELECT "ImportID" FROM public."OrderImports" WHERE "AgentID" = auth.uid()
        )
    )
);
