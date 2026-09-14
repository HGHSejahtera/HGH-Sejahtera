import { AccountMalay } from './Account';
export const my = {
    SettingsNavigation: { Account:'Akaun Saya', General:'Umum', Users:'Pengurusan Pengguna', APIConnection:'Sambungan API' },
    Account: AccountMalay,
    sidebar: {
        dashboard: "Papan Pemuka",
        pos: "POS",
        pickPack: "Pick & Pack",
        orderUpload: "Muat Naik Pesanan",
        products: "Produk",
        barcodes: "Kod Bar",
        inventory: "Inventori",
        agents: "Agent Management",
        pricing: "Harga",
        settings: "Tetapan",
        myOrders: "Pesanan Saya",
        myLedger: "Lejar Saya"
    },
    header: {
        dashboard: "Papan Pemuka",
        pos: "Point of Sale",
        pickPack: "Barisan Pick & Pack",
        packOrder: "Bungkus Pesanan",
        orderUpload: "Muat Naik Pesanan",
        barcodes: "Penjana Kod Bar",
        products: "Katalog Produk",
        inventory: "Lejar Inventori",
        agents: "Pengurusan Ejen",
        pricing: "Price Setup",
        settings: "Tetapan",
        workspace: "Ruang Kerja"
    },
    dashboard: {
        totalSales: "Jumlah Jualan",
        totalOrders: "Jumlah Pesanan",
        activeAgents: "Ejen Aktif",
        pendingOrders: "Pesanan Tertunggak",
        lowStockItems: "Stok Rendah",
        recentOrders: "Pesanan Terkini",
        viewAll: "Lihat Semua",
        orderId: "ID Pesanan",
        customer: "Pelanggan",
        agent: "Ejen",
        status: "Status",
        amount: "Jumlah",
        topProducts: "Produk Terlaris",
        revenue: "Pendapatan",
        overview: "Gambaran Keseluruhan",
        welcomeText: "Selamat kembali. Berikut adalah perkembangan kedai anda hari ini.",
        quickActions: "Tindakan Pantas",
        startPOS: "Mula POS",
        startPOSDesc: "Proses jualan fizikal",
        importOrders: "Muat Naik Pesanan",
        importOrdersDesc: "Muat naik CSV dari Shopee/TikTok",
        addProduct: "Tambah Produk",
        addProductDesc: "Daftar item baru ke inventori",
        agentList: "Senarai Ejen",
        agentListDesc: "Urus rangkaian reseller"
    },
    productModal: {
        category: "Pilih Kategori",
        selectBrand: "Pilih Brand",
        noBrandFound: "Tiada brand ditemui.",
        noCategoryFound: "Tiada kategori ditemui."
    },
    settingsUsers: {
        emptyTitle: "Tiada user lagi",
        emptyDescription: "User baru yang register akan muncul di sini."
    },
    errors: {
        uploadFailedPresigned: "Gagal mendapatkan kebenaran upload (Pre-signed URL gagal)",
        uploadFailedR2: "Gagal upload gambar ke Cloudflare R2",
        uploadFailedGeneric: "Gagal memuat naik gambar.",
        uploadOrdersFailedR2: "Gagal memuat naik pesanan: Gagal dapatkan laluan upload R2 yang selamat."
    },
    pricingSetup: {
        saveChanges: "Simpan",
        searchPlaceholder: "Cari",
        stealthActive: "Stealth Mode Aktif",
        productName: "Nama Produk",
        realCost: "Cost",
        fakeCost: "Fake Cost",
        stockist: "Stokis",
        wholesale: "Borong",
        agent: "Ejen",
        retail: "Retail",
        noProducts: "Tiada produk dijumpai.",
        success: "Harga berjaya dikemas kini!",
        errorSave: "Gagal menyimpan harga. Sila cuba lagi.",
        errorLoad: "Gagal memuatkan data harga.",
        saving: "Menyimpan perubahan harga..."
    }
};
