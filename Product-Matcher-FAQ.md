# Panduan Modul Product Matcher & Cadangan Penamaan

**Tarikh:** 18 Julai 2026  
**Status Core Memory:** ✅ Telah dikemas kini ke dalam `MemoryCore/Main/RelationshipMemory.md` dan `.agents/AGENTS.md` (`/learn` rules).

---

## 1. Apakah maksud "Map To Internal Product"?

**"Map To Internal Product"** (yang akan ditukar namanya kepada istilah lebih ringkas) ialah proses **menghubungkan item pesanan mentah (*raw imported item*) dari platform e-dagang (TikTok/Shopee) kepada produk rasmi di dalam sistem inventori kita (`Products` table)**.

### Mengapa proses ini diperlukan?
1. **Nama E-Dagang Berbeza dengan Nama Gudang:**  
   Penjual di TikTok/Shopee sering meletakkan nama produk yang sangat panjang berunsur SEO (cth: *"My Baby Minyak Telon Untuk Kulit Bayi Anda 3 Wangian Terbaru 100% Asli HQ"*). Sistem inventori kita pula menggunakan nama rasmi yang teratur (`{Brand} {ProductName} {Variation} {Size}`).
2. **Ketiadaan atau Perbezaan Seller SKU:**  
   Jika pesanan yang diimport dari AWB/CSV tidak mempunyai *Seller SKU* yang sah atau barcodenya tidak wujud dalam sistem, pangkalan data tidak tahu produk mana yang perlu ditolak stoknya (*inventory deduction*).
3. **Penyelarasan Harga & Ledger:**  
   Untuk mengira keuntungan (*Profit/Loss Alert*), harga kos (`Real Cost`), dan markup harga agen (`AgentPricingOverrides`), item pesanan tersebut **wajib dipadankan** dengan `ProductID` rasmi sistem kita.

Dalam jadual `Product Matcher`, kolom dropdown ini membolehkan anda memilih produk rasmi (cth: `HGH Minyak Telon 100ml`) bagi item import yang tertunggak tersebut.

---

## 2. Apakah fungsi butang "Resolve" di kolom Action?

Butang **Resolve** ialah butang eksekusi (*execution trigger*) yang menjalankan pengemaskinian serentak (*batch synchronization*) di pangkalan data setelah anda memilih produk di dalam kotak dropdown.

### Apa yang berlaku di belakang sistem apabila anda klik "Resolve"?
1. **Eksekusi Prosedur RPC (`resolve_unmatched_items_batch`):**  
   Sistem menghantar `ProductID` produk yang anda pilih beserta senarai ID item (`ItemIDs`) yang terkesan ke pangkalan data Supabase.
2. **Pengemaskinian Serentak Semua Pesanan Terkesan (*Batch Update*):**  
   Sekiranya terdapat 16 pesanan berbeza daripada pelanggan berlainan yang membeli item tanpa SKU yang sama ini, **kesemua 16 pesanan tersebut akan dipadankan secara serentak** dalam satu klik.
3. **Penyelarasan Harga & Nombor AWB:**  
   - Nama produk bertukar dari nama panjang TikTok kepada nama rasmi gudang.
   - `PlatformSKU` dikemas kini mengikut *Seller SKU/Barcode* produk rasmi.
   - Harga satuan (`UnitPrice`) dan jumlah (`Subtotal`) dikira semula berdasarkan harga sistem atau harga khas agen tersebut.
   - Jumlah keseluruhan pesanan (`OrderAmount`) pada jadual utama `ImportedOrders` dikemas kini.
4. **Perubahan Status (`Unmatched` ➔ `ManualMatch`):**  
   Item tersebut rasmi selesai dipadankan, keluar dari `Product Matcher Queue`, dan pesanan sedia untuk dicetak AWB dan diproses di halaman utama `/Orders`.

---

## 3. 10 Cadangan Alternatif Ringkas & Muktamad untuk "Map To Internal Product"

Mengikut peraturan ketat anda — **tiada nama panjang, tiada perkataan berterabur, tiada pilihan berslash (`/`), dan mesti tegas serta muktamad (*definitive & concise*)** — berikut ialah 10 cadangan alternatif terbaik untuk menggantikan tajuk kolom tersebut:

| Bil | Cadangan Nama | Ulasan & Kenapa Sesuai | Status Syor |
| :---: | :--- | :--- | :---: |
| 1. | **Link Product** | Tepat 2 perkataan, muktamad, dan jelas menunjukkan tindakan menghubungkan item import ke produk sistem. | ⭐ **Paling Disyorkan** |
| 2. | **Select Product** | Sangat langsung dan mudah difahami oleh mana-mana pengguna (arahan memilih produk). | ⭐ **Sangat Baik** |
| 3. | **Target Product** | Menunjukkan bahawa ini adalah produk sasaran (*canonical product*) di dalam sistem kita. | 👍 **Tegas** |
| 4. | **Match Product** | Selaras dengan nama modul (*Product Matcher*), menunjukkan pasangan produk rasmi. | 👍 **Konsisten** |
| 5. | **Assign Product** | Jelas menunjukkan tindakan menetapkan produk rasmi kepada pesanan tersebut. | 👍 **Jelas** |
| 6. | **Internal Product** | Padat, menyingkirkan kata kerja (*Map to*) dan terus kepada kata nama produk sistem. | 👌 **Ringkas** |
| 7. | **System Product** | Membezakan secara jelas antara `Unmatched Product` (Platform) dan `System Product` (Gudang kita). | 👌 **Sangat Jelas** |
| 8. | **Official Product** | Menekankan bahawa pilihan di sini ialah produk rasmi HQ. | 👌 **Profesional** |
| 9. | **Product Match** | Ringkas, 2 perkataan, mengekalkan konteks pemadanan. | 👌 **Ringkas** |
| 10. | **Product** | Paling ringkas dan minimalis, kerana bersebelahan dengan `Unmatched Product`. | 💡 **Minimalis** |

---

### Perancangan Seterusnya (Jika Diizinkan)
Jika anda bersetuju dengan cadangan nombor 1 (**Link Product**) atau mana-mana pilihan di atas, saya boleh terus menukarkan tajuk kolom `Map To Internal Product` di jadual `ProductMatcher.jsx` kepada pilihan anda supaya jadual tersebut 100% ringkas dan tegas.
