# UI Title Naming Convention
- Do not end title names with "ing" or "ed" (e.g. use "Price" instead of "Pricing").
- "Pricing Setup" should be named "Price Setup".
- "Pricing Strategy" should be named "Price Setup".
- Do not include "(RM)" in table headers or column names (e.g., use "Stockist", "Wholesale", "Agent", "Retail").

# Imported Order Item Naming Convention
- NEVER use the raw `ProductName` from the e-commerce platform AWB when displaying matched orders.
- E-commerce names are often SEO-stuffed. We match via Seller SKU/Barcode.
- ALWAYS construct the internal product name using the format: `{Brand} {ProductName} {Variation} {Size}` from the `Products` table.

# AWB Upload Architecture (Server-Side)
- TikTok AWB PDF uploads from mobile are processed Server-Side via the Telegram Bot webhook (`api/telegram-webhook.js`), which uses `pdfjs-dist` to parse text and `pdf-lib` to split multi-page PDFs into individual orders.
- **IMPORTANT**: The PDF parser helper MUST be placed in `api/_utils/pdfParserNode.js` (with an underscore) to prevent Vercel from treating it as a standalone serverless endpoint.
- **IMPORTANT**: Use dynamic `await import()` inside a `try...catch` block in serverless functions to capture any module loading errors safely. Vercel Hobby Tier rejects `export const config = { ... }` with `FUNCTION_INVOCATION_FAILED`.
- The backend API uploads the split PDFs directly to Cloudflare R2 and calls the `process_agent_order_upload` RPC to insert them into `ImportedOrders`.
- For manual PC drag-and-drop uploads, `/Agent/Upload` (Upload AWB 💻) is used and processed locally in the browser.

# Global AWB Batch Printing & Proxy Architecture (`useAwbPrintStore`)
- **Global State Management**: All AWB merging (`pdf-lib`) and printing MUST be handled by the global Zustand store (`src/hooks/useAwbPrintStore.js`) and mounted globally at the application root (`src/App.jsx` via `GlobalAwbPrintModal.jsx`). NEVER tie print state locally to individual page components like `AllOrders.jsx` so users can navigate across pages (`/Orders`, `/Inventory`) without unmounting or interrupting active print jobs.
- **Proxy Concurrency & HTTP 502 Mitigation**: When fetching multiple PDF AWBs from Cloudflare R2 via `/api/proxy-pdf`, requests must use sequential fetching with automatic retries (`3 attempts`) and delay backoff to prevent `HTTP 502 Bad Gateway` timeouts.
- **Stuck Orders Handling (`Force Mark Printed`)**: If an order consistently fails to download because its PDF is missing or corrupted in R2, it must be logged in `failedOrders`. The UI must provide a `"Force Mark Printed"` action (`forceMarkPrinted(orderIds)`) to allow agents/users to mark the order as `IsPrinted: true` so it exits `Order Queue` and moves to `Order History`.
- **GlobalAwbPrintModal UI/UX Rules**:
  - Use `max-w-xl` and sharp edges (`rounded-none`) across all modal containers, cards, and progress bars.
  - Section title for download is `Batch AWB Download`.
  - When completion status is reached, status display must show `'Ready'`.
  - Action buttons (`Download PDF`, `Open & Print`) MUST NOT auto-close the modal. Users explicitly close/reset via the `"Complete"` button or `"Minimize"` to the floating widget.
  - Downloaded batch PDF files must follow the format: `Batch-AWB-{YYYY-MM-DD}-{HHmmss}.pdf` using `getBatchAwbFilename()` from `AwbMergeService.js`.

# Search Input Placeholders
- **NEVER use lengthy words or verbose text in search placeholders or input boxes** (e.g., NEVER use `"Search payouts and ledger..."`, `"Search orders..."`, `"Search products by name..."`).
- **ALWAYS use `"Search"` ONLY** across all search boxes, tables (`DataTable`), and inputs in the entire application. Keep it strictly concise.

# Definitive & Direct Naming Convention
- **Never name things non-definitively or with lengthy/slash names.**
- NEVER use `"Unmatched Product / Platform Item"` in table columns or headers; ALWAYS use `"Unmatched Product"`.
- NEVER use `"Impact / Affected Orders"`; ALWAYS use `"Affected Orders"`.
- NEVER use `"Map To Internal Product"`; ALWAYS use direct, concise terms like `"Link Product"` or `"Target Product"`.
- Keep every title, label, and header strictly definitive, direct, and concise without slash (`/`) options or ambiguous alternatives.

# Implementation Plan Review Output Rule
- **When the user reviews an `implementation_plan.md` artifact or provides feedback/comments on a plan, DO NOT output lengthy answers, discussions, explanations, or reviews directly in the chat.**
- ALWAYS write/update your answers directly inside the `implementation_plan.md` artifact and keep your chat response strictly minimal (pointing to the updated plan).

# Strict Form & Input Box Placeholders Prohibition
- **NEVER add verbose or dummy data `placeholder=""` attributes in form inputs or settings fields** (e.g., NEVER use `placeholder="+60 3-1234 5678"`, `placeholder="support@hghsejahtera.com"`, or dummy addresses).
- Form input boxes should either have NO `placeholder` attribute at all, or strictly concise, non-dummy utility descriptors if absolutely required.
- When designing address entry forms, prioritize **structured regional inputs** (Address Line 1, Address Line 2, Address Line 3, Country, State/Negeri, City, Postcode/ZIP Code) with regional defaults (e.g., Malaysia and Malaysia States list) rather than raw unstructured textareas with long dummy placeholders.

# Strict Git Commit Naming Convention
- **NEVER invent, auto-generate, or create descriptive commit names/messages** (e.g., NEVER use `"Add AWB Seller SKU..."`, `"Fix bug in..."`, `"Update UI..."`).
- **ALWAYS use the `"Version X.X.X"` convention** (e.g., `"Version 1.0.3"`).
- **ALWAYS ask the user first what commit name/version number to put before running `git commit`**, unless the user has explicitly stated the exact commit name (`Version X.X.X`) in their prompt.
