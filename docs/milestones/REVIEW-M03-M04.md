# Review M3/M4 dan gap Release 1

**Status:** Menunggu review pengguna; bukan persetujuan milestone.
**Baseline kode:** `7b61eb1` (penutupan task M4).
**Lingkup checkpoint:** sinkronisasi status dokumentasi dan pencatatan gap, tanpa perubahan kode, database, atau rute.

## 1. Posisi dan aturan lanjut

- M1/M2 selesai dan disetujui pengguna. M3/M4 berstatus **Menunggu review**; belum ada milestone berikutnya yang Berjalan.
- Permintaan untuk melanjutkan penyelarasan dokumentasi tidak dianggap sebagai persetujuan visual, perubahan scope produk, atau izin memulai M5.
- Checkbox task M3/M4 merekam checkpoint implementasi terdahulu, bukan bukti bahwa seluruh capability Basic sudah lengkap.
- PRD, tier, dan paket tetap otoritas scope sesuai [urutan sumber](../README.md). Gap wajib tidak menjadi future hanya karena belum masuk checklist milestone.

## 2. Gate review M3/M4

### M3 — KDS

- [ ] Pengguna meninjau antrean, manual intake, POS → KDS, API intake, status kembali ke pesanan, suara, dan putus/sambung koneksi.
- [ ] Keterbacaan jarak 1–2 meter diperiksa pada monitor dapur sungguhan. Ini kriteria M3 yang masih terbuka, bukan sesuatu yang dapat ditutup dari screenshot.
- [ ] Gap limit sumber intake pada bagian 3 mempunyai checkpoint penyelesaian sebelum paket terkait dirilis.

Bukti implementasi terdahulu: [M3](./M03-kds.md) dan TODO 14.6–14.23. Angka p99 sekitar 1,29 detik adalah hasil uji lokal terdahulu, bukan SLA atau hasil beban produksi.

### M4 — Meja, tamu, pelanggan

- [ ] Pengguna meninjau editor, buka/pindah/tutup kunjungan, beberapa ronde pesanan, pembayaran kunjungan, QR, permintaan layanan, dan klaim bayar.
- [ ] Privasi telepon pelanggan, konteks outlet, dan riwayat diperiksa dengan peran kasir dan pemilik.
- [ ] Moderasi Basic di bagian 3 ditutup dan diverifikasi sebelum M4 dinyatakan memenuhi kontrak Self-Order Basic. Gambar/struk juga perlu keputusan checkpoint, bukan dihilangkan dari scope diam-diam.

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

## 4. Utang dan keputusan di luar acceptance lokal

- **M2 masih mempunyai utang tercatat**, bukan dibuka ulang otomatis: layanan email produksi, tujuan upgrade, wajib/tidaknya perangkat POS, provisioning brand/outlet/owner pertama, reset kata sandi, dan limit saat reaktivasi. Rincian TODO 13.59 serta runbook.
- **M5:** putuskan OD-05 (titik potong stok). **M6:** OD-06 (pengakuan pendapatan). **M7:** OD-02 (delivery HC). Tidak ada keputusan tersebut yang dibuat oleh checkpoint ini.
- **M8/M9:** support access, laporan, CSP, trust proxy, pipeline lengkap, monitoring, backup operasional, retention, review kepatuhan, dan pilot tetap terbuka.
- CI hanya `workflow_dispatch`; hasil lokal bukan run hijau GitHub. Sebelum kontributor kedua atau deploy pertama, pulihkan trigger push/PR dan buktikan runner berhasil.
- `schema.md` bagian A dan beberapa tabel/gap pada `architecture.md`, `backend.md`, serta inventaris `design-system.md` masih memuat snapshot historis yang perlu rekonsiliasi lanjutan. Jangan memperlakukannya sebagai bukti modul kini belum ada, atau mengubah requirement hanya agar sesuai kode.
- Beberapa file besar memerlukan checkpoint pemecahan tersendiri. Tidak ada izin reslicing baru dalam dokumen ini.

## 5. Batas bukti verifikasi

Pada pengenalan kembali baseline, pemeriksaan batas modul dan warna, test contracts/web/worker, serta test API (396 lulus pada invocation test sumber API, di luar test skrip boundary) berhasil. Tidak ada perubahan kode setelah pemeriksaan itu dalam checkpoint dokumentasi ini.

Browser/visual, integration PostgreSQL, build penuh, dan kondisi layanan lokal **belum diuji ulang** pada checkpoint ini. Screenshot dan hasil browser M3/M4 adalah bukti historis di TODO, bukan pemeriksaan visual baru. Arsip sesi menyatakan web/API/worker/Storybook dihentikan karena tekanan memori; jangan menyimpulkan layanan sekarang hidup atau gagal dari catatan itu.

Verifikasi khusus perubahan dokumentasi dicatat di [TODO](../../TODO.md): diff whitespace, tautan lokal, dan rujukan sumber/kondisi kode. Tidak ada migrasi, perubahan data lokal, atau klaim siap produksi.

## 6. Urutan yang disarankan

1. Selesaikan checkpoint dokumentasi ini dan review hasilnya.
2. Ambil satu checkpoint perbaikan moderasi Basic (GAP-01) setelah scope backend/interaksi dikonfirmasi; persiapkan test integrasi dan visual sesuai risikonya.
3. Tinjau M3/M4 bersama pengguna, selesaikan gap terkait, dan alokasikan gap Release 1 lintas milestone secara eksplisit.
4. Mulai M5 hanya setelah gate diterima atau pengguna secara eksplisit memutuskan pengecualian. Satu checkpoint tetap diverifikasi dan dipush sebelum checkpoint berikutnya, kecuali instruksi batch eksplisit.
