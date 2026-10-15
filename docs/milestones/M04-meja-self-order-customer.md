# M4 — Meja, Self-Order, dan Customer

**Status:** Berjalan (dimulai 16 Oktober 2026 atas permintaan pengguna, sementara M3 menunggu review)
**Tahap PRD:** E (Floor + Self-Order + Customer)
**Bergantung pada:** M3

## 1. Tujuan

Outlet mengatur denah lantai, area, dan meja; kasir dan pelayan melayani tamu per meja dengan sesi yang dapat dipindah tanpa kehilangan pesanan; tamu memindai QR meja, memesan sendiri, melihat status pesanan, memanggil pelayan, dan meminta bill. Modul Customer menyimpan pelanggan dan riwayat kunjungannya.

## 2. Cakupan

**Termasuk:** lantai → area → meja dengan editor tata letak; tiga bentuk meja; sesi meja; pindah meja; tampilan meja langsung di POS; makan di tempat di POS; QR per meja ber-hash dengan rotasi; surface tamu; permintaan layanan; pembayaran yang diklaim tamu (`VERIFYING`); Customer Basic.

**Tidak termasuk:** gabung/pisah meja dan split bill (tier Pro, terkunci dengan state capability); reservasi, delivery, loyalty (setelah R1).

## 3. Kriteria selesai

- [x] Lokasi baru langsung memiliki `Main Floor` dan `Main Area`. _Trigger database pada `outlets`; integration `floor-layout` (TODO 13.10)._
- [x] Editor menempatkan meja tiga bentuk; tumpang tindih dan keluar batas ditolak; tersedia alternatif form untuk layar kecil dan keyboard. _M4-FT-02, M4-UX-01 (TODO 13.12)._
- [x] Sesi meja dibuka, ditambah pesanan, dipindah meja dengan pesanan dan tagihan tetap, dibayar, lalu ditutup. _Integration `floor-dine-in` dan `floor-move`; browser (TODO 13.14, 13.15)._
- [x] Status meja adalah projection dari sesi, tidak bisa diisi bebas. _M4-BE-03 (TODO 13.13): tidak ada kolom status meja; `tableStatus()` dari sesi yang memegang meja._
- [x] QR mentah tidak disimpan; rotasi dan cabut membuat QR lama tidak berlaku. _Integration `floor-qr` dan browser (TODO 13.16)._
- [ ] Tamu memesan dari QR tanpa akun; pesanan masuk ke KDS yang sama dengan pesanan POS.
- [ ] Klaim "sudah bayar" tamu berstatus `VERIFYING` sampai kasir mengonfirmasi.
- [x] Surface tamu tidak menerima ID internal meja/sesi, koordinat tata letak, atau token mentah. _M4-SC-01: integration `floor-self-order` memeriksa setiap jawaban ke tamu (TODO 13.17)._
- [ ] Kasir dapat menautkan pelanggan ke pesanan dan melihat riwayat kunjungan.

## 4. Task

### FT — Fitur produk

