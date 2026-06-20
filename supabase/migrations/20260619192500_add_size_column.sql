-- Migration: Add Size column to Products table for 4-Tier Taxonomy
-- Allows separating Brand, Product, Variation, and Size.

ALTER TABLE public."Products"
ADD COLUMN IF NOT EXISTS "Size" VARCHAR(50);

-- Update the view to include Size
NOTIFY pgrst, 'reload schema';
