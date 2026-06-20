-- Migration 014: Add Developer to RLS Admin Policies

-- Drop existing admin policies to replace them
DROP POLICY IF EXISTS admin_all ON public."Users";
DROP POLICY IF EXISTS admin_all ON public."Products";
DROP POLICY IF EXISTS admin_all ON public."PricingRules";
DROP POLICY IF EXISTS admin_all ON public."AgentPricingOverrides";
DROP POLICY IF EXISTS admin_all ON public."StockBatches";
DROP POLICY IF EXISTS admin_all ON public."InventoryLedger";
DROP POLICY IF EXISTS admin_all ON public."POSSales";
DROP POLICY IF EXISTS admin_all ON public."POSSaleItems";
DROP POLICY IF EXISTS admin_all ON public."OrderImports";
DROP POLICY IF EXISTS admin_all ON public."ImportedOrders";
DROP POLICY IF EXISTS admin_all ON public."ImportedOrderItems";
DROP POLICY IF EXISTS admin_all ON public."AgentLedger";
DROP POLICY IF EXISTS admin_all ON public."AgentStatements";
DROP POLICY IF EXISTS admin_all ON public."Settings";

-- Recreate policies including Developer
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