- [x] **M4-FT-01 Lantai dan area** `993dbb1` — tambah, ubah nama, urutkan, nonaktifkan. Selesai 16 Oktober 2026 (TODO 13.10). Halaman **Meja** (`/floor`, izin `table.layout.manage`): tab lantai aktif dan daftar area lantai terpilih; panel **Lantai dan area** untuk tambah, ubah nama, naik/turun, nonaktifkan/aktifkan lagi. Lantai/area terakhir yang aktif atau yang masih berisi meja aktif tidak bisa dinonaktifkan. Tidak ada hapus.
- [x] **M4-FT-02 Editor meja** `bc0021d` — label, kapasitas, bentuk, ukuran, rotasi, aktif, pesan lewat QR; baki "belum ditempatkan"; simpan tata letak. Selesai 16 Oktober 2026 (TODO 13.12). Meja baru (label, kursi, bentuk, ukuran, area) masuk baki; "Tempatkan" menaruhnya di tempat kosong pertama. Panel meja: label, kursi, bentuk, ukuran, arah (persegi panjang saja), area, kolom/baris, pesan lewat QR, aktif, kembalikan ke baki. Semua perubahan jadi draf sampai **Simpan tata letak**; Buang perubahan mengembalikannya. Ukuran sel grid tidak bisa diketik: mengikuti bentuk + ukuran + arah (aturan yang sama di API dan web, `floorTableFootprint` di contracts).
- [x] **M4-FT-03 Tampilan meja di POS** `589d514` — filter lantai, area, status; buka meja dengan jumlah tamu. Selesai 16 Oktober 2026 (TODO 13.13). POS > **Meja** (`/pos/tables`, izin `table.view`, muncul di bar POS bila workspace punya modul Meja): lantai, area, filter status; denah ≥768 px, daftar di bawahnya; panel samping ≥1024 px, sheet di bawahnya. Meja tersedia → jumlah tamu → **Buka meja**; terisi → kunjungan (tamu, duduk sejak, lama) → **Tutup kunjungan**; dibersihkan → **Tandai siap dipakai**. Diperbarui tiap 10 detik. Pesanan dan tagihan per kunjungan: M4-FT-04.
- [x] **M4-FT-04 Panel sesi** `2125a06` — tamu, durasi, pesanan, tagihan; tambah pesanan; bayar; tutup sesi; kebijakan bersih-bersih. Selesai 16 Oktober 2026 (TODO 13.14). Panel kunjungan di POS > Meja: tamu, duduk sejak, lama, **belum dibayar**, daftar pesanan (nomor, isi, total, Lunas/Belum dibayar/Batal). Satu tindakan utama: **Bayar** selama ada yang belum dibayar, **Tutup kunjungan** bila sudah tidak ada; **Tambah pesanan** selalu ada. Bayar memakai layar pembayaran POS yang sama (tunai/QRIS/transfer/EDC) dengan total dari server; hasilnya menampilkan nomor penjualan tiap pesanan dan kembalian. Kebijakan bersih-bersih: M4-FT-03.
- [x] **M4-FT-05 Pindah meja** `8d623d7` — aksi tersendiri dengan asal dan tujuan. Selesai 16 Oktober 2026 (TODO 13.15). Panel kunjungan > **Pindah meja** → daftar meja kosong (lantai yang sedang dilihat dulu) → **Pindahkan ke T4**. `POST /floor/sessions/:id/move` (izin `order.move_table`): keterikatan lama dilepas, keterikatan `PRIMARY` baru dibuat dalam satu transaksi; indeks unik parsial membuat dua kunjungan yang pindah ke meja yang sama bersamaan tidak bisa berhasil keduanya. Event `table_session.moved.v1` (`fromTableId`, `toTableId`). Tiket dapur memakai label meja saat dapur menerima pesanan.
- [x] **M4-FT-06 Makan di tempat** `2125a06` — `orderType: DINE_IN` di layar jual, terikat sesi meja. Selesai 16 Oktober 2026 (TODO 13.14). "Tambah pesanan" membuka layar jual dengan `?table=<kunjungan>`: penanda "Pesanan untuk T5 · Kunjungan 7", tombol keranjang **Kirim pesanan** menggantikan Bayar, lalu kembali ke meja. Pesanan `DINE_IN` dibuat lewat `POST /floor/sessions/:id/orders` (izin `order.create`, kunci idempotensi), tidak butuh shift karena tidak menerima uang (pelayan bisa memakainya). Tiket dapur membawa label meja (`kds_tickets.table_label`).
- [x] **M4-FT-07 QR meja** `bc71358` — buat, cetak, unduh, rotasi, cabut. Selesai 16 Oktober 2026 (TODO 13.16). Backoffice > Meja > pilih meja > **QR meja**: status (Belum dibuat/Berlaku/Dihentikan, versi), Buat QR, Cetak, QR baru dan Hentikan QR dengan konfirmasi, pilihan kertas, pratinjau kartu, Unduh PNG/PDF.
- [ ] **M4-FT-08 Self-order tamu** — menu, keranjang, kirim pesanan, status, pesan lagi.
- [ ] **M4-FT-09 Panggil pelayan dan minta bill** — muncul di POS sebagai permintaan layanan.
- [ ] **M4-FT-10 Bayar dari meja** — instruksi bayar manual; "saya sudah bayar" → kasir konfirmasi.
- [ ] **M4-FT-11 Customer Basic** — nama, telepon, catatan; cari dan tautkan di POS; riwayat kunjungan.

