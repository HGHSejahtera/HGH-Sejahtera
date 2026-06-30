-- Migration 008: Settings

CREATE TABLE public."Settings" (
    "Key" VARCHAR(50) PRIMARY KEY,
    "Value" TEXT,
    "Description" TEXT,
    "UpdatedAt" TIMESTAMPTZ DEFAULT now()
);

-- Seed default settings
INSERT INTO public."Settings" ("Key", "Value", "Description") VALUES
('DuitNowQRImage', '', 'URL to DuitNow QR image in Supabase Storage'),
('CostPerParcel', '0.80', 'Packaging material cost per parcel'),
('CompanyName', 'Perniagaan Sejahtera Utama', 'Company Name for Invoices'),
('CompanyAddress', '', 'Company Address'),
('CompanySSM', '', 'Company Registration Number'),
('DefaultPlatformFee', '25', 'Default platform fee percentage for calculations'),
('SettlementCycle', 'monthly', 'Agent billing cycle (monthly/weekly)');
