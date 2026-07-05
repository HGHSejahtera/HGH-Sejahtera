# UI Title Naming Convention
- Do not end title names with "ing" or "ed" (e.g. use "Price" instead of "Pricing").
- "Pricing Setup" should be named "Price Setup".
- "Pricing Strategy" should be named "Price Setup".
- Do not include "(RM)" in table headers or column names (e.g., use "Stockist", "Wholesale", "Agent", "Retail").

# Imported Order Item Naming Convention
- NEVER use the raw `ProductName` from the e-commerce platform AWB when displaying matched orders.
- E-commerce names are often SEO-stuffed. We match via Seller SKU/Barcode.
- ALWAYS construct the internal product name using the format: `{Brand} {ProductName} {Variation} {Size}` from the `Products` table.