### BE — Backend dan data

- [x] **M4-BE-01 Tabel floor** `993dbb1` — `floor_floors`, `floor_areas`, `floor_service_tables` dengan unik label per outlet dan validasi grid. Selesai 16 Oktober 2026 (TODO 13.10). Migrasi `20261017010000_floor_layout`; modul API `modules/floor` (manifest `TABLE_SELF_ORDER` menggantikan namespace rencana). Grid lantai 24×16 sel logis bawaan; ukuran meja diturunkan dari bentuk + ukuran (domain `layout.ts`, tumpang tindih/keluar batas dideteksi). Limit `floor.floors.active_per_location` dan `floor.areas.active_per_floor` diperiksa per outlet/lantai (limit kini bisa punya cakupan).
- [x] **M4-BE-02 Sesi meja** `589d514` — `floor_table_sessions`, `floor_session_tables` (indeks unik parsial satu sesi aktif per meja); event `table_session.opened/moved/closed.v1`. Selesai 16 Oktober 2026 (TODO 13.13). Migrasi `20261017020000_floor_table_sessions`. Indeks unik parsial `(tenant_id, table_id) WHERE detached_at IS NULL`: dua kasir membuka meja yang sama bersamaan → satu berhasil, satu `TABLE_NOT_AVAILABLE`. Event `table_session.opened.v1` dan `table_session.closed.v1` lewat outbox (id sesi di `aggregate_id`, karena kata "session" dilarang di payload); `table_session.moved.v1` datang bersama M4-FT-05. Kunjungan ditutup hanya bila semua pesanannya dibayar atau dibatalkan (`TABLE_SESSION_UNPAID`). Kebijakan per outlet `floor_outlet_policies.cleaning_after_close`. Izin `table.manage` ditambahkan ke peran Kasir dan Pelayan.
- [x] **M4-BE-03 Projection status meja.** `589d514` Selesai 16 Oktober 2026 (TODO 13.13). `AVAILABLE` (tidak dipegang), `OCCUPIED` (sesi OPEN), `CLOSING` (sesi CLOSING), `CLEANING` (sesi CLOSED yang menunggu dibersihkan), `INACTIVE` (meja nonaktif tanpa tamu). Meja yang masih dipegang tamu tidak bisa dinonaktifkan di editor (`FLOOR_TABLE_IN_USE`).
- [x] **M4-BE-04 Token QR** `bc71358` — `floor_qr_tokens` dengan hash, versi, rotasi, cabut; resolusi token → konteks meja tanpa membocorkan ID. Selesai 16 Oktober 2026 (TODO 13.16). Migrasi `20261017030000_floor_qr_tokens`. Token diturunkan dari garam acak dengan rahasia server (`TABLE_QR_SECRET`), sehingga QR bisa dicetak ulang tanpa menyimpan token. `GET/POST /floor/tables/:id/qr`, `.../qr/rotate`, `.../qr/revoke` (izin `table.qr.manage`); `GET /public/table-qr/:token` menjawab nama bisnis, outlet, dan label meja saja, berstatus `READY`, `CLOSED` (meja/area/lantai/outlet nonaktif, meja tidak menerima pesanan QR, atau modul tidak terpasang), atau `INVALID`.
- [x] **M4-BE-05 Intake self-order** — pintu masuk pesanan sumber `SELF_ORDER` ke kernel order intake yang sama; rate limit per token. Selesai 16 Oktober 2026 (TODO 13.17). `GET /public/table-qr/:token/menu`, `GET .../visit`, `POST .../orders` (kunci idempotensi wajib). Pesanan `SELF_ORDER` lewat `submitTableOrder` kernel yang sama dengan POS; bila meja kosong, kunjungan dibuka oleh tamu (`opened_by` kosong, migrasi `20261017040000_floor_guest_sessions`) dengan jumlah tamu dari pesanan pertama; meja yang menunggu dibersihkan menolak (`TABLE_NOT_AVAILABLE`); QR yang tidak siap `SELF_ORDER_CLOSED`, QR tak dikenal `TABLE_QR_INVALID`. Menu tamu belum membawa gambar produk (alamat gambar memuat id workspace). Moderasi terima/tolak oleh staf belum dibuat.
- [ ] **M4-BE-06 Permintaan layanan** — `floor_service_requests`.
- [ ] **M4-BE-07 Pembayaran `VERIFYING`** — klaim tamu dan konfirmasi kasir di kernel billing.
- [x] **M4-BE-08 Tagihan per sesi** `2125a06` — bill untuk sesi meja yang memuat beberapa pesanan. Selesai 16 Oktober 2026 (TODO 13.14). Sesuai `schema.md` B.3 (bill tetap satu per pesanan): `POST /pos/table-sessions/:id/payments` membayar semua pesanan kunjungan yang belum dibayar dengan **satu pembayaran**; tiap pesanan mendapat bill (bertanda `table_session_id`) dan penjualan sendiri, dan alokasi pembayaran per bill. Semua pesanan dikunci dulu; bila ada yang batal atau sudah dibayar, tidak ada yang ditulis. Pajak dan service dihitung per pesanan seperti bila dibayar sendiri. Event `payment.recorded.v1` dan `sale.completed.v1` dikirim per pesanan (isi sama seperti pembayaran biasa). Struk per pesanan masih menampilkan jumlah pembayaran gabungan; struk gabungan per kunjungan belum ada.
- [ ] **M4-BE-09 Customer** — `customer_customers`, `customer_order_links`; handler `sale.completed.v1` untuk riwayat.

