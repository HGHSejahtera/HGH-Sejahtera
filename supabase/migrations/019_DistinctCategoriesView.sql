-- Migration 019: Loose Index Scan View for Distinct Categories

-- 1. Create a B-Tree index on the Category column for fast lookups
CREATE INDEX IF NOT EXISTS idx_products_category ON public."Products"("Category");

-- 2. Create the Recursive CTE View
CREATE OR REPLACE VIEW public."DistinctCategories" AS
WITH RECURSIVE t AS (
   SELECT min("Category") AS "CategoryName" FROM public."Products"
   UNION ALL
   SELECT (SELECT min("Category") FROM public."Products" WHERE "Category" > t."CategoryName")
   FROM t WHERE t."CategoryName" IS NOT NULL
)
SELECT "CategoryName" FROM t WHERE "CategoryName" IS NOT NULL AND "CategoryName" != '';

-- 3. Grant access to PostgREST roles
GRANT SELECT ON public."DistinctCategories" TO authenticated;
GRANT SELECT ON public."DistinctCategories" TO anon;
