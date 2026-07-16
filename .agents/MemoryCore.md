# MemoryCore - HGH-Sejahtera Core Architectural & Operational Repository

**Created/Updated**: 2026-07-16  
**Version**: 1.0.0  
**Scope**: Workspace Architecture & Core Enforcement (`HGH-Sejahtera`)

---

## 1. Executive Summary & Core Architectural Pillars
`MemoryCore` serves as the absolute single source of truth for all foundational design decisions, UI/UX enforcements, and state management architectures within the `HGH-Sejahtera` application. All future developments and refactors must strictly conform to these documented patterns.

---

## 2. Global AWB Batch Printing & Proxy Safety Net (`useAwbPrintStore`)

### A. Problem Statement
Prior to this architecture, batch printing of AWB (`Air Waybill`) PDFs in `AllOrders.jsx` (`/Orders`) suffered from:
1. **Component-Bound State**: Loading states and merge progress lived inside `AllOrders.jsx`. Navigating away unmounted the component, terminating active merges and destroying generated PDF blobs.
2. **Proxy Concurrency & HTTP 502**: Fetching hundreds of PDF files simultaneously from Cloudflare R2 via `/api/proxy-pdf` exhausted server proxy limits, causing `HTTP 502 Bad Gateway` timeouts and leaving orders permanently stuck in `Order Queue`.

### B. Architectural Solution & File Mapping
We established a decoupled, root-level **Global AWB Print Store (`useAwbPrintStore`)** using Zustand and rendered a persistent **Global Modal & Floating Pill (`GlobalAwbPrintModal`)** inside `App.jsx`.

| File Path | Role & Responsibility | Key Methods / State |
| :--- | :--- | :--- |
| `src/hooks/useAwbPrintStore.js` | Global Zustand state container managing batch PDF merging across all routes. | `status`, `progress`, `successfulIds`, `failedOrders`, `mergedPdfBlobUrl`, `startBatchPrint()`, `retryFailedOrders()`, `forceMarkPrinted()` |
| `src/components/common/GlobalAwbPrintModal.jsx` | UI interface injected into `App.jsx`. Renders both the full Safety Net Center modal (`max-w-xl`, `rounded-none`) and the minimized floating pill widget (`bottom-4 right-4`). | `handleDownload()`, `handleOpenPrint()`, `Minimize`, `Complete` |
| `src/services/pdf/AwbMergeService.js` | Core PDF processing service using `pdf-lib` and sequential retry logic (`3 attempts` per file). | `MergeAwbsBatch()`, `MergeAndPrintAwbs()`, `getBatchAwbFilename()` |
| `src/pages/Orders/AllOrders.jsx` | Order management dashboard. Delegates `HandlePrintAll` directly to `useAwbPrintStore`. | `HandlePrintAll()` calls `useAwbPrintStore.getState().startBatchPrint(orders, MarkAsPrinted)` |
| `src/App.jsx` | Root application component hosting `<GlobalAwbPrintModal />` outside router bounds. | `<GlobalAwbPrintModal />` |

### C. Key UX & Operational Rules
- **Non-Interruptive Navigation (`Minimize`)**: Users can click **`Minimize`** (`or close dialog during processing`) to collapse the modal into a **Floating Pill Widget** (`bottom-4 right-4`) showing live progress (`Merging AWBs (45%)`) while browsing other routes (`/Inventory`, `/Dashboard`).
- **Safety Net Download (`Batch AWB Download`)**:
  - When completion is reached (`status === 'completed'`), the status indicator displays **`Ready`**.
  - Displays two buttons: **`Download PDF`** (local file save) and **`Open & Print`** (new browser print tab).
  - **No Auto-Close Rule**: Action buttons MUST NOT auto-close the modal. Users explicitly reset store via the **`Complete`** button.
  - Downloaded batch files follow exact timestamping: `Batch-AWB-{YYYY-MM-DD}-{HHmmss}.pdf` via `getBatchAwbFilename()`.
- **Stuck Orders Recovery (`Force Mark Printed`)**: If an AWB returns `HTTP 502/404` after 3 retries, it is logged in `failedOrders`. The UI provides **`Force Mark Printed`** (calling RPC `process_agent_order_upload`) to force `IsPrinted: true` on missing R2 items so they exit `Order Queue` into `Order History`.

---

## 3. Agent Management & Dynamic Total Sales Architecture (`AgentDetails.jsx`)

