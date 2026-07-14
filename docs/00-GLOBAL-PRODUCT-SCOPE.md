# Global Product Scope

**Status:** Living document  
**Tanggal:** 14 Juli 2026  
**Cakupan:** Visi jangka panjang seluruh platform

## 1. Ringkasan produk

Platform ini adalah sistem operasional kafe dan UMKM F&B yang menghubungkan aktivitas pelanggan, kasir, dapur, stok, dan laporan pemilik dalam satu aplikasi.

> Pelanggan dapat memesan melalui kasir atau QR meja, pesanan diteruskan ke dapur, pembayaran dicatat, stok diperbarui, dan pemilik memperoleh laporan operasional serta keuangan.

Produk bukan hanya POS. POS merupakan salah satu kanal masuk ke pusat data pesanan yang sama.

## 2. Hierarki bisnis

```text
Platform
└── Tenant
    └── Brand
        └── Outlet
```

- **Platform**: bisnis SaaS milik penyedia aplikasi.
- **Tenant**: perusahaan atau pemilik usaha yang berlangganan.
- **Brand**: merek yang dilihat konsumen.
- **Outlet**: lokasi/cabang operasional.
- **Staff**: owner, manager, kasir, dapur, inventory, dan finance.
- **Consumer**: pelanggan akhir kafe.

Satu tenant dapat memiliki beberapa brand dan outlet. Pada merchant sederhana, sistem membuat satu tenant, satu brand, dan satu outlet secara otomatis.

## 3. Prinsip produk

1. **Multi-tenant sejak awal**: data satu merchant tidak dapat diakses merchant lain.
2. **Multi-outlet**: transaksi terjadi di outlet, sedangkan owner dapat melihat konsolidasi tenant.
3. **Modular**: modul diaktifkan berdasarkan paket dan entitlement.
4. **Satu pusat pesanan**: POS, QR meja, waiter, dan integrasi masa depan menggunakan Order Management yang sama.
5. **Order dan payment dipisahkan**: status produksi tidak dicampur dengan status pembayaran.
6. **Transaksi tidak dihapus permanen**: void, refund, reversal, dan koreksi memiliki audit.
7. **Manual payment dahulu**: dana tidak diproses platform pada MVP.
8. **Payment-ready**: struktur pembayaran dapat menerima provider eksternal.
9. **Basic dahulu, advanced kemudian**: inventory dan finance MVP bukan ERP/accounting penuh.

## 4. Katalog modul global

### 4.1 Platform Management

- Tenant, brand, dan outlet registry.
- Package dan module master.
- Subscription, invoice, trial, grace period, suspend, dan reactivation.
- Module entitlement dan usage metering.
- Support access dengan alasan, batas waktu, dan audit.
- Platform analytics, monitoring, feature flags, dan notification templates.

### 4.2 Identity and Access

- User, role, dan permission.
- Scope tenant, brand, outlet, dan perangkat.
- Manager approval PIN, login history, dan session control.
- MFA dan enterprise access control pada roadmap.

### 4.3 Merchant Organization

- Profil tenant dan identitas brand.
- Outlet, jam operasional, pajak, dan service charge.
- Metode pembayaran, meja, perangkat, dan printer.

### 4.4 Product and Menu

- Kategori, produk, foto, deskripsi, varian, modifier, dan bundling.
- Harga tenant dan override outlet.
- Ketersediaan, jam penjualan, dan tujuan KDS.
- Recipe/BOM untuk Inventory.

### 4.5 POS and Cashier

- Dine-in dan takeaway.
- Keranjang, catatan, diskon, pajak, dan service charge.
- Hold, void, cancel, refund, reprint, dan approval.
- Tunai, QRIS merchant manual, transfer, EDC, dan mixed payment.
- Buka/tutup shift dan cash control.

### 4.6 Order and Table Management

- Sumber pesanan: cashier, table QR, waiter, delivery, dan API.
- Order status, payment status, dan timeline.
- Lantai, area opsional, meja, dan table layout visual per lantai.
- Posisi, ukuran grid, bentuk sederhana, capacity, dan status meja.
- Sesi meja, pindah/gabung meja, split bill, dan tutup bill.
- Beberapa batch pesanan dalam satu table session.

### 4.7 Cafe Profile and Digital Storefront

- Profil, logo, banner, lokasi, jam buka, outlet, dan menu publik.
- Status menu tersedia/habis, promo, domain, dan white-label bertahap.

### 4.8 QR Self-Order

- QR outlet/meja yang dipetakan ke table layout, menu, keranjang, modifier, dan catatan.
- Generate, print, revoke, dan rotate QR token per meja.
- Pesan lagi, status pesanan, panggil pelayan, dan minta bill.
- Pembayaran manual pada MVP dan otomatis pada Integrated Payment.

### 4.9 Kitchen Display System

- New, accepted, preparing, ready, served, dan completed.
- Audio notification, waktu tunggu, dan riwayat.
- Station routing: kitchen, bar, dessert, dan packing.
- Print fallback dan device health.

### 4.10 Payment and Reconciliation

#### Manual

- Tunai, QRIS merchant, transfer, dan EDC merchant.
- Konfirmasi kasir dan rekonsiliasi manual.

#### Integrated Payment - roadmap

- Merchant/sub-account onboarding melalui PJP.
- Dynamic QRIS pada POS dan self-order.
- Webhook, idempotency, polling, expiry, refund, reconciliation, dan dispute.
- Settlement dan optional split platform fee jika disetujui PJP.
- Payment provider abstraction agar produk tidak terkunci pada satu vendor.

Platform tidak akan menyimpan saldo konsumen atau membangun wallet sendiri tanpa dasar perizinan yang sesuai.

### 4.11 Inventory

#### Basic

