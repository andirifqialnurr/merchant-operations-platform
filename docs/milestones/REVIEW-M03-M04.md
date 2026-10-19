# Review M3/M4 dan gap Release 1

**Status:** Menunggu review pengguna; bukan persetujuan milestone.
**Baseline kode:** `7b61eb1` (penutupan task M4).
**Lingkup checkpoint:** sinkronisasi status dokumentasi dan pencatatan gap, tanpa perubahan kode, database, atau rute.

## 1. Posisi dan aturan lanjut

**Pembaruan setelah `2a5f8fd`:** pengguna meminta `lanjut m4`. M4 kembali **Berjalan**, dimulai dengan [kontrak GAP-01](./M04-moderasi-basic.md), tanpa menutup gate review visual/uji fisik M3. Kontrak adalah checkpoint dokumentasi, bukan implementasi moderasi atau penerimaan milestone. Status baseline dan urutan sebelumnya di bawah merupakan riwayat.

- M1/M2 selesai dan disetujui pengguna. Atas instruksi setelah `21f2fbc`, penutupan teknis M3 selesai dan dipush sebagai `e7ac7e3` (paket/limit) serta `10799b9` (browser). M3 kembali **Menunggu review**, M4 tetap Menunggu review. Penerimaan pengguna/uji fisik tidak dicentang otomatis.
- Permintaan untuk melanjutkan penyelarasan dokumentasi tidak dianggap sebagai persetujuan visual, perubahan scope produk, atau izin memulai M5.
- Checkbox task M3/M4 merekam checkpoint implementasi terdahulu, bukan bukti bahwa seluruh capability Basic sudah lengkap.
- PRD, tier, dan paket tetap otoritas scope sesuai [urutan sumber](../README.md). Gap wajib tidak menjadi future hanya karena belum masuk checklist milestone.

## 2. Gate review M3/M4

### M3 — KDS

- [ ] Pengguna meninjau antrean, manual intake, POS → KDS, API intake, status kembali ke pesanan, suara, dan putus/sambung koneksi.
- [ ] Keterbacaan jarak 1–2 meter diperiksa pada monitor dapur sungguhan. Ini kriteria M3 yang masih terbuka, bukan sesuatu yang dapat ditutup dari screenshot.
- [x] Gap limit sumber intake pada bagian 3 ditutup secara teknis oleh `e7ac7e3` (M3-BE-09); upgrade subscription lama tetap eksplisit.

Bukti implementasi terdahulu: [M3](./M03-kds.md) dan TODO 14.6–14.23. Angka p99 sekitar 1,29 detik adalah hasil uji lokal terdahulu, bukan SLA atau hasil beban produksi.

### M4 — Meja, tamu, pelanggan

- [ ] Pengguna meninjau editor, buka/pindah/tutup kunjungan, beberapa ronde pesanan, pembayaran kunjungan, QR, permintaan layanan, dan klaim bayar.
- [ ] Privasi telepon pelanggan, konteks outlet, dan riwayat diperiksa dengan peran kasir dan pemilik.
- [x] Moderasi Basic GAP-01 ditutup secara teknis oleh M4-GAP01-BE/UI/E2E lokal (`93f4931`, dipush). Review visual pengguna tetap pada gate pertama. Gambar sudah ditutup teknis pada GAP-05 (lihat pembaruan); struk GAP-06 masih membutuhkan checkpoint tersendiri, bukan dihilangkan dari scope diam-diam.

Bukti implementasi terdahulu: [M4](./M04-meja-self-order-customer.md) dan TODO 13.10–13.22 untuk task M4. Nomor 13.x juga dipakai checkpoint M2; cocokkan judul dan ID task, bukan nomor saja.

## 3. Register gap terhadap kontrak produk

Setiap baris di bawah adalah pekerjaan tersisa atau pemeriksaan yang harus dialokasikan. Tabel ini tidak mengotorisasi implementasi maupun reslicing baru.