### UX — Alur dan interaksi

- [x] **M4-UX-01 Editor tata letak** `bc0021d` — seret di layar lebar, form di layar kecil, alternatif keyboard. Selesai 16 Oktober 2026 (TODO 13.12). ≥1280 px: denah + panel meja di samping. Di bawahnya: denah bisa digulir di kotaknya sendiri, panel meja jadi sheet dengan kolom/baris sebagai pengganti seret. Keyboard: Enter/Spasi memilih meja, panah menggeser satu sel, plus tombol panah di atas denah. Seret mouse mulai setelah 5 px sehingga klik tetap memilih. Meja yang saling menimpa ditandai dan Simpan dimatikan; server tetap memeriksa ulang.
- [ ] **M4-UX-02 Surface tamu** — rute `(customer)`, HP dulu, pemilih bahasa di header, bar keranjang lengket.
- [ ] **M4-UX-03 State QR** — tidak berlaku, outlet tutup, menu kosong.
- [x] **M4-UX-04 Capability terkunci** `8d623d7` — gabung/pisah meja menampilkan state "butuh tier Pro". Selesai 16 Oktober 2026 (TODO 13.15). `GET /floor/live` membawa `canMergeTables` dari capability `floor.table_session.merge_split`. Tanpa capability itu (Meja Basic) panel kunjungan menampilkan tombol **Gabung atau pisah meja** nonaktif dengan ikon kunci dan keterangan "Tersedia di Meja Pro"; tanpa tautan beli karena tujuan upgrade belum diputuskan. Dengan capability itu tombol tidak tampil sampai fiturnya dibuat (R1+).

