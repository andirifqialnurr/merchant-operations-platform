# M3 — Kitchen Display System

**Status:** Berjalan — semua 29 task selesai 16 Oktober 2026; menunggu review pengguna
**Tahap PRD:** D (KDS)
**Bergantung pada:** M2 (event, inbox, binding, perangkat)

## 1. Tujuan

Dapur melihat antrean ticket dan menggerakkannya terima → siapkan → siap → sajikan. Ticket datang dari POS lewat event, dari input manual, atau dari API eksternal, dan ketiganya diproses oleh **satu use case yang sama**. KDS dapat dijual sendiri (KDS-only) maupun bersama POS.

## 2. Cakupan

**Termasuk:** station bawaan per outlet; ticket dan riwayat status; intake dari `order.submitted.v1`; pembatalan dari `order.canceled.v1`; ticket manual; status dapur kembali ke pesanan; realtime; mode kios; suara ticket baru.

**Tidak termasuk:** routing per station lanjutan dan beberapa station per produk (tier Pro, setelah R1); tiket untuk pesanan meja dan self-order (datang otomatis setelah M4 karena memakai event yang sama).

## 3. Kriteria selesai

- [x] KDS-only: ticket manual berjalan penuh tanpa POS terpasang. _Integration `kds-order-flow` (KDS-only) dan browser (TODO 14.10, 14.11)._
- [x] POS + KDS: pesanan yang dikirim POS menjadi ticket dalam ≤5 detik (p99) tanpa duplikat walau event terkirim dua kali. _Integration `kds-latency`: 200 pesanan, p99 1,29 detik (satu mesin, worker dengan jeda 1 detik seperti produksi); event ganda: M3-QA-02 (TODO 14.23)._
- [x] Ticket manual, dari POS, dan dari API memakai use case `CreateKitchenTicket` yang sama. _Dibuktikan oleh M3-QA-01 (TODO 14.22)._
- [x] Pesanan yang dibatalkan menandai ticket batal; ticket tidak hilang. _M3-BE-05 (TODO 14.11)._
- [x] Layar KDS tidak menerima harga, HPP, pembayaran, atau telepon pelanggan (`security.md` 10.1). _Dibuktikan oleh test M3-SC-01 (TODO 14.19)._
- [x] Putus koneksi menampilkan banner, lalu antrean diambil ulang saat tersambung. _Diperiksa di browser 15 Oktober 2026 (TODO 14.14): API dimatikan dan dinyalakan lagi, perangkat dibuat offline lalu online._
- [ ] Terbaca dari jarak 1–2 meter, tombol ≥44 px, terang/gelap, `id`/`en`. _Tombol 56 px (64 px di mode kios), terang/gelap, dan `id`/`en` sudah diperiksa di browser; keterbacaan dari 1–2 meter perlu dicek di monitor dapur sungguhan._

## 4. Task

### FT — Fitur produk

- [x] **M3-FT-01 Antrean ticket** `f0e9d9b` — terlama di awal; nomor/label pesanan, sumber, timer, item, modifier, catatan. Selesai 13 Oktober 2026 (TODO 14.9).
- [x] **M3-FT-02 Alur status** `f0e9d9b` — satu tombol per ticket untuk langkah sah berikutnya; riwayat ticket selesai hari ini. Selesai 13 Oktober 2026 (TODO 14.9). Riwayat: tab 'Selesai hari ini'.
- [x] **M3-FT-03 Ticket manual** `66045fa` — label, item bebas, jumlah, catatan; untuk KDS-only. Selesai 13 Oktober 2026 (TODO 14.10).
- [x] **M3-FT-04 Status dapur di POS** `4a80c10` — daftar pesanan POS menampilkan "Disiapkan"/"Siap" dari event KDS. Selesai 13 Oktober 2026 (TODO 14.12). Daftar belum memperbarui diri sendiri; status terlihat saat daftar dibuka atau dimuat ulang.
- [x] **M3-FT-05 Peringatan** `7e3cce3` — suara dan sorotan untuk ticket baru; volume dan bisu per perangkat. Selesai 15 Oktober 2026 (TODO 14.18). Ticket yang masuk selama layar terbuka berbunyi sekali per kedatangan dan diberi cincin tetap selama 30 detik. Bisu dan volume (pelan/sedang/keras) di tombol suara pada toolbar, disimpan di browser perangkat itu. Bila browser menahan suara sebelum ada ketukan, muncul 'Suara belum aktif' dengan tombol 'Nyalakan suara'. Koneksi realtime yang putus berbunyi sekali. `KdsNewTicketAlert` dihapus dari bank komponen.

### BE — Backend dan data

