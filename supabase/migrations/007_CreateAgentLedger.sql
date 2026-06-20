-- Migration 007: Agent Ledger & Statements

CREATE TABLE public."AgentLedger" (
    "LedgerEntryID" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "AgentID" UUID REFERENCES public."Users"("UserID") ON DELETE CASCADE,
    "ReferenceID" UUID, -- Can link to ImportedOrderID or be null for manual adjustments
    "EntryType" VARCHAR(20) NOT NULL CHECK ("EntryType" IN ('Charge', 'Return', 'Settlement')),
    "Amount" DECIMAL(10,2) NOT NULL, -- Positive for charge, negative for return/settlement
    "RunningBalance" DECIMAL(10,2) NOT NULL,
    "Description" TEXT,
    "CreatedAt" TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public."AgentStatements" (
    "StatementID" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "AgentID" UUID REFERENCES public."Users"("UserID") ON DELETE CASCADE,
    "PeriodStart" DATE NOT NULL,
    "PeriodEnd" DATE NOT NULL,
    "TotalCharges" DECIMAL(10,2) NOT NULL,
    "TotalReturns" DECIMAL(10,2) DEFAULT 0,
    "NetPayable" DECIMAL(10,2) NOT NULL,
    "IsSettled" BOOLEAN DEFAULT false,
    "SettledAmount" DECIMAL(10,2),
    "SettledMethod" VARCHAR(50),
    "SettledAt" TIMESTAMPTZ,
    "SettledBy" UUID REFERENCES public."Users"("UserID") ON DELETE SET NULL,
    "CreatedAt" TIMESTAMPTZ DEFAULT now(),
    "SettlementCycle" VARCHAR(20) DEFAULT 'monthly'
);