### A. Context-Aware Total Sales Display (`displayTotalSales`)
In `/Agent-Management/{StaffID}` ([AgentDetails.jsx](file:///c:/Users/HGH/Code/HGH/src/pages/Agents/AgentDetails.jsx)), the header profile card displays a Green Text **`Total Sales`**. To prevent ambiguity between all-time figures and active table views:
- **Dynamic Calculation**: `Total Sales` (`displayTotalSales`) dynamically sums `OrderAmount` based on the active tab (`orders` vs `ledger`) and the currently selected month/date range filters.
- **Contextual Period Label**: A subtle badge next to the header title automatically reflects the exact period being summed:
  - `Total Sales (Current Month)` when filtered by current month.
  - `Total Sales (June)` when filtered by specific month dropdown.
  - `Total Sales (All Months)` when set to all history.
  - `Total Sales (01 Jul - 16 Jul)` when exact date ranges are applied.

### B. Default Filter States & Table Configuration
- **Month Dropdowns (`filterMonth` & `ledgerMonth`)**: Both tabs strictly default to **`Current/Active Month`** (`String(new Date().getMonth())`). Never default month selectors to `All Months`.
- **Orders Tab Page Size (`Show`)**: When viewing the `Orders` tab (`activeTab === 'orders'`), the `DataTable` pagination (`Show` dropdown next to search box) defaults to **`All`** (`defaultPageSize={999999}`).

---

## 4. Product Matcher & Search Ergonomics (`ProductMatcher.jsx`)

### A. List View Display Format
- Matched orders display the internal product name formatted precisely as `{Brand} {ProductName} {Variation} {Size}` in one clean row from `Products`.
- Seller SKU/Barcode is shown immediately below the title row.
- Product images are stripped from the list view to maintain high-density scannability.

### B. Keyboard Navigation Integration
- When searching inside `ProductMatcher.jsx` (`Search by SKU / Barcode / Name`), agents can navigate the result list seamlessly using keyboard controls without clicking away from the search input:
  - **`ArrowDown` / `ArrowUp`**: Moves active highlight selection across filtered items while keeping focus locked inside the input field.
  - **`Enter`**: Instantly selects/adds the currently highlighted product to the order matching payload.

---

## 5. UI/UX & Wording Enforcements

### A. Search Input Placeholders (`Strict Enforcement`)
- **NEVER use lengthy words or verbose text in search placeholders or input boxes** (e.g., NEVER use `"Search payouts and ledger..."`, `"Search orders..."`, `"Search products by name..."`).
- **ALWAYS use `"Search"` ONLY** across all search boxes, tables (`DataTable`), and inputs across the entire application without exception. Keep all wording strictly concise.

### B. Design Aesthetics & Modals
- **Sharp & Clean Theme**: All containers, cards, buttons, and progress bars in `GlobalAwbPrintModal` and related batch UI strictly use `rounded-none` (`No round corners`).
- **Concise Copy**: Remove redundant descriptions, excessive paper icons, and verbose confirmation copy across modals. Status indicators must remain simple, punchy (`Ready`), and highly scannable.
- **Title Naming Conventions**:
  - Do not end title names with `"ing"` or `"ed"` (e.g., use `Price Setup` instead of `Pricing Setup` or `Pricing Strategy`).
  - Do not include `(RM)` in table headers or column names (`Stockist`, `Wholesale`, `Agent`, `Retail`).

### C. POS Receipt & Agent Portal Navigation (`A4 & Clean Tabs`)
- **POS Receipt Layout (`Receipt.jsx`)**: Official receipts printed via `/POS` (`Print Receipt`) must use a formal **A4 Invoice/Receipt layout (`@page { size: A4; margin: 15mm; }`)** with clean `font-sans` typography, structured tabular breakdown (`No. / Item Description / Qty / Unit Price / Amount`), and right-aligned summaries. Never use narrow (`300px`) thermal roll formats for standard office printing.
  - **Absolute Single-Page Printing Enforcement**: To prevent blank leading pages (`Page 1 white`) caused by ancestor container heights during `@media print`, `.receipt-container` must enforce **`position: absolute !important; left: 0 !important; top: 0 !important; z-index: 999999 !important;`** alongside `#root, body, html { min-height: 0 !important; height: auto !important; }`.
- **POS Payment Modal Navigation & Cart Ergonomics (`POS.jsx`)**:
  - **Manual Quantity Keyboard Input**: Order item quantities in the cart (`/POS`) are rendered as `<input type="number" min="1" />` alongside `[` **`-`** `]` and `[` **`+`** `]` buttons. Cashiers can manually type exact amounts (`50`, `100`) directly from the keyboard. Subtotal and completion calculations must safely parse numbers (`getSafeQty`) to guard against temporary empty inputs (`''`) without `NaN` errors.
  - **Single Concise `Back` Button**: Every screen inside the Payment Modal must feature strictly **one single `Back` button** (located at the bottom-left action bar alongside `Cancel Order` or `Print Receipt`). Duplicate `Back` buttons in the modal header are strictly prohibited. Wording must strictly be **`Back`** (no arrows, no lengthy copy).
- **Agent Portal Tabs (`AgentTabs.jsx`)**: The navigation tabs inside `/Agent/Upload` (`Upload AWB` and `Orders`) must be text-only without leading icons (`Monitor` and `Package` icons removed) to maintain minimalist typography.
