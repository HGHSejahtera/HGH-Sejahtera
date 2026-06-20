-- Migration 005: POS

CREATE TABLE public."POSSales" (
    "SaleID" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "CustomerTier" VARCHAR(20) NOT NULL CHECK ("CustomerTier" IN ('Retail', 'Wholesale', 'Custom')),
    "PaymentMethod" VARCHAR(20) NOT NULL CHECK ("PaymentMethod" IN ('Cash', 'DuitNowQR')),
    "PaymentReference" VARCHAR(100),
    "AmountReceived" DECIMAL(10,2),
    "ChangeGiven" DECIMAL(10,2),
    "TotalAmount" DECIMAL(10,2) NOT NULL,
    "CustomerName" VARCHAR(100),
    "CustomerCompany" VARCHAR(200),
    "CustomerPhone" VARCHAR(20),
    "CreatedAt" TIMESTAMPTZ DEFAULT now(),
    "CreatedBy" UUID REFERENCES public."Users"("UserID") ON DELETE SET NULL
);

CREATE TABLE public."POSSaleItems" (
    "SaleItemID" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "SaleID" UUID REFERENCES public."POSSales"("SaleID") ON DELETE CASCADE,
    "ProductID" UUID REFERENCES public."Products"("ProductID") ON DELETE SET NULL,
    "Quantity" INT NOT NULL,
    "UnitPrice" DECIMAL(10,2) NOT NULL,
    "Subtotal" DECIMAL(10,2) NOT NULL,
    "IsPriceOverride" BOOLEAN DEFAULT false
);
