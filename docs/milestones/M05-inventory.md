# M5 — Inventory

**Status:** Berjalan — pengguna menerima M4 dan menginstruksikan lanjut M5 setelah baseline `6129b5b`. M5-BE-01A dan B1 (enam schema master/guard database) selesai teknis/terverifikasi; B2a query unit/conversion berizin juga selesai teknis/terverifikasi; B2b1 create unit transaksional berizin kini juga selesai teknis/terverifikasi; prasyarat B2b2a dimensi satuan eksplisit juga selesai teknis/terverifikasi; berikutnya B2b2b create direct conversion sebelum endpoint. Migrasi B1 hanya diuji pada PostgreSQL disposable; belum diterapkan ke development, belum API/UI/ledger Inventory. Review M2/M3 dan uji printer fisik tidak dianggap selesai oleh penerimaan M4.
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
- [ ] **M5-FT-08 Pengaturan titik potong** — `ORDER_ACCEPTED` (default F&B), `PRODUCTION_STARTED`, atau `SALE_COMPLETED` sesuai PRD §15.4; konfigurasi `OD-05` ditetapkan sebelum integrasi, bukan dipilih diam-diam pada fondasi master.
- [ ] **M5-FT-09 Pemasok** — daftar sederhana.

### BE — Backend dan data

- [~] **M5-BE-01 Tabel inventory** — schema B.6 lengkap dengan constraint dan indeks; dipecah agar tiap checkpoint bounded dan pushable.
  - [x] **M5-BE-01A Fondasi satuan/jumlah** `89ba34f` (dipush) — kontrak strict, presisi desimal dan konversi bigint eksak sebelum persistence; 10 domain/6 contracts baru, root gates dan build API/web lulus. [Kontrak/bukti/batas](./M05-fondasi-satuan.md#6-bukti-dan-batas-checkpoint-a); implementasi diverifikasi dan dipush ke `origin/main`. Belum migration/API/JSX, bukan penyelesaian seluruh B.6.
  - [~] **M5-BE-01B Master inventory** — kontrak/schema/persistence unit/conversion/item/category/supplier/stock location, owner/scope/FK/unik/izin/limit dan migrasi disposable; belum selesai hanya dari DDL.
    - [x] **M5-BE-01B1 Schema/guard master** `f3f7e5f` (dipush) — enam model/DDL dengan FK komposit, CI scoped uniqueness, numeric tanpa typmod + CHECK presisi/rentang, latch definisi unit aman terhadap race/upsert, retention; 5 static tests baru, 12 test PostgreSQL master (termasuk induk), 55 integrasi penuh, root gates dan build API/web lulus. [Bukti/batas](./M05-master-inventory.md#5-bukti-b1). Implementasi diverifikasi dan dipush ke `origin/main`; tidak ada repository/use case/API/aktivasi/izin/limit yang diklaim selesai.
    - [~] **M5-BE-01B2 Akses master berizin** — belum selesai hanya dari query; resource lain serta command/error/audit/idempotency/permission/parent/compatibility/LimitGate yang relevan tetap wajib sebelum endpoint.
      - [x] **M5-BE-01B2a Query unit/conversion** `8ccf52f` (dipush) — contracts/reader/dua query berizin, fresh access dan tenant scope, exact factor, bounded keyset dan DTO sempit; 4 contracts + 11 source tests baru, 7 PostgreSQL query tests (termasuk induk), 62 integrasi penuh, root gates/build API/web lulus. [Bukti/batas](./M05-master-inventory.md#7-bukti-b2a); implementasi diverifikasi dan dipush ke `origin/main`. Belum registrasi runtime/grant/API/UI atau command tulis.
      - [~] **M5-BE-01B2b Command unit/conversion** — belum selesai hanya dari create unit; parent/compatibility conversion, update/lifecycle dan master lain tetap checkpoint berikutnya sebelum endpoint.
        - [x] **M5-BE-01B2b1 Create unit** `fcc5c2f` (dipush) — permission master tersendiri untuk default Owner/Manager + all-outlet/Backoffice scope; unit/audit/replay atomik, CI conflict dan fail-closed result; 12 source tests baru, 12 PostgreSQL create tests (termasuk induk), 74 integrasi penuh/root gates/build API/web lulus. [Bukti/batas](./M05-pembuatan-satuan.md#4-bukti-b2b1); implementasi diverifikasi dan dipush ke `origin/main`. Migrasi permission hanya disposable, belum AppModule/manifest/HTTP/UI.
        - [~] **M5-BE-01B2b2 Create direct conversion** — parent/ownership/compatibility, factor exact, transaksi/audit/idempotency dan conflict mapping, tanpa menyimpulkan inverse/path atau mengubah mutasi historis. Tidak membuka JSX/rute.
          - [x] **B2b2a Dimensi satuan** — prasyarat yang disetujui pengguna setelah `ddfe279`: dimensi eksplisit, legacy unknown tanpa tebakan, immutability, create/read existing dan predicate; 3 contracts + 6 source tests baru, 7 PostgreSQL baru/81 integrasi penuh, root gates/Prisma/build API/web lulus. [Bukti/batas](./M05-dimensi-satuan.md#4-bukti-dan-batas). Selesai teknis/terverifikasi; commit/push dicatat sesudah gate akhir. Belum writer/guard compatibility conversion atau migrasi development.
          - [ ] **B2b2b Create conversion transaksional** — parent scoped/stabil, dimensi sama/diketahui, factor eksak, audit/replay dan conflict mapping; tetap tanpa inverse/path otomatis.
  - [ ] **M5-BE-01C Tabel operasional** — ledger/projection, receipt, stocktake/transfer, recipe dan constraint sesuai checkpoint transaksi terkait; tidak mengklaim seluruh schema tersedia dari master saja.
- [ ] **M5-BE-02 Mutasi dan pembalikan** — satu use case pencatatan mutasi untuk semua tipe; `reverses_movement_id`; event `stock.movement_recorded.v1`.
- [ ] **M5-BE-03 Saldo projection** — diperbarui dalam transaksi yang sama; dapat dibangun ulang dari mutasi.
- [ ] **M5-BE-04 Opname dan transfer** — lifecycle draft → final.
- [ ] **M5-BE-05 Resep** — dengan konversi satuan.
- [ ] **M5-BE-06 Handler konsumsi** — `sale.completed.v1`, `order.accepted.v1` atau `kitchen_ticket.started.v1` sesuai PRD §15.4/titik potong; `sale.refunded.v1` dan `order.cancelled.v1` membalik; idempotent per sumber.
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
