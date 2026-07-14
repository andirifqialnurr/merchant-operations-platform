# Paket Cafe Digital

**Status:** Hipotesis paket awal  
**Target:** Kafe dine-in yang membutuhkan POS, table layout per lantai, QR Self-Order, dan Kitchen Display

## 1. Tujuan paket

Mengurangi ketergantungan pada pelayan untuk mencatat pesanan dan menghubungkan order dari kasir maupun meja ke antrean dapur yang sama.

## 2. Fitur yang termasuk

### Seluruh POS Basic

- Product/menu, POS, manual payment, cashier shift, dan basic sales report.

### Cafe Profile and Digital Storefront

- Profil brand/outlet, menu publik, status buka/tutup, dan sold-out.
- QR menuju profile dan QR unik per meja.

### Table and Self-Order

- Lantai, area opsional, meja, QR token, open/close table session, dan pindah meja.
- Table-layout editor per lantai dengan drag-and-drop snap-to-grid.
- Label, capacity, bentuk sederhana, posisi, ukuran grid, dan active state meja.
- POS table-layout view read-only dengan status meja realtime.
- Generate, print/download, revoke, dan rotate QR per meja.
- Guest menu, cart, variant, modifier, note, submit, dan pesan lagi.
- Guest hanya melihat identitas lantai/meja dari QR, bukan layout internal outlet.
- Customer melihat status pesanan dan meminta bill.
- Pilihan bayar di kasir, QRIS merchant, atau transfer merchant.
- Klaim sudah membayar tetap diverifikasi kasir.
- Beberapa batch order dalam satu table session/bill.

### KDS

- Pesanan POS dan QR pada antrean yang sama.
- New, accepted, preparing, ready, served, dan completed.
- Audio alert, elapsed time, note, table, source, dan riwayat hari berjalan.
- Satu KDS station per outlet.

### Reports tambahan

- Cashier order vs table QR order.
- Self-order count dan conversion.
- Order-to-accepted dan order-to-ready.
- Table-session summary.

## 3. Tidak termasuk

- Inventory/recipe dan automatic stock deduction.
- Finance Basic selain sales/cash-shift report.
- Integrated Payment dan automatic confirmation.
- Loyalty, Customer CRM, promotion engine, reservation, dan delivery.
- Multi-station kitchen/bar routing advanced.

## 4. Alur utama

```text
Manager membuka meja
→ Guest scan QR dan mengirim order
→ Order masuk antrean yang sama dengan POS
→ Staff/Kitchen menerima dan memproses
→ Guest dapat pesan lagi
→ Kasir menerima serta memverifikasi pembayaran manual
→ Table session ditutup
```

## 5. Business rules paket

- Scan QR tidak langsung membuktikan kehadiran; table session dan staff acceptance menjadi kontrol MVP.
- Guest tidak wajib membuat akun.
- Order dapur tidak boleh hilang ketika print gagal; KDS merupakan sumber utama.
- Payment manual tidak otomatis paid setelah customer menekan tombol sudah membayar.
- Satu table session dapat memiliki beberapa order batch namun satu bill.
- Menggeser posisi meja pada layout tidak memindahkan order atau table session.
- Table layout hanya memetakan meja; dinding, pintu, fasilitas, dekorasi, dan denah bangunan tidak termasuk.

## 6. Pricelist hipotesis

| Komponen | Harga |
|---|---:|
| Subscription bulanan | Rp399.000/outlet/bulan |
| Subscription tahunan | Rp3.990.000/outlet/tahun |
| Onboarding standar | Rp1.250.000/outlet |
| Outlet tambahan | Mengikuti harga per outlet |
| KDS device/station tambahan | Rp75.000/perangkat/bulan |
| POS device tambahan | Rp50.000/perangkat/bulan |
| Migrasi atau setup kompleks | Quotation |

Tidak ada platform fee per transaksi untuk manual payment. Subscription sudah mencakup penggunaan QR Self-Order pada outlet.

Onboarding standar mencakup satu outlet, maksimal 50 produk, maksimal 30 meja, table layout per lantai, satu POS, satu KDS, QR siap cetak, satu printer kompatibel, dan dua sesi pelatihan remote.

## 7. Batas pemakaian awal

- Satu POS dan satu KDS device termasuk.
- Maksimal 10 user aktif per outlet.
- Maksimal 30 meja pada onboarding standar.
- Table layout hanya berisi meja dengan bentuk dan ukuran sederhana pada logical grid.
- Satu KDS station; station tambahan merupakan add-on.

## 8. Acceptance criteria paket

- POS dan QR menghasilkan order pada antrean KDS yang sama.
- Guest dapat pesan lagi tanpa membuat bill baru.
- Kasir dapat memverifikasi manual QRIS sebelum menandai paid.
- Pindah meja tercatat dalam timeline.
- Owner dapat membuat beberapa lantai dan menyusun meja tanpa overlap.
- POS menampilkan posisi serta status meja sesuai lantai yang dipilih.
- QR aktif membuka meja yang benar dan QR revoked tidak dapat digunakan untuk order.
- Owner dapat membandingkan order cashier dan QR.

## 9. Upgrade path

Cafe Digital → Cafe Operations untuk recipe, stock, purchasing sederhana, expense, HPP, dan laba operasional.

## 10. Metric keberhasilan

- Persentase order dari QR meja.
- Self-order completion rate.
- Order-to-accepted dan order-to-ready.
- Pesanan yang ditolak/dibatalkan.
- Jumlah payment mismatch.
- Pengurangan beban pencatatan pesanan oleh staff.
