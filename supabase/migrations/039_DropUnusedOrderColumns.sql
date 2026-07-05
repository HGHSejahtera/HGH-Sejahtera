-- Migration 039: Drop Unused Pick-Pack Columns
-- Fariz confirmed that the Pick-Pack functionality was dropped.
-- Therefore, OrderStatus, PackedAt, and PackedBy are fully obsolete.

BEGIN;

ALTER TABLE public."ImportedOrders"
DROP COLUMN IF EXISTS "OrderStatus",
DROP COLUMN IF EXISTS "PackedAt",
DROP COLUMN IF EXISTS "PackedBy";

COMMIT;
