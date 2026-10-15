# M3 — Kitchen Display System

**Status:** Berjalan
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
- [x] Putus koneksi menampilkan banner, lalu antrean diambil ulang saat tersambung. _Diperiksa di browser 15 Oktober 2026 (TODO 14.14): API dimatikan dan dinyalakan lagi, perangkat dibuat offline lalu online._
- [ ] Terbaca dari jarak 1–2 meter, tombol ≥44 px, terang/gelap, `id`/`en`.

## 4. Task

### FT — Fitur produk

- [x] **M3-FT-01 Antrean ticket** `f0e9d9b` — terlama di awal; nomor/label pesanan, sumber, timer, item, modifier, catatan. Selesai 13 Oktober 2026 (TODO 14.9).
- [x] **M3-FT-02 Alur status** `f0e9d9b` — satu tombol per ticket untuk langkah sah berikutnya; riwayat ticket selesai hari ini. Selesai 13 Oktober 2026 (TODO 14.9). Riwayat: tab 'Selesai hari ini'.
- [x] **M3-FT-03 Ticket manual** `66045fa` — label, item bebas, jumlah, catatan; untuk KDS-only. Selesai 13 Oktober 2026 (TODO 14.10).
- [x] **M3-FT-04 Status dapur di POS** `4a80c10` — daftar pesanan POS menampilkan "Disiapkan"/"Siap" dari event KDS. Selesai 13 Oktober 2026 (TODO 14.12). Daftar belum memperbarui diri sendiri; status terlihat saat daftar dibuka atau dimuat ulang.
- [ ] **M3-FT-05 Peringatan** — suara dan sorotan untuk ticket baru; volume dan bisu per perangkat.

### BE — Backend dan data

- [x] **M3-BE-01 Tabel KDS** `109af0c` — `kds_stations`, `kds_tickets` (unik per sumber + referensi, tanpa FK ke pesanan), `kds_ticket_items` tanpa harga, `kds_ticket_status_history` append-only. Selesai 12 Oktober 2026 (migrasi `20261012030000_kds_tickets`; TODO 14.6). Ditambah di luar daftar kolom awal: `is_default` pada station, `accepted_at`/`served_at`/`canceled_at` pada ticket, dan `position` pada item.
- [x] **M3-BE-02 Use case `CreateKitchenTicket`** `109af0c` — idempotent per sumber; dipakai adapter event, HTTP manual, dan API. Selesai 12 Oktober 2026 (`modules/kds/application/create-kitchen-ticket.ts`; TODO 14.6). Baru pintu HTTP manual yang memanggilnya; adapter event dan API menyusul di M3-BE-03 dan M3-BE-08.
- [x] **M3-BE-03 Handler `order.submitted.v1`** `0a08380` — dipasang lewat binding POS → KDS; payload event memuat item tanpa harga. Selesai 13 Oktober 2026 (TODO 14.11). **Berbeda dari rencana:** payload event tidak ditambah item. `security.md` 10 melarang teks bebas di event, sedangkan dapur butuh catatan item; handler membaca pesanan dari pemiliknya lewat ID melalui port `KITCHEN_ORDER_SOURCE`, yang bentuknya tidak punya field harga.
- [x] **M3-BE-04 Transisi status** `a832842` — mesin status di domain; event `kitchen_ticket.started/ready/served.v1`. Selesai 12 Oktober 2026 (TODO 14.7). `POST /kds/tickets/:id/advance` dan `GET /kds/tickets/finished`. Menerima ticket (`NEW` → `ACCEPTED`) tidak mengumumkan event; tiga langkah lainnya mengumumkan.
- [x] **M3-BE-05 Handler pembatalan** `0a08380` — `order.canceled.v1` menandai ticket batal. Selesai 13 Oktober 2026 (TODO 14.11). Ticket yang sudah disajikan tidak diubah.
- [x] **M3-BE-06 Status kembali ke pesanan** `4a80c10` — order intake menerima event KDS dan memperbarui status pemenuhan (`ACCEPTED`/`PREPARING`/`READY`/`SERVED`), terpisah dari status bayar. Selesai 13 Oktober 2026 (TODO 14.12). `PREPARING`, `READY`, dan `SERVED` mengikuti event dapur. `ACCEPTED` tidak diisi: dapur tidak mengumumkan 'diterima' karena katalog event tidak punya event untuk itu.
- [x] **M3-BE-07 Realtime** — Socket.IO per outlet dengan autentikasi sesi perangkat; klien mengambil ulang saat tersambung kembali. Selesai 15 Oktober 2026 (TODO 14.14). Namespace `/kds` di jalur `/api/realtime`. Trigger `kds_tickets_notify_queue` mengirim `pg_notify` setiap ticket dibuat atau berubah status, dari API maupun worker; API meneruskannya ke ruang `workspace:outlet`. Pesan hanya `{ outletId }`; layar mengambil ulang lewat REST saat menerima pesan dan setiap tersambung (ulang).
- [ ] **M3-BE-08 API intake eksternal** — endpoint dengan kredensial integrasi dan rate limit (bila `OD-04` memilih API).

