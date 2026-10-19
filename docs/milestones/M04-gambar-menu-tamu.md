# M4 — gambar menu tamu (GAP-05)

**Status:** selesai teknis dan terverifikasi lokal; dipush ke `origin/main` sebagai `e287eb4` setelah moderasi `93f4931` dan pencatatan push `ee4945e`. Review visual pengguna/penerimaan M4 tetap terbuka.
**Scope:** foto produk pada `/t/[token]` yang sudah ada, bukan profil `/m/[slug]`, reslicing route, upload baru, atau struk GAP-06. Commit/push wajib sesudah verifikasi sebelum task berikutnya.

## 1. Sumber dan audit

PRD Catalog 11.1 dan Module Tiers 3.2 mencakup foto produk; register [GAP-05](./REVIEW-M03-M04.md) mencatat menu tamu belum membawa foto karena URL staf menyertakan workspace. Sumber teknis: [security 12](../foundation/security.md), [frontend](../foundation/frontend.md), [design system](../foundation/design-system.md).

- Kernel Catalog memilih gambar primary aktif pada menu sellable. DTO staf membawa `imageId`; menu tamu sengaja menghilangkannya.
- Endpoint staf `catalog/tenants/:tenantId/product-images/:imageId/content` memerlukan membership lalu redirect ke URL storage bertanda tangan. Tidak boleh dipakai sebagai URL tamu, membuang auth, atau mengirim redirect/object key staf.
- `core/files` sudah memvalidasi ownership key, tipe raster, magic bytes dan batas 5 MB saat attachment. Adapter S3 hanya punya HEAD, baca awal, remove dan signed URL; belum ada pembacaan penuh dengan batas streaming untuk proxy publik. `readStart` bukan pengganti bounded full read.
- `ProductTile` sudah punya foto dan fallback netral saat absen/gagal. Tidak membuat komponen atau kartu baru.

## 2. Kontrak akses

- Tambahkan `hasImage` boolean pada produk DTO tamu. Hanya flag ketersediaan gambar primary aktif, bukan ID gambar, URL staf, workspace/outlet ID, object key atau signed query. ID produk/kategori tetap allowed karena dipakai memesan.
- Browser membentuk alamat same-origin `/api/v1/public/table-qr/:token/products/:productId/image` dari token yang sudah ada di alamat dan ID produk yang sudah publik. Token tidak ditambahkan kembali ke body menu/respons.
- Request gambar memeriksa ulang QR/subscription/instalasi/outlet serta produk yang saat ini benar-benar sellable pada outlet itu. Gunakan kernel Catalog/domain yang sama, jangan menulis aturan eligibility kedua atau membaca tabel Catalog dari Floor. Hanya gambar primary aktif milik produk itu.
- Tidak ada sesi merchant yang diperlukan. Token invalid/rotated/revoked/closed, produk asing/tidak sellable/tanpa gambar menghasilkan 404 generik gambar tidak ditemukan, tanpa konteks bisnis baru. Cookie sesi tidak mengurangi gate QR. Endpoint staf tetap privat.
- API mengirim byte gambar, bukan redirect. Semua URL storage hanya dibuat/dipakai server; alamat tujuan berasal dari konfigurasi operator, bukan URL dari tamu. Full read S3 menolak redirect, memakai timeout 10 detik dan menghentikan body yang melampaui batas 5 MB, termasuk jika Content-Length hilang/bohong. MIME dicek ulang dari byte raster yang diterima, bukan header upstream. SVG/HTML/berkas kosong tidak dilayani.
- Respons menggunakan Content-Type raster yang ditemukan, `nosniff`, `Referrer-Policy: no-referrer`, `Cache-Control: private, no-store`; tidak meneruskan header Location, storage/bucket/key/credential. Ini menolak request baru setelah QR dicabut; tidak mengklaim menarik kembali pixel yang sudah terunduh.
- Tambahkan rate limit gambar per QR dan IP sebelum lookup: baseline teknis 120/QR dan 300/IP per menit, terpisah dari quota paket/order. Tidak melonggarkan rate limit pemesanan. Angka perlu evaluasi bandwidth pilot, bukan janji kapasitas produksi.
- Core Files memiliki bounded byte read; Catalog memiliki pemilihan metadata gambar; Floor memiliki otorisasi QR dan hubungan produk dengan menu publik. Tidak ada migrasi atau mutasi database development.

## 3. Inventaris field sebelum JSX

| Datum                                                                      | Klasifikasi               | Lokasi                                                                                            |
| -------------------------------------------------------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------- |
| Ketuk produk, opsi, jumlah, catatan                                        | User input yang sudah ada | Alur keranjang tetap, payload tidak ditambah flag gambar/URL                                      |
| Nama/harga/opsi produk                                                     | Read-only                 | Lokasi ProductTile/pemilih opsi yang sudah ada, tidak diulang pada foto                           |
| Foto primary yang tersedia                                                 | Read-only                 | Satu area media ProductTile; alt kosong dekoratif karena nama produk sudah tertulis               |
| `hasImage`, pilihan layout dengan foto                                     | Derived/display flag      | Menentukan props komponen/layout; tidak menjadi field input atau badge baru                       |
| Foto hilang/rusak                                                          | Conditional display       | Fallback komponen netral, bukan gambar palsu atau teks fakta tambahan; produk tetap dapat dipilih |
| ID workspace/outlet/gambar, signed URL, object key, metadata/audit storage | Hidden                    | Tidak ada pada JSON/header/content tamu                                                           |