### DS — Design system dan komponen

- [x] **M4-DS-01 Rapikan komponen meja** `995a56f` — `TableTile`, `TableLayoutCanvas`, `TableLayoutTray`, `TableLayoutTools`, `TableQr`, `FloorSelector`: label lewat props, tanpa deskripsi. Selesai 16 Oktober 2026 (TODO 13.11). Keenam komponen menerima `labels` dan tidak punya teks sendiri (pesan `TypeError` untuk developer tetap). `TableTile` menerima `stateLabel` (status tertulis, tidak hanya warna) dan `metrics` siap tulis; status baru `closing` dan `cleaning`. Ringkasan "N siap ditempatkan" di baki dihapus karena mengulang jumlah di judul.
- [x] **M4-DS-02 Komponen baru Floor** `589d514` — `AreaSelector`, `LiveTableView`, `TableSessionPanel`. Selesai 16 Oktober 2026 (TODO 13.13). `AreaSelector` (pilihan pil, panah kiri/kanan, tidak digambar bila hanya satu area), `LiveTableView` (denah mode lihat atau daftar kartu untuk layar kecil; meja tanpa posisi hanya di daftar), `TableSessionPanel` (judul, status tertulis, fakta, tindakan; tanpa bingkai dan teks sendiri; judul bisa disembunyikan bila sheet sudah menampilkannya).
- [ ] **M4-DS-03 Komponen tamu** — `StickyCartBar`, `OrderProgress`; rapikan `CustomerOrderSurface`, `CustomerQrContext`, `CustomerBasicProfile`.
- [ ] **M4-DS-04 Pemilih modifier untuk tamu** — memakai hasil M1-DS-06.

### AS — Aset

- [x] **M4-AS-01 Bentuk meja** `995a56f` — SVG persegi, persegi panjang, bulat dalam tiga ukuran, mengikuti token. Selesai 16 Oktober 2026 (TODO 13.11). Komponen SVG `TableShape` (`@merchant/ui/table-shape`): meja dari atas dengan kursi diturunkan dari kapasitas (maks. 16 digambar), mengikuti token warna lewat CSS, tersembunyi dari pembaca layar. Ukuran mengikuti jejak grid: persegi/bulat 2×2, 3×3, 4×4; persegi panjang 3×2, 4×2, 6×3. `TableTile` dengan `shape` menggambar meja ini.
- [x] **M4-AS-02 Kartu QR cetak** `bc71358` — template A6 dan stiker kecil: nama outlet, label meja, QR, instruksi singkat dua bahasa; unduh PNG/PDF. Selesai 16 Oktober 2026 (TODO 13.16). Kartu A6 (nama outlet, label meja, QR, "Pindai untuk memesan · Scan to order") dan stiker 50×50 mm (QR dan label) digambar hitam-putih di canvas; unduh PNG, unduh PDF (PDF satu halaman ukuran kertas, dibuat sendiri tanpa pustaka), atau cetak di jendela sendiri dengan ukuran halaman yang tepat. Pustaka baru: `qrcode@1.5.4`.
- [ ] **M4-AS-03 Metadata publik** — judul, deskripsi, dan gambar pratinjau untuk tautan menu publik.

### SC — Keamanan dan privasi