- Ingredient/item master, satuan, dan konversi dasar.
- Recipe/BOM.
- Stock in/out, adjustment, opname, waste, dan transfer outlet.
- Supplier dan pembelian sederhana.
- Low-stock alert dan estimasi HPP.

#### Advanced - roadmap

- Multi-warehouse, batch, dan expiry.
- Purchase request, approval, purchase order, dan retur.
- Costing lanjutan, forecasting, central kitchen, produksi, dan supplier portal.

### 4.12 Finance

#### Basic

- Penjualan, pemasukan lain, pengeluaran, dan cashbook.
- Shift reconciliation dan rekap metode pembayaran.
- Estimasi HPP, laba kotor, dan laba operasional.
- Rekonsiliasi pembayaran manual.

#### Advanced - roadmap

- Chart of accounts, jurnal, buku besar, neraca, dan laba rugi akuntansi.
- Utang/piutang, tutup periode, aset, depresiasi, pajak, dan integrasi accounting.

### 4.13 Customer and CRM

- Customer Basic: identitas opsional, histori, total kunjungan, dan catatan.
- Loyalty, membership tier, voucher personal, segmentasi, campaign, dan feedback pada roadmap.
- Data customer selalu terisolasi per tenant.

### 4.14 Promotion and Pricing

- Diskon nominal dan persentase sederhana.
- Happy hour, bundling, voucher, BOGO, dan rule engine pada roadmap.
- Harga khusus outlet, channel, waktu, dan member.

### 4.15 Reports and Analytics

- Penjualan, produk, kategori, channel, payment, kasir, dan outlet.
- KDS performance dan waktu tunggu.
- Inventory, waste, purchasing, HPP, dan margin.
- Finance dan consolidated multi-outlet report.
- Export dan scheduled report.

### 4.16 Devices, Notifications, and Integrations

- POS/KDS device registry.
- Printer mapping, print queue, retry, dan reprint marker.
- In-app, email, WhatsApp, dan push notification bertahap.
- API, webhook, accounting, marketplace, delivery, dan hardware integration pada roadmap.

### 4.17 Security, Audit, and Support

- Audit harga, stok, void, refund, role, entitlement, dan support access.
- Backup, restore, rate limiting, dan session control.
- Support ticket, incident history, privacy, retention, dan consent.

## 5. Roadmap versi produk

### Release 1 - MVP Operasional Kafe

- Platform Super Admin dan subscription manual.
- Tenant, brand, outlet, staff, role, dan entitlement.
- Product/menu, POS, Order, table layout per lantai, Cafe Profile, QR Self-Order, dan KDS.
- Manual payment dan manual reconciliation.
- Inventory Basic, Finance Basic, Basic Reports, device/printer, dan audit.

### Release 1.1 - Stabilization and Adoption

- Perbaikan hasil pilot.
- Split bill, multi-station KDS, export, notification, dan report.
- Onboarding/migrasi menu dan multi-outlet consolidation.
- Reliability printer, koneksi, dan device monitoring.

### Release 2 - Integrated Payment

- PJP/payment gateway partnership.
- KYC/sub-account onboarding.
- Dynamic QRIS, webhook, refund, settlement, dan reconciliation.
- Optional split platform fee dan payment analytics.

### Release 3 - Advanced Operations

- Advanced Inventory dan Purchasing.
- Finance/Accounting Advanced.
- Promotion engine, Customer CRM, loyalty, dan campaign.
- Reservation, delivery, marketplace, dan accounting integration.

### Release 4 - Scale and Ecosystem

- Franchise/multi-brand advanced management.
- Central kitchen dan supply chain.
- Open API, partner ecosystem, white-label, dan custom domain.
- Forecasting, recommendation, enterprise security, approval, dan audit.

## 6. Peta paket komersial

| Paket | Target utama | Modul utama |
|---|---|---|
| Profile | Kafe yang hanya perlu profil/katalog | Cafe Profile dan menu publik |
| POS Basic | Outlet yang mengganti aplikasi kasir | POS, manual payment, shift, basic report |
| Cafe Digital | Kafe dine-in dengan QR ordering | POS Basic, Table Layout, QR Self-Order, KDS |
| Cafe Operations | Operasional kafe lengkap versi basic | Cafe Digital, Inventory Basic, Finance Basic, Customer Basic |
| Custom Modular | Merchant dengan kombinasi khusus | Modul dipilih dengan dependency rules |
| Integrated Payment Add-on | Pembayaran otomatis | Dynamic QRIS, webhook, settlement, reconciliation |

## 7. Batasan dan asumsi global

- Hardware tidak termasuk subscription standar.
- Merchant bertanggung jawab atas koneksi internet dan perangkat.
- Full offline synchronization bukan bagian MVP.
- Table layout MVP hanya memetakan meja per lantai; tidak mencakup dinding, pintu, dekorasi, fasilitas, atau editor denah bangunan.
- Finance Basic bukan laporan akuntansi formal.
- HPP basic merupakan estimasi berdasarkan recipe dan harga bahan.
- Manual QRIS dicatat setelah kasir memverifikasi notifikasi merchant.
- Harga dan ketentuan PJP wajib dikonfirmasi sebelum Integrated Payment diluncurkan.
- Privacy, PSE, perlindungan data, pajak, dan kontrak PJP perlu review profesional sebelum produksi.

## 8. Ukuran keberhasilan global

- Merchant aktif dan retention subscription.
- Persentase transaksi merchant yang dicatat melalui sistem.
- Waktu pencatatan pesanan dan order-to-ready.
- Adopsi QR Self-Order.
- Akurasi shift, pembayaran, dan stok.
- Penurunan void tanpa alasan.
- Pendapatan berulang dan biaya support per outlet.
