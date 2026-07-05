-- Script to clear all test order, sales, and ledger data
-- Run this in Supabase SQL Editor to wipe all test records and reset agent balances to RM 0.00

TRUNCATE TABLE public."ImportedOrders" CASCADE;
TRUNCATE TABLE public."OrderImports" CASCADE;
TRUNCATE TABLE public."POSSales" CASCADE;
TRUNCATE TABLE public."AgentLedger" CASCADE;
TRUNCATE TABLE public."AgentStatements" CASCADE;
