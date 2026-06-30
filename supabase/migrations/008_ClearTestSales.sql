-- ==============================================================================
-- Migration: 008_ClearTestSales
-- Description: Truncates POSSales and ImportedOrders to clear test data,
-- returning the Dashboard Total Sales and Total Orders to RM 0.00.
-- ==============================================================================

-- Clear POS Sales (and its items via cascade)
TRUNCATE TABLE public."POSSales" CASCADE;

-- Clear Imported Agent Orders (and its items via cascade)
TRUNCATE TABLE public."ImportedOrders" CASCADE;
TRUNCATE TABLE public."OrderImports" CASCADE;

-- Clear Inventory Ledger to remove test stock movements (Optional but recommended)
-- Uncomment if you want to wipe test stock-ins as well
-- TRUNCATE TABLE public."InventoryLedger" CASCADE;
