# M4 — Meja, Self-Order, dan Customer

**Status:** Belum mulai
**Tahap PRD:** E (Floor + Self-Order + Customer)
**Bergantung pada:** M3

## 1. Tujuan

Outlet mengatur denah lantai, area, dan meja; kasir dan pelayan melayani tamu per meja dengan sesi yang dapat dipindah tanpa kehilangan pesanan; tamu memindai QR meja, memesan sendiri, melihat status pesanan, memanggil pelayan, dan meminta bill. Modul Customer menyimpan pelanggan dan riwayat kunjungannya.

## 2. Cakupan

**Termasuk:** lantai → area → meja dengan editor tata letak; tiga bentuk meja; sesi meja; pindah meja; tampilan meja langsung di POS; makan di tempat di POS; QR per meja ber-hash dengan rotasi; surface tamu; permintaan layanan; pembayaran yang diklaim tamu (`VERIFYING`); Customer Basic.

**Tidak termasuk:** gabung/pisah meja dan split bill (tier Pro, terkunci dengan state capability); reservasi, delivery, loyalty (setelah R1).

## 3. Kriteria selesai

- [ ] Lokasi baru langsung memiliki `Main Floor` dan `Main Area`.
- [ ] Editor menempatkan meja tiga bentuk; tumpang tindih dan keluar batas ditolak; tersedia alternatif form untuk layar kecil dan keyboard.
- [ ] Sesi meja dibuka, ditambah pesanan, dipindah meja dengan pesanan dan tagihan tetap, dibayar, lalu ditutup.
- [ ] Status meja adalah projection dari sesi, tidak bisa diisi bebas.
- [ ] QR mentah tidak disimpan; rotasi dan cabut membuat QR lama tidak berlaku.
- [ ] Tamu memesan dari QR tanpa akun; pesanan masuk ke KDS yang sama dengan pesanan POS.
- [ ] Klaim "sudah bayar" tamu berstatus `VERIFYING` sampai kasir mengonfirmasi.
- [ ] Surface tamu tidak menerima ID internal meja/sesi, koordinat tata letak, atau token mentah.
- [ ] Kasir dapat menautkan pelanggan ke pesanan dan melihat riwayat kunjungan.

## 4. Task

### FT — Fitur produk

- [ ] **M4-FT-01 Lantai dan area** — tambah, ubah nama, urutkan, nonaktifkan.
- [ ] **M4-FT-02 Editor meja** — label, kapasitas, bentuk, ukuran, rotasi, aktif, pesan lewat QR; baki "belum ditempatkan"; simpan tata letak.
- [ ] **M4-FT-03 Tampilan meja di POS** — filter lantai, area, status; buka meja dengan jumlah tamu.
- [ ] **M4-FT-04 Panel sesi** — tamu, durasi, pesanan, tagihan; tambah pesanan; bayar; tutup sesi; kebijakan bersih-bersih.
- [ ] **M4-FT-05 Pindah meja** — aksi tersendiri dengan asal dan tujuan.
- [ ] **M4-FT-06 Makan di tempat** — `orderType: DINE_IN` di layar jual, terikat sesi meja.
- [ ] **M4-FT-07 QR meja** — buat, cetak, unduh, rotasi, cabut.
- [ ] **M4-FT-08 Self-order tamu** — menu, keranjang, kirim pesanan, status, pesan lagi.
- [ ] **M4-FT-09 Panggil pelayan dan minta bill** — muncul di POS sebagai permintaan layanan.
- [ ] **M4-FT-10 Bayar dari meja** — instruksi bayar manual; "saya sudah bayar" → kasir konfirmasi.
- [ ] **M4-FT-11 Customer Basic** — nama, telepon, catatan; cari dan tautkan di POS; riwayat kunjungan.

### BE — Backend dan data

