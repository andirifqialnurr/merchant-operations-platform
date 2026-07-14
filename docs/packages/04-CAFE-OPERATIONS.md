# Paket Cafe Operations

**Status:** Paket unggulan MVP  
**Target:** Kafe yang membutuhkan alur kasir, meja, dapur, stok, dan finance basic

## 1. Tujuan paket

Memberikan sistem operasional kafe versi basic yang mencakup penjualan, produksi order, bahan baku, pembelian sederhana, cash control, dan estimasi keuntungan.

Paket ini merupakan representasi penuh MVP Release 1.

## 2. Fitur yang termasuk

### Seluruh Cafe Digital

- POS Basic.
- Cafe Profile.
- Table/Order Management.
- QR Self-Order.
- KDS.
- Manual Payment dan Cashier Shift.

### Inventory Basic

- Ingredient/item, category, unit, conversion dasar, dan minimum stock.
- Recipe/BOM per produk.
- Opening stock, stock in/out, adjustment, stock opname, waste, dan transfer outlet.
- Supplier, pembelian, dan penerimaan barang sederhana.
- Auto-consumption dari order.
- Cancellation reversal sebelum produksi dan waste setelah produksi.
- Low-stock alert, stock ledger, dan estimasi HPP.

### Finance Basic

- Sales revenue otomatis.
- Other income dan operational expense.
- Expense category dan attachment opsional.
- Cashbook dan cashier-shift reconciliation.
- Manual reconciliation untuk cash, QRIS, transfer, dan EDC.
- Estimasi HPP, gross profit, operational expense, dan operating profit.
- Laporan outlet dan tenant consolidation.

### Customer Basic

- Nama/telepon opsional.
- Riwayat transaksi, total kunjungan/pembelian, dan note.
- Tidak mencakup loyalty atau campaign.

### Reports

- Seluruh sales, operations, KDS, inventory, purchasing, cash, dan finance basic report.

## 3. Tidak termasuk

- Dynamic QRIS dan automatic settlement.
- Batch, expiry, forecasting, central kitchen, dan purchasing approval advanced.
- Accounting formal, journal, ledger, balance sheet, tax, dan asset depreciation.
- Loyalty, campaign, promotion engine advanced, reservation, delivery, dan marketplace.

## 4. Alur utama

```text
Owner mengatur produk, recipe, dan opening stock
→ Order dibuat dari POS atau QR
→ Kitchen memproses order
→ Recipe menghasilkan stock consumption
→ Kasir mengonfirmasi payment dan shift
→ Pembelian/expense dicatat
→ Owner melihat sales, stock, HPP, gross profit, dan operating profit
```

## 5. Business rules paket

- HPP diberi label estimasi operasional dan memakai metode biaya yang konsisten.
- Stock movement tidak dihapus; koreksi memakai adjustment/reversal.
- Cancel sebelum produksi mengembalikan reservation/consumption.
- Cancel setelah bahan digunakan dicatat sebagai waste.
- Finance Basic tidak boleh dipasarkan sebagai accounting formal.
- Consolidated report hanya mencakup outlet dalam tenant yang memiliki data relevan.

## 6. Pricelist hipotesis

| Komponen | Harga |
|---|---:|
| Subscription bulanan | Rp599.000/outlet/bulan |
| Subscription tahunan | Rp5.990.000/outlet/tahun |
| Onboarding standar | Rp1.750.000/outlet |
| Outlet tambahan | Mengikuti harga per outlet |
| KDS station tambahan | Rp75.000/perangkat/bulan |
| POS device tambahan | Rp50.000/perangkat/bulan |
| Setup recipe/data kompleks | Quotation |

Tidak ada platform fee per transaksi untuk manual payment.

Onboarding standar mencakup satu outlet, maksimal 50 produk, 50 ingredient, 30 recipe, 10 supplier, 30 meja, satu POS, satu KDS, satu printer kompatibel, opening stock import, dan tiga sesi pelatihan remote.

## 7. Batas pemakaian awal

- Satu POS dan satu KDS device termasuk per outlet.
- Maksimal 10 user aktif per outlet.
- Satu lokasi stok per outlet pada MVP.
- Pembelian sederhana tanpa approval berjenjang.
- Customer Basic tanpa marketing automation.

## 8. Acceptance criteria paket

- Order POS/QR mengurangi stock berdasarkan recipe.
- Reversal/waste mengikuti status produksi.
- Pembelian meningkatkan stock dan memperbarui cost basis yang dipilih.
- Shift menampilkan expected cash dan variance.
- Owner melihat sales, expense, estimated HPP, gross profit, dan operating profit.
- Data/report dapat difilter per outlet dan dikonsolidasikan.

## 9. Upgrade path

- Integrated Payment Add-on.
- Advanced Inventory/Purchasing.
- Finance/Accounting Advanced.
- CRM/Loyalty dan Promotion Engine.

## 10. Metric keberhasilan

- Akurasi stock dan jumlah adjustment.
- Waste rate.
- Recipe coverage produk terjual.
- Shift/payment mismatch.
- Gross margin visibility.
- Penggunaan report oleh owner.
- Retention paket dan kesiapan upgrade.
