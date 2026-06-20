-- Migration 006: Order Imports (Unified Direct & Agent)

CREATE TABLE public."OrderImports" (
    "ImportID" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "Platform" VARCHAR(20) NOT NULL CHECK ("Platform" IN ('TikTok', 'Shopee')),
    "Source" VARCHAR(20) NOT NULL CHECK ("Source" IN ('DirectSale', 'AgentOrder')),
    "AccountName" VARCHAR(100),
    "FileType" VARCHAR(10) NOT NULL CHECK ("FileType" IN ('PDF', 'CSV', 'XLSX')),
    "FileName" VARCHAR(255) NOT NULL,
    "AgentID" UUID REFERENCES public."Users"("UserID") ON DELETE SET NULL,
    "TotalOrders" INT DEFAULT 0,
    "TotalItems" INT DEFAULT 0,
    "ImportStatus" VARCHAR(20) DEFAULT 'Processing' CHECK ("ImportStatus" IN ('Processing', 'Completed', 'PartialFail')),
    "ImportedAt" TIMESTAMPTZ DEFAULT now(),
    "ImportedBy" UUID REFERENCES public."Users"("UserID") ON DELETE SET NULL
);

CREATE TABLE public."ImportedOrders" (
    "ImportedOrderID" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "ImportID" UUID REFERENCES public."OrderImports"("ImportID") ON DELETE CASCADE,
    "PlatformOrderID" VARCHAR(30) NOT NULL,
    "Platform" VARCHAR(20) NOT NULL,
    "OrderStatus" VARCHAR(20) DEFAULT 'Pending' CHECK ("OrderStatus" IN ('Pending', 'Picking', 'Packed', 'Shipped')),
    "TrackingID" VARCHAR(50),
    "OrderAmount" DECIMAL(10,2),
    "CreatedAt" TIMESTAMPTZ DEFAULT now(),
    "PackedAt" TIMESTAMPTZ,
    "PackedBy" UUID REFERENCES public."Users"("UserID") ON DELETE SET NULL
);

CREATE TABLE public."ImportedOrderItems" (
    "ItemID" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "ImportedOrderID" UUID REFERENCES public."ImportedOrders"("ImportedOrderID") ON DELETE CASCADE,
    "ProductID" UUID REFERENCES public."Products"("ProductID") ON DELETE SET NULL,
    "PlatformSKU" VARCHAR(50),
    "ProductName" VARCHAR(255) NOT NULL,
    "Variation" VARCHAR(100),
    "Quantity" INT NOT NULL,
    "UnitPrice" DECIMAL(10,2),
    "Subtotal" DECIMAL(10,2),
    "MatchStatus" VARCHAR(20) DEFAULT 'Pending' CHECK ("MatchStatus" IN ('Matched', 'Unmatched', 'ManualMatch'))
);
