# PRD - MVP Release 1: Operasional Kafe Basic

**Status:** Draft untuk validasi pilot  
**Target release:** Release pertama  
**Payment model:** Manual payment  
**Commercial coverage:** Menjadi fondasi seluruh paket awal

## 1. Tujuan

MVP harus menggantikan proses kasir dasar sekaligus menyelesaikan pain point pemesanan QR meja dan pemetaan meja per lantai, tanpa menunggu integrasi payment gateway.

MVP dianggap selesai ketika satu kafe dapat menjalankan alur berikut:

```text
Platform membuat tenant
→ Owner mengatur outlet, menu, lantai, layout meja, staff, dan pembayaran
→ Kasir atau pelanggan membuat pesanan
→ Dapur menerima dan menyelesaikan pesanan
→ Kasir mengonfirmasi pembayaran manual
→ Stok bahan berkurang
→ Penjualan, pengeluaran, dan estimasi laba dapat dilihat
→ Platform mengelola paket dan subscription merchant
```

## 2. Pengguna

- Platform Super Admin.
- Platform Finance/Support.
- Merchant Owner.
- Outlet Manager.
- Cashier.
- Kitchen.
- Inventory Staff.
- Finance Staff.
- Consumer/Guest.

## 3. Ruang lingkup wajib

### 3.1 Platform Owner Master

- Dashboard tenant, outlet, user, transaction usage, dan subscription.
- CRUD tenant, brand, dan outlet.
- Package/module master dan entitlement tenant.
- Trial, active, grace period, suspended, dan terminated.
- Subscription invoice manual dan konfirmasi transfer.
- Support notes dan support access yang diaudit.
- Aktivasi/nonaktifkan tenant, outlet, user owner, dan modul.

### 3.2 Merchant Core

- Tenant, satu brand default, dan multi-outlet.
- Outlet profile, jam operasional, tax, service charge, dan payment methods.
- User, role, permission, outlet assignment, dan manager approval PIN.
- Audit log untuk tindakan sensitif.

### 3.3 Product/Menu

- Category, product, image, description, price, variant, dan modifier.
- Product availability dan sold-out manual.
- Product/outlet assignment dan outlet price override.
- Recipe link untuk produk yang memakai inventory.

### 3.4 POS

- Dine-in dan takeaway.
- Product search, cart, modifier, note, discount sederhana, tax, dan service charge.
- Pilih meja melalui list atau layout lantai, hold, cancel dengan alasan, manager approval, dan reprint.
- Manual payment: cash, merchant QRIS, transfer, EDC, dan other.
- Open/close shift, opening cash, cash in/out, counted cash, dan variance.

### 3.5 Order and Table

- Order source: cashier, table QR, dan waiter.
- Status: draft, submitted, accepted, preparing, ready, served, completed, cancelled.
- Payment status terpisah dari order status.
- Floor/lantai, area opsional, table, QR token, open/close session, pindah meja, dan beberapa order batch.
- Backoffice table-layout editor per lantai dengan drag-and-drop snap-to-grid.
- Meja memiliki label, capacity, bentuk sederhana, grid position, grid size, active state, dan QR mapping.
- POS menampilkan table layout read-only beserta status meja realtime.
- Generate, print/download, revoke, dan rotate QR token per meja.
- Satu table session ditutup menjadi satu bill.

### 3.6 Cafe Profile and QR Self-Order

- Brand/outlet profile, address, maps link, hours, contact, menu, dan sold-out status.
- Guest scan QR, melihat menu, memilih variant/modifier, note, cart, dan submit.
- Guest hanya melihat konteks outlet/lantai/meja dari QR dan tidak melihat table-layout internal.
- Guest dapat pesan lagi dan melihat status.
- Payment option: bayar di kasir, QRIS merchant, atau transfer.
- Klaim “sudah membayar” masuk status verifying; kasir tetap memverifikasi.

### 3.7 Kitchen Display System

- New order notification.
- Accepted, preparing, ready, served/completed.
- Table/order/source/note visibility.
- Audio alert, elapsed time, reconnect, dan riwayat hari berjalan.
- Satu KDS station per outlet pada MVP.

### 3.8 Inventory Basic

- Ingredient/item, category, unit, conversion dasar, supplier, dan minimum stock.
- Recipe/BOM per menu.
- Opening stock, stock in/out, adjustment, opname, waste, dan transfer outlet.
- Pembelian dan penerimaan sederhana.
- Auto-consumption berdasarkan order yang diproses.
- Cancellation reversal sebelum produksi dan waste setelah produksi.
- Estimasi HPP berdasarkan recipe dan biaya bahan yang dipilih secara konsisten.

### 3.9 Finance Basic

- Sales revenue otomatis dari transaksi.
- Other income dan operational expense manual.
- Expense category dan attachment opsional.
- Cashbook dan shift reconciliation.
- Rekap payment method dan rekonsiliasi manual.
- Estimasi HPP, gross profit, operational expense, dan operating profit.
- Report per outlet dan consolidated tenant.

