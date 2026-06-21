-- Migration 017: Loose Index Scan View for Distinct Brands

-- 1. Create a B-Tree index on the Brand column for fast lookups
CREATE INDEX IF NOT EXISTS idx_products_brand ON public."Products"("Brand");

-- 2. Create the Recursive CTE View
-- This uses a Loose Index Scan to fetch distinct brands in O(log N) time
CREATE OR REPLACE VIEW public."DistinctBrands" AS
WITH RECURSIVE t AS (
   SELECT min("Brand") AS "BrandName" FROM public."Products"
   UNION ALL
   SELECT (SELECT min("Brand") FROM public."Products" WHERE "Brand" > t."BrandName")
   FROM t WHERE t."BrandName" IS NOT NULL
)
SELECT "BrandName" FROM t WHERE "BrandName" IS NOT NULL AND "BrandName" != '';

-- 3. Grant access to PostgREST roles
GRANT SELECT ON public."DistinctBrands" TO authenticated;
GRANT SELECT ON public."DistinctBrands" TO anon;