- [x] **M4-SC-01 Data guard surface tamu** — test tidak ada ID internal, koordinat, atau token mentah. Selesai 16 Oktober 2026 (TODO 13.17). Skema tamu `strict` tanpa id workspace/outlet/meja/kunjungan/pesanan; integration memeriksa semua jawaban tamu tidak memuat id tersebut, `grid*`, atau token. Id produk/kategori tetap ada karena dibutuhkan untuk memesan.
- [x] **M4-SC-02 Rate limit surface publik** — pesanan per token dan per IP. Selesai 16 Oktober 2026 (TODO 13.17). Kirim pesanan dibatasi 20 per QR meja dan 60 per alamat jaringan per 10 menit (dihitung sebelum pemeriksaan lain), lewat layanan rate limit yang sama dengan login; lewat batas `429 RATE_LIMIT_EXCEEDED`.
- [ ] **M4-SC-03 Privasi pelanggan** — telepon hanya untuk peran berizin; tidak dikirim ke KDS.
- [x] **M4-SC-04 Rotasi QR** `bc71358` — QR lama ditolak segera setelah rotasi. Selesai 16 Oktober 2026 (TODO 13.16). Rotasi dalam satu transaksi: QR lama `ROTATED`, versi baru `ACTIVE`; resolusi hanya mencari `ACTIVE`, jadi QR lama `INVALID` di permintaan berikutnya. Diperiksa lewat integration dan browser.

### QA — Kualitas kode dan test

- [x] **M4-QA-01 Test pindah meja** `8d623d7` — identitas sesi, pesanan, dan tagihan terjaga. Selesai 16 Oktober 2026 (TODO 13.15). Integration `floor-move`: id, nomor, pesanan, dan belum-dibayar sama sebelum dan sesudah pindah; meja asal tersedia, tujuan terisi oleh kunjungan yang sama; meja yang dipegang tamu lain ditolak; dua pindah bersamaan ke satu meja → 200 + 409; tiket ronde sesudah pindah berlabel meja baru; bill dibayar atas nama kunjungan; riwayat keterikatan tersimpan; kunjungan tertutup tidak bisa dipindah.
- [x] **M4-QA-02 Test POS dan QR ke KDS yang sama.** Selesai 16 Oktober 2026 (TODO 13.17). Integration `floor-self-order`: dua pesanan tamu dan satu pesanan kasir menjadi tiga tiket di station yang sama (`SELF_ORDER` berlabel T1, `POS` tanpa meja); dapur memajukan tiket → tamu melihat "PREPARING".
- [ ] **M4-QA-03 Test browser surface tamu** — 320 px, terang/gelap, dua bahasa.

### OP — Operasional dan dokumentasi

- [x] **M4-OP-01 Seed denah** `993dbb1` — dua lantai, beberapa area, meja tiga bentuk di outlet lokal. Selesai 16 Oktober 2026 (TODO 13.10). `pnpm db:seed:floor [tenant-slug]`: tiap outlet aktif mendapat Main Floor (Main Area, Teras) dan Lantai 2 (Main Area, Ruang Rapat) dengan 14 meja tiga bentuk, satu di baki belum ditempatkan. Aman diulang.
- [ ] **M4-OP-02 Perbarui dokumen** — `schema.md` B.4 dan B.9, `flowchart.md` 6–7.

## 5. Urutan checkpoint yang disarankan

1. M4-BE-01, M4-FT-01, M4-OP-01.
2. M4-DS-01, M4-AS-01, M4-UX-01, M4-FT-02.
3. M4-BE-02, M4-BE-03, M4-BE-08, M4-DS-02, M4-FT-03, M4-FT-04, M4-FT-06.
4. M4-FT-05, M4-QA-01, M4-UX-04.
5. M4-BE-04, M4-SC-04, M4-AS-02, M4-FT-07.
6. M4-BE-05, M4-UX-02, M4-UX-03, M4-DS-03, M4-DS-04, M4-FT-08, M4-SC-01, M4-SC-02, M4-QA-02, M4-QA-03, M4-AS-03.
7. M4-BE-06, M4-FT-09, M4-BE-07, M4-FT-10.
8. M4-BE-09, M4-FT-11, M4-SC-03, M4-OP-02.

## 6. Referensi

`prd.md` 6.3, 9.2–9.3 · `flowchart.md` 6–7 · `schema.md` B.4, B.9 · `design-system.md` 19.3 · `design-system-modules.md` 7, 12 · `security.md` 11.
