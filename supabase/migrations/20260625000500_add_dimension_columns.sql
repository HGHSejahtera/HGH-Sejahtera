-- Migration to add LengthCM, WidthCM, HeightCM to Products

ALTER TABLE "Products"
ADD COLUMN "LengthCM" numeric(10,2) DEFAULT 0,
ADD COLUMN "WidthCM" numeric(10,2) DEFAULT 0,
ADD COLUMN "HeightCM" numeric(10,2) DEFAULT 0;
