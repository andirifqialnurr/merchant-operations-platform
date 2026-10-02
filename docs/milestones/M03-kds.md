# M3 — Kitchen Display System

**Status:** Belum mulai
**Tahap PRD:** D (KDS)
**Bergantung pada:** M2 (event, inbox, binding, perangkat)

## 1. Tujuan

Dapur melihat antrean ticket dan menggerakkannya terima → siapkan → siap → sajikan. Ticket datang dari POS lewat event, dari input manual, atau dari API eksternal, dan ketiganya diproses oleh **satu use case yang sama**. KDS dapat dijual sendiri (KDS-only) maupun bersama POS.

## 2. Cakupan

**Termasuk:** station bawaan per outlet; ticket dan riwayat status; intake dari `order.submitted.v1`; pembatalan dari `order.canceled.v1`; ticket manual; status dapur kembali ke pesanan; realtime; mode kios; suara ticket baru.

**Tidak termasuk:** routing per station lanjutan dan beberapa station per produk (tier Pro, setelah R1); tiket untuk pesanan meja dan self-order (datang otomatis setelah M4 karena memakai event yang sama).

## 3. Kriteria selesai

- [ ] KDS-only: ticket manual berjalan penuh tanpa POS terpasang.
- [ ] POS + KDS: pesanan yang dikirim POS menjadi ticket dalam ≤5 detik (p99) tanpa duplikat walau event terkirim dua kali.
- [ ] Ticket manual, dari POS, dan dari API memakai use case `CreateKitchenTicket` yang sama.
- [ ] Pesanan yang dibatalkan menandai ticket batal; ticket tidak hilang.
- [ ] Layar KDS tidak menerima harga, HPP, pembayaran, atau telepon pelanggan (`security.md` 10.1).
- [ ] Putus koneksi menampilkan banner, lalu antrean diambil ulang saat tersambung.
- [ ] Terbaca dari jarak 1–2 meter, tombol ≥44 px, terang/gelap, `id`/`en`.

## 4. Task

### FT — Fitur produk

- [ ] **M3-FT-01 Antrean ticket** — terlama di awal; nomor/label pesanan, sumber, timer, item, modifier, catatan.
- [ ] **M3-FT-02 Alur status** — satu tombol per ticket untuk langkah sah berikutnya; riwayat ticket selesai hari ini.
- [ ] **M3-FT-03 Ticket manual** — label, item bebas, jumlah, catatan; untuk KDS-only.
- [ ] **M3-FT-04 Status dapur di POS** — daftar pesanan POS menampilkan "Disiapkan"/"Siap" dari event KDS.
- [ ] **M3-FT-05 Peringatan** — suara dan sorotan untuk ticket baru; volume dan bisu per perangkat.

### BE — Backend dan data

- [ ] **M3-BE-01 Tabel KDS** — `kds_stations`, `kds_tickets` (unik per sumber + referensi, tanpa FK ke pesanan), `kds_ticket_items` tanpa harga, `kds_ticket_status_history` append-only.
- [ ] **M3-BE-02 Use case `CreateKitchenTicket`** — idempotent per sumber; dipakai adapter event, HTTP manual, dan API.
- [ ] **M3-BE-03 Handler `order.submitted.v1`** — dipasang lewat binding POS → KDS; payload event memuat item tanpa harga.
- [ ] **M3-BE-04 Transisi status** — mesin status di domain; event `kitchen_ticket.started/ready/served.v1`.
- [ ] **M3-BE-05 Handler pembatalan** — `order.canceled.v1` menandai ticket batal.
- [ ] **M3-BE-06 Status kembali ke pesanan** — order intake menerima event KDS dan memperbarui status pemenuhan (`ACCEPTED`/`PREPARING`/`READY`/`SERVED`), terpisah dari status bayar.
- [ ] **M3-BE-07 Realtime** — Socket.IO per outlet dengan autentikasi sesi perangkat; klien mengambil ulang saat tersambung kembali.
- [ ] **M3-BE-08 API intake eksternal** — endpoint dengan kredensial integrasi dan rate limit (bila `OD-04` memilih API).

### UX — Alur dan interaksi

- [ ] **M3-UX-01 Shell KDS** — rute `(kds)`, layar penuh, mode kios, tanpa sidebar.
- [ ] **M3-UX-02 Tata letak** — kolom per status di layar lebar; daftar satu kolom di tablet potret.
- [ ] **M3-UX-03 Timer** — berubah warna saat mendekati dan melewati batas, tanpa berkedip.
- [ ] **M3-UX-04 Koneksi** — banner menyambung ulang dan data mungkin usang.

### DS — Design system dan komponen

- [ ] **M3-DS-01 Rapikan `KdsTicket`** — label lewat props, ukuran terbaca jarak jauh, tanpa harga.
- [ ] **M3-DS-02 Form ticket manual** — komponen input item cepat.
- [ ] **M3-DS-03 Varian kios** — skala tipografi dan jarak untuk layar dapur.

### AS — Aset

- [ ] **M3-AS-01 Suara notifikasi** — satu suara ticket baru dan satu suara gagal sambung, pendek, berlisensi bebas, ukuran kecil.

### SC — Keamanan dan privasi

- [ ] **M3-SC-01 Data guard KDS** — test respons dan payload realtime tanpa harga, pembayaran, atau telepon.
- [ ] **M3-SC-02 Sesi perangkat KDS** — hanya perangkat terdaftar outlet itu yang menerima antrean outlet.
- [ ] **M3-SC-03 Rate limit API intake.**

### QA — Kualitas kode dan test

- [ ] **M3-QA-01 Test satu use case banyak pintu** — manual, event, dan API menghasilkan ticket identik.
- [ ] **M3-QA-02 Test event ganda** — event yang sama dua kali menghasilkan satu ticket.
- [ ] **M3-QA-03 Test kombinasi** — KDS-only, POS-only, POS + KDS.

### OP — Operasional dan dokumentasi

- [ ] **M3-OP-01 Seed dan akun dapur** — akun Kitchen dan satu perangkat KDS lokal.
- [ ] **M3-OP-02 Perbarui dokumen** — `schema.md` B.5, `flowchart.md` 8, `architecture.md` 7.2.

## 5. Urutan checkpoint yang disarankan

1. M3-BE-01, M3-BE-02, M3-QA-01 (input manual dulu).
2. M3-BE-04, M3-UX-01, M3-UX-02, M3-DS-01, M3-FT-01, M3-FT-02, M3-FT-03, M3-DS-02.
3. M3-BE-03, M3-BE-05, M3-QA-02, M3-QA-03.
4. M3-BE-07, M3-UX-04, M3-SC-02.
5. M3-BE-06, M3-FT-04.
6. M3-UX-03, M3-DS-03, M3-AS-01, M3-FT-05.
7. M3-BE-08, M3-SC-03 (sesuai `OD-04`), M3-SC-01, M3-OP-01, M3-OP-02.

## 6. Referensi

`prd.md` 6.3–6.4 · `flowchart.md` 8 · `schema.md` B.5 · `architecture.md` 7 · `design-system.md` 19.4 · `design-system-modules.md` 8 · `security.md` 10.1.
