-- Migration 004: Inventory (StockBatches & InventoryLedger)

CREATE TABLE public."StockBatches" (
    "BatchID" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "ProductID" UUID REFERENCES public."Products"("ProductID") ON DELETE CASCADE,
    "CartonsReceived" INT NOT NULL DEFAULT 0,
    "UnitsPerCarton" INT NOT NULL DEFAULT 1,
    "LooseUnits" INT NOT NULL DEFAULT 0,
    "TotalUnits" INT NOT NULL,
    "Notes" TEXT,
    "ReceivedAt" TIMESTAMPTZ DEFAULT now(),
    "ReceivedBy" UUID REFERENCES public."Users"("UserID") ON DELETE SET NULL
);

CREATE TABLE public."InventoryLedger" (
    "LedgerID" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "ProductID" UUID REFERENCES public."Products"("ProductID") ON DELETE CASCADE,
    "MovementType" VARCHAR(20) NOT NULL CHECK ("MovementType" IN ('StockIn', 'POSSale', 'ImportedOrder', 'Return', 'WriteOff', 'Adjustment')),
    "Quantity" INT NOT NULL, -- Positive for in, negative for out
    "Channel" VARCHAR(20),
    "ReferenceID" UUID,
    "ReferenceType" VARCHAR(30),
    "CreatedAt" TIMESTAMPTZ DEFAULT now(),
    "CreatedBy" UUID REFERENCES public."Users"("UserID") ON DELETE SET NULL
);
