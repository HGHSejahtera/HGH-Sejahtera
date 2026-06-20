-- Migration 002: Products

CREATE TABLE public."Products" (
    "ProductID" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "ProductName" VARCHAR(255) NOT NULL,
    "Brand" VARCHAR(100),
    "Category" VARCHAR(100),
    "Variation" VARCHAR(100),
    "Barcode" VARCHAR(13) UNIQUE,
    "SellerSKU" VARCHAR(50) UNIQUE,
    "CostPrice" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "BaseUnit" VARCHAR(20) DEFAULT 'piece',
    "IsActive" BOOLEAN DEFAULT true,
    "CreatedAt" TIMESTAMPTZ DEFAULT now(),
    "UpdatedAt" TIMESTAMPTZ DEFAULT now()
);

CREATE TRIGGER update_products_updated_at
    BEFORE UPDATE ON public."Products"
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
