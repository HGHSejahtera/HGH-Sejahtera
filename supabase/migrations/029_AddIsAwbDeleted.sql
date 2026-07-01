-- Migration 029: Add IsAwbDeleted to OrderImports

ALTER TABLE public."OrderImports"
ADD COLUMN "IsAwbDeleted" BOOLEAN NOT NULL DEFAULT FALSE;