- [x] **M3-BE-01 Tabel KDS** `109af0c` — `kds_stations`, `kds_tickets` (unik per sumber + referensi, tanpa FK ke pesanan), `kds_ticket_items` tanpa harga, `kds_ticket_status_history` append-only. Selesai 12 Oktober 2026 (migrasi `20261012030000_kds_tickets`; TODO 14.6). Ditambah di luar daftar kolom awal: `is_default` pada station, `accepted_at`/`served_at`/`canceled_at` pada ticket, dan `position` pada item.
- [x] **M3-BE-02 Use case `CreateKitchenTicket`** `109af0c` — idempotent per sumber; dipakai adapter event, HTTP manual, dan API. Selesai 12 Oktober 2026 (`modules/kds/application/create-kitchen-ticket.ts`; TODO 14.6). Baru pintu HTTP manual yang memanggilnya; adapter event dan API menyusul di M3-BE-03 dan M3-BE-08.
- [x] **M3-BE-03 Handler `order.submitted.v1`** `0a08380` — dipasang lewat binding POS → KDS; payload event memuat item tanpa harga. Selesai 13 Oktober 2026 (TODO 14.11). **Berbeda dari rencana:** payload event tidak ditambah item. `security.md` 10 melarang teks bebas di event, sedangkan dapur butuh catatan item; handler membaca pesanan dari pemiliknya lewat ID melalui port `KITCHEN_ORDER_SOURCE`, yang bentuknya tidak punya field harga.
- [x] **M3-BE-04 Transisi status** `a832842` — mesin status di domain; event `kitchen_ticket.started/ready/served.v1`. Selesai 12 Oktober 2026 (TODO 14.7). `POST /kds/tickets/:id/advance` dan `GET /kds/tickets/finished`. Menerima ticket (`NEW` → `ACCEPTED`) tidak mengumumkan event; tiga langkah lainnya mengumumkan.
- [x] **M3-BE-05 Handler pembatalan** `0a08380` — `order.canceled.v1` menandai ticket batal. Selesai 13 Oktober 2026 (TODO 14.11). Ticket yang sudah disajikan tidak diubah.
- [x] **M3-BE-06 Status kembali ke pesanan** `4a80c10` — order intake menerima event KDS dan memperbarui status pemenuhan (`ACCEPTED`/`PREPARING`/`READY`/`SERVED`), terpisah dari status bayar. Selesai 13 Oktober 2026 (TODO 14.12). `PREPARING`, `READY`, dan `SERVED` mengikuti event dapur. `ACCEPTED` tidak diisi: dapur tidak mengumumkan 'diterima' karena katalog event tidak punya event untuk itu.
- [x] **M3-BE-07 Realtime** `f6aceef` — Socket.IO per outlet dengan autentikasi sesi perangkat; klien mengambil ulang saat tersambung kembali. Selesai 15 Oktober 2026 (TODO 14.14). Namespace `/kds` di jalur `/api/realtime`. Trigger `kds_tickets_notify_queue` mengirim `pg_notify` setiap ticket dibuat atau berubah status, dari API maupun worker; API meneruskannya ke ruang `workspace:outlet`. Pesan hanya `{ outletId }`; layar mengambil ulang lewat REST saat menerima pesan dan setiap tersambung (ulang).
- [x] **M3-BE-08 API intake eksternal** `19eca86` — endpoint dengan kredensial integrasi dan rate limit (bila `OD-04` memilih API). Selesai 16 Oktober 2026 (TODO 14.21). `OD-04` diputuskan pengguna 16 Oktober 2026: manual + API. Sumber intake (`kds_intake_sources`) = satu kunci rahasia per sistem luar, terikat satu outlet, hanya hash yang disimpan; dikelola di Pengaturan > Sistem luar dapur (izin `kds.intake.manage`, Owner/Manager). `POST /api/v1/kds/intake/tickets` dengan `Authorization: Bearer kds_…`; referensi yang sama mengembalikan ticket yang sama (201 lalu 200). Jumlah sumber aktif dihitung dimensi `kds.intake_sources.active`. Rate limit: M3-SC-03.

### UX — Alur dan interaksi

- [x] **M3-UX-01 Shell KDS** `f0e9d9b` — rute `(kds)`, layar penuh, mode kios, tanpa sidebar. Selesai 13 Oktober 2026 (TODO 14.9). Mode kios memakai layar penuh browser lewat tombol di bar atas; belum diuji di perangkat dapur sungguhan.
- [x] **M3-UX-02 Tata letak** `f0e9d9b` — kolom per status di layar lebar; daftar satu kolom di tablet potret. Selesai 13 Oktober 2026 (TODO 14.9). Papan empat kolom mulai lebar 1024px; di bawahnya satu daftar, terlama di awal.
- [x] **M3-UX-03 Timer** `b1b2273` — berubah warna saat mendekati dan melewati batas, tanpa berkedip. Selesai 15 Oktober 2026 (TODO 14.15). Kuning mulai menit ke-10, merah mulai menit ke-15, dihitung dari ticket diterima; tetap untuk semua outlet (`WAIT_WARNING_MINUTES`, `WAIT_LATE_MINUTES` di `features/kds/ticket-view.ts`). **Angka ini asumsi**, belum ada di dokumen produk; target per station atau produk adalah SLA tier Pro.
- [x] **M3-UX-04 Koneksi** `f6aceef` — banner menyambung ulang dan data mungkin usang. Selesai 15 Oktober 2026 (TODO 14.14). 'Menyambung ulang…' atau 'Perangkat offline' + 'Ticket di layar mungkin belum terbaru.' dengan tombol 'Muat ulang'. Hilang sendiri setelah tersambung dan antrean diambil ulang.

