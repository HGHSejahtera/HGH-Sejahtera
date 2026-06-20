-- Add ImageURL and MasterSKU to Products table
ALTER TABLE public."Products" 
ADD COLUMN IF NOT EXISTS "ImageURL" TEXT,
ADD COLUMN IF NOT EXISTS "MasterSKU" VARCHAR(100);