Tetap Calm Neutral/id/en, tidak menambah page description/CTA/kartu bersarang. Foto hanya menambah informasi produk yang memang dikontrakkan, tanpa mengubah moderasi/status/pembayaran. Gunakan kemampuan foto `ProductTile` yang ada; halaman tanpa foto tetap compact.

## 4. Acceptance

- Unit: bounded stream (header benar/hilang/bohong), batas/timeout/redirect, missing storage dan sanitasi error, ownership/magic bytes, metadata primary aktif. Test tidak mengakses bucket development.
- Integrasi HTTP disposable: gambar valid tanpa sesi mengirim byte raster yang sama; JSON/header tidak membawa ID internal/key/signed URL; endpoint staf masih 401 tanpa sesi; invalid/cabut/rotasi/tutup/tidak-sellable/produk outlet lain ditolak sebelum baca storage. Storage raster palsu/oversize/down aman; rate limit diuji.
- Browser: foto tampil dengan naturalWidth > 0 melalui endpoint nyata, fallback jika 404/503, tanpa foto, klik produk/keranjang tetap bekerja. Uji 320/768/1440 × light/dark × id/en dan baca screenshot sampel, bukan persetujuan otomatis pengguna.
- Root lint/boundary/warna, typecheck, test, format, build API/web. Update TODO/milestone/security dengan bukti dan batas yang benar, commit dan push sebelum lanjut. GAP-06/M5/review fisik M3 tetap terbuka.

## 5. Bukti dan batas checkpoint

- Implementasi: Core Files menyediakan bounded full read yang memakai endpoint private server, menolak redirect dan membatasi body saat diterima; Catalog hanya mengembalikan konten gambar primary aktif milik workspace; Floor mengotorisasi QR dan menu sellable sebelum membaca konten. Endpoint staf tetap privat dan tidak diubah. Tidak ada migrasi atau dependency baru.
- Guest menu membawa `hasImage`, bukan identifier/URL media staf. ProductTile customer yang sudah ada menampilkan foto; tanpa foto/foto gagal memakai fallback dekoratif dan nama/harga tetap satu lokasi. Jika seluruh menu tanpa foto, layout compact lama dipertahankan. Klik produk dan submit order tetap bekerja ketika storage gagal.
- **22 integrasi PostgreSQL disposable lulus**, termasuk HTTP media baru dengan storage HTTP loopback milik test (bukan bucket development): byte PNG sama persis, MIME dari sniff walau header upstream HTML, tidak ada Location/key/signed URL/ID internal, endpoint staf anonim tetap 401. Produk workspace/outlet lain, inactive/sold-out/category-off, gambar inactive, QR closed/rotated/revoked ditolak sebelum baca storage. Objek storage hilang, HTML, oversize header, oversize stream tanpa Content-Length, down/redirect dan rate limit diuji. Unit juga menguji ownership, penghapusan data tidak terjadi saat GET gagal, timeout signal dan error sanitization.
- **3 browser test lulus**, meliputi 12 kombinasi 320/768/1440 × light/dark × id/en, foto benar-benar terdecode (`naturalWidth > 0`) dari API + private-storage fixture, tanpa foto, foto 503/fallback lalu submit hingga PENDING, dan menu compact tanpa request gambar. **14 capture** di `apps/web/test-results/guest-images`; empat sampel (HP dark en, tablet dark id, desktop light id, fallback 320) dibaca. Aset ilustrasi PNG dibuat di fixture disposable; tidak mengklaim memakai/memverifikasi foto produksi.
- Regresi moderasi **16 browser test lulus** sesudah perubahan media; 40 capture moderasi tetap bukan acceptance pengguna. P99 POS → KDS pada suite integrasi penuh 1.362 ms/200 order (lokal, bukan SLA gambar/produksi). Warning deprecation `pg` masih ada; fault-injection audit 500 adalah ekspektasi regresi rollback, bukan kegagalan suite.
- Root lint/boundary/warna, typecheck/test/format, build API/web terisolasi lulus. 405 test sumber API dan 43 test contracts lulus, termasuk dua test kontrak media privacy/params. Gagal lint awal karena type-only import dan binding fetch test diperbaiki, bukan diabaikan. Tidak ada klaim run CI GitHub atau deploy.
- Runner `pnpm --filter @merchant/web test:e2e:guest-images`: web 4100/output `.next/guest-images-e2e`, API 4101, database baru dan private storage loopback baru; semuanya ditutup/dibersihkan setelah suite. Build memakai `.next/guest-images-build`. File `next-env.d.ts` hasil generated output dikembalikan ke path development bawaan.
- **Batas operasional:** proxy menambah bandwidth/API work dan membuffer maksimal 5 MB per request (plus staging/copy), bukan batas memori global. Belum ada resize/re-encode/CDN cache atau pengujian beban foto produksi; concurrency, bandwidth, angka rate limit dan trust-proxy/Redis perlu verifikasi pilot/hardening. Tidak ada klaim menarik kembali file yang sudah diunduh. Malware scanning/cleanup upload lama tetap utang yang sudah tercatat di security.
- Tidak membaca/mengubah bucket atau database development. Migrasi moderasi dari checkpoint terdahulu tetap perlu diterapkan melalui proses normal sebelum menjalankan seluruh backend baru terhadap schema development lama. **GAP-05 selesai teknis, bukan acceptance M4**; GAP-06 struk kunjungan dan review fisik/visual M3/M4 tetap terbuka. Implementasi dan bukti checkpoint ini dipush sebagai `e287eb4`; task berikutnya tetap wajib verifikasi → commit → push secara terpisah.