- [ ] **M4-BE-01 Tabel floor** — `floor_floors`, `floor_areas`, `floor_service_tables` dengan unik label per outlet dan validasi grid.
- [ ] **M4-BE-02 Sesi meja** — `floor_table_sessions`, `floor_session_tables` (indeks unik parsial satu sesi aktif per meja); event `table_session.opened/moved/closed.v1`.
- [ ] **M4-BE-03 Projection status meja.**
- [ ] **M4-BE-04 Token QR** — `floor_qr_tokens` dengan hash, versi, rotasi, cabut; resolusi token → konteks meja tanpa membocorkan ID.
- [ ] **M4-BE-05 Intake self-order** — pintu masuk pesanan sumber `SELF_ORDER` ke kernel order intake yang sama; rate limit per token.
- [ ] **M4-BE-06 Permintaan layanan** — `floor_service_requests`.
- [ ] **M4-BE-07 Pembayaran `VERIFYING`** — klaim tamu dan konfirmasi kasir di kernel billing.
- [ ] **M4-BE-08 Tagihan per sesi** — bill untuk sesi meja yang memuat beberapa pesanan.
- [ ] **M4-BE-09 Customer** — `customer_customers`, `customer_order_links`; handler `sale.completed.v1` untuk riwayat.

### UX — Alur dan interaksi

- [ ] **M4-UX-01 Editor tata letak** — seret di layar lebar, form di layar kecil, alternatif keyboard.
- [ ] **M4-UX-02 Surface tamu** — rute `(customer)`, HP dulu, pemilih bahasa di header, bar keranjang lengket.
- [ ] **M4-UX-03 State QR** — tidak berlaku, outlet tutup, menu kosong.
- [ ] **M4-UX-04 Capability terkunci** — gabung/pisah meja menampilkan state "butuh tier Pro".

### DS — Design system dan komponen

- [ ] **M4-DS-01 Rapikan komponen meja** — `TableTile`, `TableLayoutCanvas`, `TableLayoutTray`, `TableLayoutTools`, `TableQr`, `FloorSelector`: label lewat props, tanpa deskripsi.
- [ ] **M4-DS-02 Komponen baru Floor** — `AreaSelector`, `LiveTableView`, `TableSessionPanel`.
- [ ] **M4-DS-03 Komponen tamu** — `StickyCartBar`, `OrderProgress`; rapikan `CustomerOrderSurface`, `CustomerQrContext`, `CustomerBasicProfile`.
- [ ] **M4-DS-04 Pemilih modifier untuk tamu** — memakai hasil M1-DS-06.

### AS — Aset

- [ ] **M4-AS-01 Bentuk meja** — SVG persegi, persegi panjang, bulat dalam tiga ukuran, mengikuti token.
- [ ] **M4-AS-02 Kartu QR cetak** — template A6 dan stiker kecil: nama outlet, label meja, QR, instruksi singkat dua bahasa; unduh PNG/PDF.
- [ ] **M4-AS-03 Metadata publik** — judul, deskripsi, dan gambar pratinjau untuk tautan menu publik.

### SC — Keamanan dan privasi

- [ ] **M4-SC-01 Data guard surface tamu** — test tidak ada ID internal, koordinat, atau token mentah.
- [ ] **M4-SC-02 Rate limit surface publik** — pesanan per token dan per IP.
- [ ] **M4-SC-03 Privasi pelanggan** — telepon hanya untuk peran berizin; tidak dikirim ke KDS.
- [ ] **M4-SC-04 Rotasi QR** — QR lama ditolak segera setelah rotasi.

### QA — Kualitas kode dan test

- [ ] **M4-QA-01 Test pindah meja** — identitas sesi, pesanan, dan tagihan terjaga.
- [ ] **M4-QA-02 Test POS dan QR ke KDS yang sama.**
- [ ] **M4-QA-03 Test browser surface tamu** — 320 px, terang/gelap, dua bahasa.

### OP — Operasional dan dokumentasi

- [ ] **M4-OP-01 Seed denah** — dua lantai, beberapa area, meja tiga bentuk di outlet lokal.
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
