-- Migration 009: RLS Policies

-- Enable RLS on all tables
ALTER TABLE public."Users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Products" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."PricingRules" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."AgentPricingOverrides" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."StockBatches" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."InventoryLedger" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."POSSales" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."POSSaleItems" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."OrderImports" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ImportedOrders" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ImportedOrderItems" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."AgentLedger" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."AgentStatements" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Settings" ENABLE ROW LEVEL SECURITY;

-- Helper function to get current user's role
-- Assuming we use Supabase Auth and inject role into JWT, or we lookup from Users table
-- For simplicity, let's assume we lookup from Users based on auth.uid()
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS VARCHAR AS $$
  SELECT "Role" FROM public."Users" WHERE "UserID" = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- 1. Admins (Founder, Manager, Developer) have full access to everything
CREATE POLICY admin_all ON public."Users" FOR ALL USING (get_user_role() IN ('Founder', 'Manager', 'Developer'));
CREATE POLICY admin_all ON public."Products" FOR ALL USING (get_user_role() IN ('Founder', 'Manager', 'Developer'));
CREATE POLICY admin_all ON public."PricingRules" FOR ALL USING (get_user_role() IN ('Founder', 'Manager', 'Developer'));
CREATE POLICY admin_all ON public."AgentPricingOverrides" FOR ALL USING (get_user_role() IN ('Founder', 'Manager', 'Developer'));
CREATE POLICY admin_all ON public."StockBatches" FOR ALL USING (get_user_role() IN ('Founder', 'Manager', 'Developer'));
CREATE POLICY admin_all ON public."InventoryLedger" FOR ALL USING (get_user_role() IN ('Founder', 'Manager', 'Developer'));
CREATE POLICY admin_all ON public."POSSales" FOR ALL USING (get_user_role() IN ('Founder', 'Manager', 'Developer'));
CREATE POLICY admin_all ON public."POSSaleItems" FOR ALL USING (get_user_role() IN ('Founder', 'Manager', 'Developer'));
CREATE POLICY admin_all ON public."OrderImports" FOR ALL USING (get_user_role() IN ('Founder', 'Manager', 'Developer'));
CREATE POLICY admin_all ON public."ImportedOrders" FOR ALL USING (get_user_role() IN ('Founder', 'Manager', 'Developer'));
CREATE POLICY admin_all ON public."ImportedOrderItems" FOR ALL USING (get_user_role() IN ('Founder', 'Manager', 'Developer'));
CREATE POLICY admin_all ON public."AgentLedger" FOR ALL USING (get_user_role() IN ('Founder', 'Manager', 'Developer'));
CREATE POLICY admin_all ON public."AgentStatements" FOR ALL USING (get_user_role() IN ('Founder', 'Manager', 'Developer'));
CREATE POLICY admin_all ON public."Settings" FOR ALL USING (get_user_role() IN ('Founder', 'Manager', 'Developer'));

-- 2. Staff policies
-- Staff can view products, insert/select POS, stock batches, inventory, and pick list (OrderImports/Orders)
CREATE POLICY staff_select_products ON public."Products" FOR SELECT USING (get_user_role() = 'Staff');

CREATE POLICY staff_insert_pos ON public."POSSales" FOR INSERT WITH CHECK (get_user_role() = 'Staff');
CREATE POLICY staff_select_pos ON public."POSSales" FOR SELECT USING (get_user_role() = 'Staff');
CREATE POLICY staff_insert_positems ON public."POSSaleItems" FOR INSERT WITH CHECK (get_user_role() = 'Staff');
CREATE POLICY staff_select_positems ON public."POSSaleItems" FOR SELECT USING (get_user_role() = 'Staff');

CREATE POLICY staff_insert_stock ON public."StockBatches" FOR INSERT WITH CHECK (get_user_role() = 'Staff');
CREATE POLICY staff_select_stock ON public."StockBatches" FOR SELECT USING (get_user_role() = 'Staff');

CREATE POLICY staff_insert_ledger ON public."InventoryLedger" FOR INSERT WITH CHECK (get_user_role() = 'Staff');
CREATE POLICY staff_select_ledger ON public."InventoryLedger" FOR SELECT USING (get_user_role() = 'Staff');

CREATE POLICY staff_select_imports ON public."OrderImports" FOR SELECT USING (get_user_role() = 'Staff');
CREATE POLICY staff_select_orders ON public."ImportedOrders" FOR SELECT USING (get_user_role() = 'Staff');
CREATE POLICY staff_update_orders ON public."ImportedOrders" FOR UPDATE USING (get_user_role() = 'Staff'); -- For marking as packed
CREATE POLICY staff_select_orderitems ON public."ImportedOrderItems" FOR SELECT USING (get_user_role() = 'Staff');

-- 3. Agent policies
-- Agents can view products, and their own orders, ledger, statements, and overrides
CREATE POLICY agent_select_products ON public."Products" FOR SELECT USING (get_user_role() = 'Agent');

-- Agents can only insert/select their own OrderImports
CREATE POLICY agent_insert_imports ON public."OrderImports" FOR INSERT WITH CHECK (get_user_role() = 'Agent' AND "AgentID" = auth.uid());
CREATE POLICY agent_select_imports ON public."OrderImports" FOR SELECT USING (get_user_role() = 'Agent' AND "AgentID" = auth.uid());

-- Agents can only select ImportedOrders if it belongs to their Import
CREATE POLICY agent_select_orders ON public."ImportedOrders" FOR SELECT USING (
    get_user_role() = 'Agent' AND "ImportID" IN (SELECT "ImportID" FROM public."OrderImports" WHERE "AgentID" = auth.uid())
);

-- Agents can only select ImportedOrderItems if it belongs to their orders
CREATE POLICY agent_select_orderitems ON public."ImportedOrderItems" FOR SELECT USING (
    get_user_role() = 'Agent' AND "ImportedOrderID" IN (
        SELECT "ImportedOrderID" FROM public."ImportedOrders" WHERE "ImportID" IN (
            SELECT "ImportID" FROM public."OrderImports" WHERE "AgentID" = auth.uid()
        )
    )
);

CREATE POLICY agent_select_ledger ON public."AgentLedger" FOR SELECT USING (get_user_role() = 'Agent' AND "AgentID" = auth.uid());
CREATE POLICY agent_select_statements ON public."AgentStatements" FOR SELECT USING (get_user_role() = 'Agent' AND "AgentID" = auth.uid());
CREATE POLICY agent_select_overrides ON public."AgentPricingOverrides" FOR SELECT USING (get_user_role() = 'Agent' AND "AgentID" = auth.uid());
