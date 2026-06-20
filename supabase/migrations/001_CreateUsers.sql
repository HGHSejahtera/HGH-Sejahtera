-- Migration 001: Users and RBAC
-- Extending Supabase Auth with custom fields

-- Ensure extension 'uuid-ossp' is installed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- We will use public.Users to mirror auth.users for Better-Auth or custom logic if needed,
-- but typically we'd use auth.users directly. Since we are using Better-Auth, 
-- we will define our own Users table that Better-Auth will manage.

CREATE TABLE public."Users" (
    "UserID" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "Username" VARCHAR(50) UNIQUE NOT NULL,
    "Email" VARCHAR(255) UNIQUE NOT NULL,
    "StaffID" VARCHAR(20) UNIQUE,
    "DisplayName" VARCHAR(100) NOT NULL,
    "Role" VARCHAR(20) NOT NULL CHECK ("Role" IN ('Founder', 'Manager', 'Staff', 'Agent')),
    "PINHash" VARCHAR(255),
    "IsActive" BOOLEAN DEFAULT true,
    "CreatedAt" TIMESTAMPTZ DEFAULT now(),
    "UpdatedAt" TIMESTAMPTZ DEFAULT now()
);

-- Trigger to update UpdatedAt
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW."UpdatedAt" = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON public."Users"
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
