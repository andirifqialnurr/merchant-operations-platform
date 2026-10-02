# M5 — Inventory

**Status:** Belum mulai
**Tahap PRD:** F (Inventory)
**Bergantung pada:** M2 (dapat dikerjakan sejajar dengan M3–M4)

## 1. Tujuan

Outlet mencatat stok bahan dan barang: penerimaan, penyesuaian, waste, transfer antarlokasi, dan opname, dengan saldo yang selalu bisa ditelusuri ke mutasinya. Bila terhubung dengan POS, stok berkurang otomatis sesuai resep. Inventory juga dapat dipakai sendiri tanpa Catalog.

## 2. Cakupan

**Termasuk:** satuan dan konversi; item; pemasok; lokasi stok; mutasi append-only dan pembalikan; saldo projection; opname; transfer; penerimaan pembelian sederhana; resep per produk/varian; konsumsi dari penjualan; pembalikan konsumsi saat refund.

**Tidak termasuk:** batch, kedaluwarsa, forecast, central kitchen, purchase order dengan persetujuan (setelah R1).

## 3. Kriteria selesai

- [ ] Inventory-only: penerimaan, penyesuaian, waste, transfer, dan opname berjalan tanpa Catalog terpasang.
- [ ] Mutasi tidak dapat diubah atau dihapus; koreksi selalu lewat mutasi baru; saldo tidak dapat diedit langsung.
- [ ] POS + Inventory: penjualan mengurangi stok sesuai resep pada titik potong yang dikonfigurasi, sekali saja walau event berulang.
- [ ] Refund dan pembatalan membalik konsumsi.
- [ ] Opname final mengubah selisih menjadi penyesuaian dengan alasan.
- [ ] Jumlah memakai presisi satuan, tanpa floating point untuk nilai uang.

## 4. Task

### FT — Fitur produk

- [ ] **M5-FT-01 Item dan satuan** — item dengan satuan dasar, konversi, stok minimum.
- [ ] **M5-FT-02 Daftar stok** — saldo per lokasi, status stok rendah; sheet item berisi saldo, riwayat mutasi, resep.
- [ ] **M5-FT-03 Penerimaan barang** — pemasok opsional, baris item, jumlah, harga beli.
- [ ] **M5-FT-04 Penyesuaian dan waste** — alasan wajib, pratinjau saldo sesudah, peringatan saldo negatif sesuai kebijakan.
- [ ] **M5-FT-05 Transfer** — lokasi asal ke tujuan, status kirim dan terima.
- [ ] **M5-FT-06 Opname** — mulai, isi jumlah hitung, simpan draft, finalisasi dengan konfirmasi.
- [ ] **M5-FT-07 Resep** — bahan per produk atau varian.
- [ ] **M5-FT-08 Pengaturan titik potong** — saat pesanan diterima atau saat penjualan selesai (`OD-05`).
- [ ] **M5-FT-09 Pemasok** — daftar sederhana.

### BE — Backend dan data

- [ ] **M5-BE-01 Tabel inventory** — schema B.6 lengkap dengan constraint dan indeks.
- [ ] **M5-BE-02 Mutasi dan pembalikan** — satu use case pencatatan mutasi untuk semua tipe; `reverses_movement_id`; event `stock.movement_recorded.v1`.
- [ ] **M5-BE-03 Saldo projection** — diperbarui dalam transaksi yang sama; dapat dibangun ulang dari mutasi.
- [ ] **M5-BE-04 Opname dan transfer** — lifecycle draft → final.
- [ ] **M5-BE-05 Resep** — dengan konversi satuan.
- [ ] **M5-BE-06 Handler konsumsi** — `sale.completed.v1` atau `order.accepted.v1` sesuai titik potong; `sale.refunded.v1` dan `order.cancelled.v1` membalik; idempotent per sumber.
- [ ] **M5-BE-07 Impor item** — CSV item dan saldo awal dengan validasi dan laporan baris gagal.

### UX — Alur dan interaksi

- [ ] **M5-UX-01 Halaman Stok di Backoffice** — tab Item, Mutasi, Opname, Transfer, Pemasok sesuai pola halaman.
- [ ] **M5-UX-02 Form cepat di HP** — penerimaan dan waste dapat dicatat dari layar kecil.
- [ ] **M5-UX-03 State Inventory-only** — label tanpa istilah menu bila Catalog tidak terpasang.

### DS — Design system dan komponen

- [ ] **M5-DS-01 Rapikan komponen inventory** — `InventoryItemUnit`, `InventoryStock`, `InventoryOperations`, `InventoryOrderFlow`, `RecipeBom`.
- [ ] **M5-DS-02 Form penerimaan, transfer, pemasok** (design-system 21.2, P2).
- [ ] **M5-DS-03 Input jumlah dengan satuan** — presisi mengikuti satuan.

### AS — Aset

- [ ] **M5-AS-01 Template CSV impor** — contoh berkas dua bahasa untuk item dan saldo awal.

### SC — Keamanan dan privasi

- [ ] **M5-SC-01 Harga beli dan HPP** — hanya peran berizin; tidak dikirim ke POS atau KDS.
- [ ] **M5-SC-02 Audit penyesuaian** — alasan dan pelaku wajib.

### QA — Kualitas kode dan test

- [ ] **M5-QA-01 Test saldo** — saldo projection = jumlah mutasi; pembangunan ulang menghasilkan saldo sama.
- [ ] **M5-QA-02 Test konsumsi idempotent** — event ganda tidak mengurangi stok dua kali; refund membalik tepat.
- [ ] **M5-QA-03 Test Inventory-only.**

### OP — Operasional dan dokumentasi

- [ ] **M5-OP-01 Seed bahan dan resep** — bahan kopi, susu, gula, dan resep untuk menu seed M1.
- [ ] **M5-OP-02 Perbarui dokumen** — `schema.md` B.6, `flowchart.md` 9.

## 5. Urutan checkpoint yang disarankan

1. M5-BE-01, M5-FT-01, M5-FT-09.
2. M5-BE-02, M5-BE-03, M5-QA-01, M5-FT-03, M5-FT-04, M5-SC-02.
3. M5-UX-01, M5-DS-01, M5-DS-03, M5-FT-02, M5-UX-03, M5-QA-03.
4. M5-BE-04, M5-DS-02, M5-FT-05, M5-FT-06.
5. M5-BE-05, M5-FT-07, M5-FT-08, M5-BE-06, M5-QA-02, M5-SC-01.
6. M5-BE-07, M5-AS-01, M5-UX-02, M5-OP-01, M5-OP-02.

## 6. Referensi

`prd.md` 6.3–6.4 · `flowchart.md` 9 · `schema.md` B.6 · `design-system-modules.md` 9 · `architecture.md` 7.2.
