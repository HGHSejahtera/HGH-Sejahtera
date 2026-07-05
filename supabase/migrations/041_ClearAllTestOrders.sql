-- ==============================================================================
-- Migration 041: Clear All Test Orders, Sales & Ledger Data
-- Description: Truncates all order imports, imported orders, order items,
-- POS sales, agent ledger entries, and agent statements to return all dashboard
-- metrics and agent balances to a clean starting state (RM 0.00 / 0 Orders).
-- ==============================================================================

-- 1. Clear all Imported Agent Orders & Parent Imports (cascades to ImportedOrderItems)
TRUNCATE TABLE public."ImportedOrders" CASCADE;
TRUNCATE TABLE public."OrderImports" CASCADE;

-- 2. Clear all POS Sales (cascades to POSSaleItems)
TRUNCATE TABLE public."POSSales" CASCADE;

-- 3. Clear Agent Ledger & Statements (resets all Agent Running Balances to RM 0.00)
TRUNCATE TABLE public."AgentLedger" CASCADE;
TRUNCATE TABLE public."AgentStatements" CASCADE;

-- 4. (Optional) Uncomment line below if you also want to wipe test stock-in movements:
-- TRUNCATE TABLE public."InventoryLedger" CASCADE;