### 3.10 Reports

- Sales harian/mingguan/bulanan.
- Sales per outlet, product, category, cashier, channel, dan payment method.
- Void, cancel, refund, discount, tax, dan service charge.
- Stock, movement, low stock, waste, purchase, dan estimated HPP.
- Income, expense, gross profit, operating profit, dan shift variance.
- Self-order usage untuk kebutuhan subscription/analisis.

### 3.11 Device, Printer, and Audit

- POS/KDS device registration sederhana.
- Printer configuration, test print, reprint marker, dan print fallback.
- Audit untuk price, floor/table layout, QR rotation/revocation, stock, cancel, refund, payment confirmation, shift, role, dan entitlement.

## 4. Business rules utama

1. Seluruh data merchant memiliki scope tenant dan outlet yang benar.
2. Customer satu tenant tidak boleh terlihat tenant lain.
3. Manual QRIS tidak otomatis berstatus paid.
4. Hanya kasir/manager berizin yang dapat mengonfirmasi payment.
5. Order, payment, table session, stock movement, dan finance entry memiliki status terpisah.
6. Record transaksi tidak dihapus permanen.
7. Order cancellation menghasilkan reversal atau waste sesuai status produksi.
8. Modul dinonaktifkan oleh entitlement di backend dan antarmuka.
9. Finance Basic selalu diberi label estimasi dan bukan accounting formal.
10. Mengubah posisi meja pada layout tidak memindahkan order atau table session.
11. Satu QR token aktif hanya memetakan satu tenant, outlet, dan meja; token yang dicabut tidak dapat membuat order.

## 5. Di luar ruang lingkup MVP

- Dynamic QRIS dan payment gateway.
- Automatic settlement, split fee, dan refund gateway.
- Full offline synchronization.
- Multi-station KDS advanced.
- Loyalty, membership, campaign, dan promotion engine advanced.
- Purchase approval, batch, expiry, forecasting, dan central kitchen.
- General ledger, journal, balance sheet, tax, dan accounting formal.
- Reservation, delivery, marketplace, franchise, dan public API.
- Native Android/iOS app.
- Editor denah bangunan termasuk dinding, pintu, jendela, bar, dekorasi, background image, dan rotasi objek bebas.

## 6. Non-functional requirements minimum

- Mobile-friendly customer web.
- POS dan backoffice responsif untuk tablet/desktop.
- Tenant isolation diuji.
- Role dan permission diuji untuk tindakan sensitif.
- Audit log tidak dapat diubah pengguna merchant biasa.
- Backup terjadwal dan prosedur restore.
- Idempotency untuk submit order/payment confirmation yang rawan double-click.
- Indikator koneksi dan retry pada KDS.
- Error monitoring dan basic operational log.
- Table-layout editor minimum tablet-landscape/desktop; POS layout view tetap responsif pada tablet.
- Layout menggunakan logical grid agar posisi tidak bergantung pada resolusi perangkat.

## 7. Acceptance criteria release

- Platform dapat membuat dua tenant dan membuktikan data keduanya terisolasi.
- Satu tenant dapat memiliki minimal dua outlet dan owner melihat laporan gabungan.
- Kasir dapat menyelesaikan order cash dan manual QRIS.
- Guest dapat scan QR, order, pesan lagi, dan melihat status.
- Owner dapat membuat lebih dari satu lantai, menyusun meja pada tiap lantai, dan melihat layout yang sama di POS.
- QR yang dicetak membuka outlet dan meja yang benar; QR yang dicabut ditolak.
- Posisi meja tetap tersimpan setelah reload dan meja tidak dapat saling overlap.
- Kitchen menerima order dari POS dan QR pada antrean yang sama.
- Order menu ber-recipe menghasilkan stock movement yang dapat diaudit.
- Pembatalan sebelum/sesudah produksi mengikuti reversal/waste rule.
- Owner dapat melihat sales, expense, HPP, gross profit, dan operating profit basic.
- Platform dapat mengaktifkan paket berbeda dan backend menolak modul nonaktif.
- Shift kasir dapat ditutup dengan nilai expected cash dan variance.

## 8. Metric pilot

- Minimal 95% order merchant pilot dicatat melalui sistem.
- Tidak ada kebocoran data lintas tenant.
- Persentase self-order berhasil diselesaikan.
- Median waktu order-to-accepted dan order-to-ready.
- Jumlah manual payment mismatch.
- Stock adjustment dan waste per periode.
- Selisih shift kasir.
- Jumlah support issue per 100 transaksi.
- Kesediaan merchant melanjutkan subscription setelah pilot.

## 9. Hubungan dengan paket

MVP membangun seluruh kemampuan yang diperlukan paket Profile, POS Basic, Cafe Digital, dan Cafe Operations. Entitlement menentukan subset yang terlihat dan dapat digunakan merchant; bukan deployment atau aplikasi terpisah.