### DS — Design system dan komponen

- [x] **M3-DS-01 Rapikan `KdsTicket`** `888bdec` — label lewat props, ukuran terbaca jarak jauh, tanpa harga. Selesai 12 Oktober 2026 (TODO 14.8). `KdsNewTicketAlert` dan `KdsConnectionStatus` di file yang sama masih berisi teks tertanam; dirapikan saat dipakai (M3-FT-05, M3-UX-04).
- [x] **M3-DS-02 Form ticket manual** `66045fa` — komponen input item cepat. Selesai 13 Oktober 2026 (TODO 14.10): `QuickItemEntry` (`@merchant/ui/quick-item-entry`).
- [x] **M3-DS-03 Varian kios** `26036a9` — skala tipografi dan jarak untuk layar dapur. Selesai 15 Oktober 2026 (TODO 14.16). `KdsTicket size="kiosk"`: label pesanan 28px, nama item 24px, jumlah dan waktu tunggu 20px, catatan 18px, tombol 64px. Layar dapur memakainya selama mode kios (layar penuh) aktif.

### AS — Aset

- [x] **M3-AS-01 Suara notifikasi** `74f04e9` — satu suara ticket baru dan satu suara gagal sambung, pendek, berlisensi bebas, ukuran kecil. Selesai 15 Oktober 2026 (TODO 14.17). `apps/web/public/sounds/kds-new-ticket.wav` (0,6 detik, 26 KB, dua nada naik) dan `kds-connection-lost.wav` (0,65 detik, 29 KB, dua nada turun). Dibuat oleh `apps/web/scripts/generate-kds-sounds.mjs`, jadi tanpa lisensi pihak ketiga.

### SC — Keamanan dan privasi

- [x] **M3-SC-01 Data guard KDS** `39d3fc9` — test respons dan payload realtime tanpa harga, pembayaran, atau telepon. Selesai 15 Oktober 2026 (TODO 14.19). Respons: skema strict di controller dan kontrak, nama properti OpenAPI KDS, kolom tabel `kds_*`, port pesanan tanpa harga. Realtime: pesan hanya `{ outletId }` (integration `kds-realtime` dan test kontrak `kitchenQueueChangedSchema`).
- [x] **M3-SC-02 Sesi perangkat KDS** `f6aceef` — hanya perangkat terdaftar outlet itu yang menerima antrean outlet. Selesai 15 Oktober 2026 (TODO 14.14). Berlaku untuk **realtime**: hanya sesi yang dibuka di layar dapur aktif outlet itu, oleh orang yang boleh melihat antrean, yang menerima pembaruan; izin diperiksa ulang tiap 60 detik. Akun berizin di browser biasa tetap membaca antrean lewat REST (dibaca ulang tiap 4 detik), seperti sebelumnya.
- [x] **M3-SC-03 Rate limit API intake.** `579fe82` Selesai 16 Oktober 2026 (TODO 14.22). Per sumber 60 permintaan/menit (KDS Basic) atau 600/menit bila paket memuat `kds.intake.api` (Pro), sesuai `CAFE-COMPANION-PACKAGES-LIMITS-V1.md` 5.4; kunci salah 30/menit per alamat jaringan. Lewat batas: `429 RATE_LIMIT_EXCEEDED`.

### QA — Kualitas kode dan test

- [x] **M3-QA-01 Test satu use case banyak pintu** `579fe82` — manual, event, dan API menghasilkan ticket identik. Selesai 16 Oktober 2026 (TODO 14.6, 14.11, 14.21): pintu manual dan event lewat use case yang sama (`kds-tickets`, `kds-order-flow`); pintu API lewat HTTP menghasilkan ticket yang isinya sama dengan pintu manual (`kds-intake`).
- [x] **M3-QA-02 Test event ganda** `0a08380` — event yang sama dua kali menghasilkan satu ticket. Selesai 13 Oktober 2026 (TODO 14.11).
- [x] **M3-QA-03 Test kombinasi** `0a08380` — KDS-only, POS-only, POS + KDS. Selesai 13 Oktober 2026 (TODO 14.11): `kds-order-flow.integration.test.mjs`.

### OP — Operasional dan dokumentasi

- [x] **M3-OP-01 Seed dan akun dapur** `dc96233` — akun Kitchen dan satu perangkat KDS lokal. Selesai 13 Oktober 2026 (TODO 14.13): `pnpm --filter @merchant/api local:users:provision`.
- [x] **M3-OP-02 Perbarui dokumen** `b50e4c6` — `schema.md` B.5, `flowchart.md` 8, `architecture.md` 7.2. Selesai 15 Oktober 2026 (TODO 14.20). `schema.md` B.5 (tabel, migrasi, trigger), `flowchart.md` 8 (layar, ticket baru, timer, koneksi, kios), `architecture.md` 7.2 (event dan konsumen dapur) dan 10 (realtime). Pintu API eksternal belum didokumentasikan karena menunggu `OD-04`.

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
