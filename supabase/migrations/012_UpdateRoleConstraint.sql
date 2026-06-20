-- Migration 012: Update Role Constraint to allow Developer and Pending

-- Drop the old constraint
ALTER TABLE public."Users" DROP CONSTRAINT IF EXISTS "Users_Role_check";

-- Add the new constraint
ALTER TABLE public."Users" ADD CONSTRAINT "Users_Role_check" CHECK ("Role" IN ('Founder', 'Manager', 'Developer', 'Staff', 'Agent', 'Pending'));