| ID                                | Sumber dan kondisi kode                                                                                                                                                                                                      | Tindak lanjut / bukti selesai                                                                                                                                                                                                                                                 |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GAP-01 Moderasi tamu Basic        | Module Tiers 5.2: Basic **Staff accept/reject**; auto-accept adalah Pro. `modules/floor/application/guest-ordering.ts` langsung memanggil `submitTableOrder`, lalu event membuat tiket KDS. Tidak ada langkah moderasi staf. | Prioritas sebelum penerimaan Self-Order Basic: tentukan command/state, izin, timing event, penolakan dan tagihan, kemudian implementasi terpisah. Buktikan pesanan belum diterima tidak masuk dapur; accept/reject dan retry tidak menggandakan efek.                         |
| GAP-02 Profil/menu publik mandiri | PRD 11.1 dan CAT-007; Module Tiers 3.2–3.3: profil/menu publik Basic dan Catalog dapat berjalan tanpa POS. Rute `/m/[slug]` serta alur publikasinya belum ada. `/t/[token]` bukan pengganti profil publik mandiri.           | Alokasikan checkpoint Catalog & Profile sebelum paket Profile dirilis. Definisikan field publik, status publikasi, DTO, dan akses media; scope rute baru harus dikonfirmasi sebelum JSX.                                                                                      |
| GAP-03 Diskon sederhana           | PRD 12.2 menyertakan diskon sederhana. `billing.service.ts` menyatakan diskon belum dikonfigurasi; field `discountMinor` keluaran dan fungsi hitung belum merupakan command bisnis.                                          | Alokasikan checkpoint POS sebelum klaim POS Basic lengkap: input berizin, batas, hitungan server/snapshot, audit, pajak, refund, dan test. Jangan menafsirkan kolom database sebagai fitur selesai.                                                                           |
| GAP-04 Pembayaran campuran        | PRD 12.2 dan flowchart 5.3. `payOrderSchema` menerima satu metode; `recordFullPayment` membayar penuh. Tabel alokasi tidak dengan sendirinya menyediakan mixed payment.                                                      | Alokasikan checkpoint ledger/POS: beberapa tender, jumlah tepat, transaksi atomik, idempotency, kas/non-tunai, struk, dan refund. Tidak mencampur pekerjaan ini dengan penataan ulang rute.                                                                                   |
| GAP-05 Menu tamu tanpa gambar     | PRD Catalog 11.1 dan tier 3.2 mencakup foto produk; M4-BE-05/FT-08 mencatat gambar menu tamu belum dikirim karena URL gambar staf membawa ID workspace.                                                                      | Tetapkan akses media publik yang aman, bukan mengirim URL staf atau ID workspace. Verifikasi tampil/fallback, privasi, S/M/L, dan dua tema.                                                                                                                                   |
| GAP-06 Struk kunjungan            | FLOOR-005 membatasi UI Basic ke satu bill per sesi; M4-BE-08 membayar kunjungan dengan satu pembayaran yang dialokasikan ke bill per pesanan. Struk per pesanan masih menampilkan pembayaran gabungan.                       | Review konsistensi representasi bill/struk terhadap FLOOR-005 sebelum menutup gap; butuh struk kunjungan tanpa nominal diterima/kembalian berulang atau menyesatkan. Skema per-order bukan alasan menurunkan kontrak UI.                                                      |
| GAP-07 Customer mandiri           | PRD 20.1–20.2: contact list sederhana tanpa POS. API pelanggan tersedia, tetapi UI hanya di sheet pesanan POS; `/customers` belum ada.                                                                                       | Alokasikan surface Backoffice sebelum paket Customer-only dirilis. Inventaris field, izin kontak dan nominal, pencarian, serta scope riwayat ditentukan sebelum JSX.                                                                                                          |
| GAP-08 Limit sumber API KDS       | Packages & Limits 5.4: KDS Basic standalone satu external intake source. Dimensi/gauge tersedia, tetapi TODO 14.21 mencatat angka limit belum diisi pada paket lokal; tanpa angka gerbang tidak membatasi.                   | Periksa snapshot paket dan kebijakan paket berversi sebelum migrasi data. Buktikan sumber kedua ditolak pada paket Basic yang dibatasi, perbedaan paket/override dihormati, dan sumber lama tidak dicabut oleh downgrade. Jangan mengedit isi versi PUBLISHED yang immutable. |