### UX — Alur dan interaksi

- [x] **M3-UX-01 Shell KDS** `f0e9d9b` — rute `(kds)`, layar penuh, mode kios, tanpa sidebar. Selesai 13 Oktober 2026 (TODO 14.9). Mode kios memakai layar penuh browser lewat tombol di bar atas; belum diuji di perangkat dapur sungguhan.
- [x] **M3-UX-02 Tata letak** `f0e9d9b` — kolom per status di layar lebar; daftar satu kolom di tablet potret. Selesai 13 Oktober 2026 (TODO 14.9). Papan empat kolom mulai lebar 1024px; di bawahnya satu daftar, terlama di awal.
- [ ] **M3-UX-03 Timer** — berubah warna saat mendekati dan melewati batas, tanpa berkedip.
- [x] **M3-UX-04 Koneksi** — banner menyambung ulang dan data mungkin usang. Selesai 15 Oktober 2026 (TODO 14.14). 'Menyambung ulang…' atau 'Perangkat offline' + 'Ticket di layar mungkin belum terbaru.' dengan tombol 'Muat ulang'. Hilang sendiri setelah tersambung dan antrean diambil ulang.

### DS — Design system dan komponen

- [x] **M3-DS-01 Rapikan `KdsTicket`** `888bdec` — label lewat props, ukuran terbaca jarak jauh, tanpa harga. Selesai 12 Oktober 2026 (TODO 14.8). `KdsNewTicketAlert` dan `KdsConnectionStatus` di file yang sama masih berisi teks tertanam; dirapikan saat dipakai (M3-FT-05, M3-UX-04).
- [x] **M3-DS-02 Form ticket manual** `66045fa` — komponen input item cepat. Selesai 13 Oktober 2026 (TODO 14.10): `QuickItemEntry` (`@merchant/ui/quick-item-entry`).
- [ ] **M3-DS-03 Varian kios** — skala tipografi dan jarak untuk layar dapur.

### AS — Aset

- [ ] **M3-AS-01 Suara notifikasi** — satu suara ticket baru dan satu suara gagal sambung, pendek, berlisensi bebas, ukuran kecil.

### SC — Keamanan dan privasi

- [ ] **M3-SC-01 Data guard KDS** — test respons dan payload realtime tanpa harga, pembayaran, atau telepon.
- [x] **M3-SC-02 Sesi perangkat KDS** — hanya perangkat terdaftar outlet itu yang menerima antrean outlet. Selesai 15 Oktober 2026 (TODO 14.14). Berlaku untuk **realtime**: hanya sesi yang dibuka di layar dapur aktif outlet itu, oleh orang yang boleh melihat antrean, yang menerima pembaruan; izin diperiksa ulang tiap 60 detik. Akun berizin di browser biasa tetap membaca antrean lewat REST (dibaca ulang tiap 4 detik), seperti sebelumnya.
- [ ] **M3-SC-03 Rate limit API intake.**

### QA — Kualitas kode dan test

- [ ] **M3-QA-01 Test satu use case banyak pintu** — manual, event, dan API menghasilkan ticket identik. _Sebagian (13 Oktober 2026):_ pintu manual dan pintu event sudah dibuktikan menghasilkan ticket yang sama lewat use case yang sama (TODO 14.6, 14.11). Pintu API belum ada (M3-BE-08, menunggu `OD-04`).
- [x] **M3-QA-02 Test event ganda** `0a08380` — event yang sama dua kali menghasilkan satu ticket. Selesai 13 Oktober 2026 (TODO 14.11).
- [x] **M3-QA-03 Test kombinasi** `0a08380` — KDS-only, POS-only, POS + KDS. Selesai 13 Oktober 2026 (TODO 14.11): `kds-order-flow.integration.test.mjs`.

### OP — Operasional dan dokumentasi

- [x] **M3-OP-01 Seed dan akun dapur** `dc96233` — akun Kitchen dan satu perangkat KDS lokal. Selesai 13 Oktober 2026 (TODO 14.13): `pnpm --filter @merchant/api local:users:provision`.
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
