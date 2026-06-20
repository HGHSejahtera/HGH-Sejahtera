-- Migration to increase Barcode length to accommodate GTIN-14 and longer barcodes
ALTER TABLE public."Products" ALTER COLUMN "Barcode" TYPE VARCHAR(50);