### Pembaruan GAP-01 — selesai teknis, review visual terbuka

M4-GAP01-BE dan UI/E2E sudah terverifikasi lokal dan dipush sebagai `93f4931`. QR baru menunggu staf tanpa event dapur/tagihan; endpoint accept/reject berizin mengubah keputusan/audit/outbox atomik. Panel kunjungan yang ada menyediakan review snapshot dan form alasan inline, pending ditemukan dari tile tanpa queue duplikat. Billing, claim, close dan progress/KDS tetap digerbang di server. Migrasi mempertahankan order lama dan belum diterapkan pada development. 21 integrasi PostgreSQL, root gates/build serta 16 browser test (empat test staf disposable + 12 mock tamu), 40 capture lulus; screenshot sampel dibaca, bukan seluruhnya atau persetujuan visual otomatis. GAP-01 selesai teknis, tetapi M4 belum diterima dan GAP-06 tetap terbuka; penyelesaian gambar dicatat pada pembaruan GAP-05 berikut. Rincian [kontrak dan bukti](./M04-moderasi-basic.md#9-bukti-checkpoint-m4-gap01-ui). Tabel di atas mencatat baseline sebelum perbaikan.

### Pembaruan GAP-05 — selesai teknis dan dipush `e287eb4`

Menu tamu kini memuat flag `hasImage`; foto dibaca dari endpoint QR/product same-origin, bukan URL/ID gambar staf atau redirect storage. Gate QR + menu sellable, ownership Catalog, bounded 5 MB/timeout/no-redirect/sniff pada Core Files, rate limit terpisah dan header no-store melindungi akses. Foto/fallback memakai ProductTile yang ada; tidak ada route page baru, bucket/data development atau dependency baru. 22 integrasi penuh, tiga browser media (12 kombinasi, 14 capture; empat sampel dibaca), regresi moderasi 16 browser dan root gates/build lulus. GAP-05 selesai teknis dan dipush `e287eb4`, bukan acceptance M4; bukti/batas operasional pada [checkpoint gambar](./M04-gambar-menu-tamu.md#5-bukti-dan-batas-checkpoint). Tabel register di atas tetap merekam baseline sebelum koreksi.

### Pembaruan GAP-06 — A selesai teknis, B tetap terbuka

Checkpoint GAP06A mengoreksi struk per-order: nominal allocation ledger aktual dan label bagian pembayaran menggantikan nominal transaksi gabungan pada rendering shared; snapshot payment, refund dan kas tetap asli. Receipt fresh-read, Print disabled saat fetch/paused/error dan fail-closed allocation tak representable diuji. 29 integrasi penuh (7 khusus allocation), 4 browser/22 capture, regresi 16 moderasi + 3 gambar, root gates/build lulus; sembilan sampel dibaca. Diverifikasi dan dipush sebagai `d86dd72`; bukti pada [checkpoint struk](./M04-struk-kunjungan.md#6-bukti-checkpoint-a). **GAP06B — bill/struk satu kunjungan sesuai FLOOR-005 — belum diimplementasikan**, sehingga GAP-06 dan penerimaan M4 tetap terbuka. Tabel baseline di atas tidak diubah menjadi klaim selesai.

### Pembaruan GAP-08 — implementasi tersedia

Commit `e7ac7e3`, migrasi `20261018010000_kds_intake_package_limits`, menyediakan `KDS_ONLY` v1 dengan satu sumber eksternal dan versi penerus paket F&B standar dengan nol sumber eksternal. Tabel di atas merekam temuan baseline, bukan kondisi sesudah perbaikan ini. Snapshot lama dan langganannya tidak diubah; paket custom/override tetap berlaku. Test HTTP memakai paket nyata, bukan gerbang tiruan. Test PostgreSQL membuktikan penolakan sumber kedua, dua pembuat bersamaan hanya menghasilkan satu sumber/audit, override, isolasi, downgrade tanpa pencabutan, dan tempat kembali setelah pencabutan. Bukti commit/gerbang tercatat pada M3-BE-09 dan TODO.

## 4. Utang dan keputusan di luar acceptance lokal

- **M2 masih mempunyai utang tercatat**, bukan dibuka ulang otomatis: layanan email produksi, tujuan upgrade, wajib/tidaknya perangkat POS, provisioning brand/outlet/owner pertama, reset kata sandi, dan limit saat reaktivasi. Rincian TODO 13.59 serta runbook.
- **M5:** putuskan OD-05 (titik potong stok). **M6:** OD-06 (pengakuan pendapatan). **M7:** OD-02 (delivery HC). Tidak ada keputusan tersebut yang dibuat oleh checkpoint ini.
- **M8/M9:** support access, laporan, CSP, trust proxy, pipeline lengkap, monitoring, backup operasional, retention, review kepatuhan, dan pilot tetap terbuka.
- CI hanya `workflow_dispatch`; hasil lokal bukan run hijau GitHub. Sebelum kontributor kedua atau deploy pertama, pulihkan trigger push/PR dan buktikan runner berhasil.
- `schema.md` bagian A dan beberapa tabel/gap pada `architecture.md`, `backend.md`, serta inventaris `design-system.md` masih memuat snapshot historis yang perlu rekonsiliasi lanjutan. Jangan memperlakukannya sebagai bukti modul kini belum ada, atau mengubah requirement hanya agar sesuai kode.
- Beberapa file besar memerlukan checkpoint pemecahan tersendiri. Tidak ada izin reslicing baru dalam dokumen ini.

## 5. Batas bukti verifikasi

Pada pengenalan kembali baseline, pemeriksaan batas modul dan warna, test contracts/web/worker, serta test API (396 lulus pada invocation test sumber API, di luar test skrip boundary) berhasil. Tidak ada perubahan kode setelah pemeriksaan itu dalam checkpoint dokumentasi ini.

**Pembaruan penutupan teknis M3:** lint/typecheck/test/format root dan validasi skema lulus; seluruh 20 test integrasi PostgreSQL serta build API/web/worker lulus. P99 terakhir 1.162 ms untuk 200 pesanan adalah hasil mesin lokal. Test browser KDS tersimpan kini memakai database/API disposable (M3-QA-04): tiga test dengan 32 kombinasi layar/tema/bahasa, manual/status/riwayat, suara/keyboard, kios, offline/recovery, serta API intake/limit/cabut lulus; screenshot sampel desktop/mobile/tablet/kios/limit dibaca. Pengujian itu bukan uji monitor fisik. Regresi integrasi M4 ikut lulus dalam suite penuh, tetapi tidak ada acceptance visual M4 baru dalam batch khusus M3. API fixture berhenti dan database sementaranya dihapus setelah suite; API/worker development tidak dinyalakan.

Verifikasi khusus perubahan dokumentasi dicatat di [TODO](../../TODO.md): diff whitespace, tautan lokal, dan rujukan sumber/kondisi kode. Tidak ada migrasi, perubahan data lokal, atau klaim siap produksi.

## 6. Urutan yang disarankan

1. Review penutupan teknis M3 dan jalankan gate monitor dapur pada [M3 bagian 7](./M03-kds.md); hanya pengguna yang dapat mengonfirmasi hasil fisiknya.
2. Tandai M3 Selesai setelah penerimaan/gate terpenuhi atau gate diubah secara eksplisit oleh pengguna. Tidak ada implementasi M4/M5 lanjutan pada batch M3.
3. Setelah diizinkan melanjutkan M4, ambil checkpoint moderasi Basic (GAP-01) dengan scope backend/interaksi yang jelas; gap lain tetap perlu alokasi terhadap kontrak produk.
4. Mulai M5 hanya setelah gate diterima atau pengguna secara eksplisit memutuskan pengecualian. Satu checkpoint tetap diverifikasi dan dipush sebelum checkpoint berikutnya, kecuali instruksi batch eksplisit.
