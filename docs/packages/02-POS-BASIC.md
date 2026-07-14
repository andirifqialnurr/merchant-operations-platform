# Paket POS Basic

**Status:** Hipotesis paket awal  
**Target:** Kafe/UMKM yang ingin mengganti pencatatan kasir tetapi belum memerlukan QR Self-Order

## 1. Tujuan paket

Menyediakan transaksi kasir, pembayaran manual, shift, dan laporan penjualan dasar dalam satu outlet.

## 2. Fitur yang termasuk

### Core

- Tenant, brand, outlet, staff, role, dan permission dasar.
- Product/menu, category, variant, modifier, dan outlet price.
- Cafe Profile dasar.

### POS

- Dine-in dan takeaway.
- Pilih meja dasar melalui list untuk order kasir.
- Cart, modifier, note, discount sederhana, tax, dan service charge.
- Hold, cancel dengan alasan, manager approval, dan reprint.
- Manual payment: cash, merchant QRIS, transfer, EDC, dan other.
- Open/close shift, opening cash, cash in/out, counted cash, dan variance.

### Report

- Sales harian, mingguan, dan bulanan.
- Sales per product, category, cashier, dan payment method.
- Discount, cancel, refund manual, tax, dan shift report.

## 3. Tidak termasuk

- QR Self-Order.
- Visual table layout per lantai dan pengelolaan QR meja.
- Customer order-status page.
- KDS sebagai layar terpisah.
- Inventory dan recipe.
- Finance Basic selain cash/shift dan sales report.
- Integrated Payment.
- Loyalty dan Customer CRM.

## 4. Alur utama

```text
Kasir membuka shift
→ Kasir memasukkan order
→ Customer membayar cash/QRIS/transfer/EDC merchant
→ Kasir mengonfirmasi payment
→ Sistem menyelesaikan order dan memperbarui laporan
→ Kasir menutup shift dan mencatat uang fisik
```

## 5. Business rules paket

- QRIS merchant selalu dikonfirmasi manual.
- Cancel transaksi selesai membutuhkan alasan dan permission.
- Cash variance terlihat Owner/Manager.
- Transaksi tidak dihapus permanen.
- Merchant dapat upgrade tanpa migrasi ulang menu dan transaksi.

## 6. Pricelist hipotesis

| Komponen | Harga |
|---|---:|
| Subscription bulanan | Rp249.000/outlet/bulan |
| Subscription tahunan | Rp2.490.000/outlet/tahun |
| Onboarding standar | Rp750.000/outlet |
| Outlet tambahan | Mengikuti harga per outlet |
| POS device tambahan | Rp50.000/perangkat/bulan |
| Migrasi data/menu kompleks | Quotation |

Tidak ada fee per transaksi untuk cash atau QRIS/transfer/EDC merchant manual.

Onboarding standar mencakup satu outlet, bantuan input maksimal 50 produk, konfigurasi satu perangkat POS, konfigurasi satu printer yang kompatibel, dan satu sesi pelatihan remote.

## 7. Batas pemakaian awal

- Satu POS device termasuk per outlet.
- Maksimal 5 user aktif per outlet.
- Satu printer kasir termasuk konfigurasi; perangkat dibeli merchant.
- Transaksi tidak dibatasi secara komersial pada pilot.

## 8. Acceptance criteria paket

- Kasir dapat melakukan transaksi cash dan manual QRIS.
- Shift menampilkan expected cash dan variance.
- Owner dapat melihat sales dan payment-method report.
- User tanpa permission tidak dapat cancel transaksi selesai.
- Fitur nonpaket ditolak oleh backend meskipun URL diketahui.

## 9. Upgrade path

- POS Basic → Cafe Digital untuk Self-Order dan KDS.
- POS Basic → Cafe Operations untuk Inventory Basic dan Finance Basic.

## 10. Metric keberhasilan

- Persentase transaksi outlet yang dicatat melalui POS.
- Waktu transaksi kasir.
- Shift variance.
- Jumlah cancel/refund dan approval.
- Retention dan upgrade merchant.
