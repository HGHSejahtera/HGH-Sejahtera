-- Migration 003: PricingRules & AgentPricingOverrides

CREATE TABLE public."PricingRules" (
    "PricingRuleID" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "ProductID" UUID REFERENCES public."Products"("ProductID") ON DELETE CASCADE,
    "Channel" VARCHAR(20) NOT NULL CHECK ("Channel" IN ('Retail', 'Wholesale', 'Online', 'Agent')),
    "FormulaType" VARCHAR(20) NOT NULL CHECK ("FormulaType" IN ('HQDiscount', 'CostPlus', 'FlashSale', 'AgentMarkup')),
    "HQBoxPrice" DECIMAL(10,2),
    "DiscountPercent" DECIMAL(5,2),
    "MarginPercent" DECIMAL(5,2),
    "ListedPrice" DECIMAL(10,2),
    "FlashSalePrice" DECIMAL(10,2),
    "PlatformFeePercent" DECIMAL(5,2),
    "AffiliateCommissionPercent" DECIMAL(5,2),
    "CalculatedSellingPrice" DECIMAL(10,2) NOT NULL,
    "CalculatedMargin" DECIMAL(10,2),
    "CreatedAt" TIMESTAMPTZ DEFAULT now(),
    UNIQUE("ProductID", "Channel")
);

CREATE TABLE public."AgentPricingOverrides" (
    "OverrideID" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "AgentID" UUID REFERENCES public."Users"("UserID") ON DELETE CASCADE,
    "ProductID" UUID REFERENCES public."Products"("ProductID") ON DELETE CASCADE,
    "OverridePrice" DECIMAL(10,2) NOT NULL,
    "Reason" TEXT,
    "CreatedBy" UUID REFERENCES public."Users"("UserID") ON DELETE SET NULL,
    "IsActive" BOOLEAN DEFAULT true,
    "CreatedAt" TIMESTAMPTZ DEFAULT now()
);

-- Unique partial index to ensure only 1 active override per agent per product
CREATE UNIQUE INDEX idx_unique_active_override ON public."AgentPricingOverrides" ("AgentID", "ProductID") WHERE "IsActive" = true;
