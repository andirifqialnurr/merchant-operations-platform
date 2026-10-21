# Dokumentasi Cafe Companion Pro

**Status:** Indeks source of truth
**Kontrak diselaraskan:** 2 Oktober 2026
**Status implementasi diperiksa:** penutupan teknis M3 (`e7ac7e3`, `10799b9`) setelah baseline M4 `7b61eb1`

Dokumen produk dan foundation di folder ini menjadi dasar keputusan. Dokumen kemajuan implementasi tidak boleh mengubah cakupan hanya agar sesuai dengan kode yang sudah ada.

## Mulai dari sini

| Ingin tahu                                       | Baca                                                           |
| ------------------------------------------------ | -------------------------------------------------------------- |
| Aplikasi ini apa dan cakupannya                  | [`product/prd.md`](./product/prd.md)                           |
| Tampilan, komponen, aturan halaman               | [`foundation/design-system.md`](./foundation/design-system.md) |
| Alur layar per pengguna                          | [`foundation/flowchart.md`](./foundation/flowchart.md)         |
| Batas teknis dan keputusan arsitektur            | [`foundation/architecture.md`](./foundation/architecture.md)   |
| Tabel database                                   | [`foundation/schema.md`](./foundation/schema.md)               |
| Struktur dan aturan kode backend                 | [`foundation/backend.md`](./foundation/backend.md)             |
| Struktur dan aturan kode frontend                | [`foundation/frontend.md`](./foundation/frontend.md)           |
| Keamanan dan privasi                             | [`foundation/security.md`](./foundation/security.md)           |
| Lingkungan, build, rilis                         | [`foundation/deploy.md`](./foundation/deploy.md)               |
| Langkah operator saat menyiapkan atau memulihkan | [`foundation/runbook.md`](./foundation/runbook.md)             |
| Rencana kerja per milestone dan task berikutnya  | [`milestones/README.md`](./milestones/README.md)               |

## Urutan source of truth

1. [PRD Modular Platform v2.3](./product/CAFE-COMPANION-PRD-V2-MODULAR-PLATFORM.md) — requirement bernomor, batas modul, integrasi, acceptance criteria. Otoritas tertinggi untuk cakupan produk.
2. [`product/prd.md`](./product/prd.md) — ringkasan terkonsolidasi dan keputusan 2 Oktober 2026 (D-01 sampai D-08). Untuk tema, font, ikon, dan bahasa, keputusan di sini menggantikan pernyataan lama di PRD v2.3 bagian 33.1 dan 35.6.
3. [Module Tiers v1.2](./product/CAFE-COMPANION-MODULE-TIERS-V1.md) — capability Basic/Pro/Advanced dan status delivery.
4. [Packages and Limits v1.2](./product/CAFE-COMPANION-PACKAGES-LIMITS-V1.md) — komposisi paket, limit, add-on, enforcement. Angka masih baseline, bukan harga.
5. [`foundation/architecture.md`](./foundation/architecture.md) — batas teknis.
6. [`foundation/schema.md`](./foundation/schema.md), [`backend.md`](./foundation/backend.md), [`frontend.md`](./foundation/frontend.md), [`security.md`](./foundation/security.md), [`deploy.md`](./foundation/deploy.md) — kontrak per lapisan.
7. [`foundation/design-system.md`](./foundation/design-system.md) — kontrak visual dan interaksi.
8. [`foundation/flowchart.md`](./foundation/flowchart.md) — alur interaksi pengguna.
9. [`foundation/design-system-modules.md`](./foundation/design-system-modules.md) — pemetaan modul ke shell, layar, komponen, dan data guard.
10. [`foundation/DESIGN_SYSTEM_APP_AUDIT.md`](./foundation/DESIGN_SYSTEM_APP_AUDIT.md) dan [`foundation/BACKEND_MODULAR_DELTA_AUDIT.md`](./foundation/BACKEND_MODULAR_DELTA_AUDIT.md) — bukti kondisi implementasi per 5 Agustus 2026; bukan sumber requirement.
11. [`milestones/`](./milestones/README.md) — rencana kerja Release 1 per milestone (M1–M9) dengan task rinci; tidak menambah cakupan.
12. [`TODO.md`](../TODO.md) — catatan checkpoint aktif dan gate verifikasinya.

Bila terjadi konflik, dokumen dengan urutan lebih tinggi mengatur area tanggung jawabnya. Keputusan teknis tidak boleh mengubah capability produk tanpa menyelaraskan dokumen produk.

## Struktur folder

- `docs/product/` — kontrak produk, tier, paket, limit, arah rilis.
- `docs/foundation/` — arsitektur, skema, backend, frontend, keamanan, deploy, design system, alur, dan audit.
- `docs/milestones/` — rencana kerja per milestone, kriteria selesai, dan task per jalur kerja.
- `apps/web/src/app/foundation/page.dev.tsx` hanyalah rute pratinjau development, bukan dokumentasi dan tidak ikut build produksi.

## Catatan penyelarasan 2 Oktober 2026

- Tema berganti dari Warm Operational (cream/espresso/amber, DM Sans/Fraunces) ke **Calm Neutral** monokrom (abu netral dan tinta, tanpa warna aksen, Geist). Bank warna di kode sudah mengikuti.
- Ikon berganti dari Lucide ke **Tabler Icons**; chart tetap **ApexCharts**.
- UI mendukung **Bahasa Indonesia dan Inggris**; bawaan mengikuti bahasa browser.
- Hosting produksi: VPS sendiri dengan Docker dan Nginx, dikerjakan paling akhir.
- Ditambahkan dokumen `prd.md`, `schema.md`, `backend.md`, `frontend.md`, `security.md`, `deploy.md`, dan `flowchart.md`; `design-system.md` dan `architecture.md` ditulis ulang.
- Bagian visual pada dokumen audit 5 Agustus (yang masih menyebut Warm Operational sebagai target) sudah tidak berlaku; temuan lainnya tetap relevan.

## Dokumen yang digantikan

Pada penyelarasan 5 Agustus 2026, `docs/00-GLOBAL-PRODUCT-SCOPE.md`, `docs/FEATURE_INVENTORY.md`, `docs/versions/*`, dan `docs/packages/*` dihapus karena sudah diserap PRD v2.3, Module Tiers v1.2, dan Packages and Limits v1.2. Jejak keputusan lama ada di PRD v2.3 bagian 4 dan 44 serta Packages and Limits bagian 19.

## Kondisi implementasi

**Pembaruan aktif setelah baseline `6129b5b`:** pengguna secara eksplisit menyatakan **“iya saya menerima lanjut ke m5”**. M4 diterima (implementasi akhir `53592d2`); M5 Inventory kini **Berjalan**, [M5-BE-01A fondasi satuan/jumlah](./milestones/M05-fondasi-satuan.md) dan [B1 schema enam master/guard](./milestones/M05-master-inventory.md) selesai teknis/terverifikasi. B1 hanya migrasi yang diuji di PostgreSQL disposable, belum diterapkan ke development. B2a query unit/conversion berizin kini juga selesai teknis/terverifikasi: port/reader/use case internal dengan DTO sempit, belum diregistrasikan ke AppModule/manifest/HTTP. [B2b1 create unit transaksional](./milestones/M05-pembuatan-satuan.md) juga selesai teknis/terverifikasi, dengan permission master/all-outlet dan audit/replay atomik; migrasi permission hanya diuji disposable. Pengguna kemudian menyetujui [B2b2a dimensi satuan eksplisit](./milestones/M05-dimensi-satuan.md) sebagai prasyarat kompatibilitas; kini selesai teknis/terverifikasi: create/read internal dan legacy unknown tanpa tebakan, 81 integrasi penuh/root gates/Prisma/build API/web lulus, belum writer conversion. Migrasi dimensi hanya disposable. [B2b2b create direct conversion](./milestones/M05-pembuatan-konversi.md) kini juga selesai teknis/terverifikasi: parent scoped/locked/dimensi sama-diketahui, factor eksak, audit/replay atomik dan guard DB, 100 integrasi penuh/root gates/Prisma validate/build API/web lulus. Migrasi guard hanya disposable, tanpa inverse/path otomatis. [B2b3a update unit berizin](./milestones/M05-perubahan-satuan.md) kini juga selesai teknis/terverifikasi: partial patch scoped/locked, guard definisi terpakai, no-op dan audit/replay atomik, 118 integrasi penuh/root gates/Prisma validate/build API/web lulus; tanpa migrasi baru. [B2b3b update factor conversion](./milestones/M05-perubahan-konversi.md) kini juga selesai teknis/terverifikasi: exact factor/immutable pair, compatible parent/pair locks, no-op dan original audit/replay, 136 integrasi penuh/root gates/Prisma validate/build API/web lulus; tanpa migrasi baru. Belum API/UI/ledger atau activation/capability delivery; NEXT B2c1 query kategori Inventory berizin. Penerimaan ini tidak mengklaim uji monitor M3/printer fisik, menutup koreksi M2/M3, menghapus GAP-02/03/04/07 atau mengizinkan deploy/migrasi development/reslicing baru.

**Riwayat sebelum penerimaan M4:**

M1 dan M2 selesai dan sudah disetujui pengguna. Seluruh task implementasi awal M3 (KDS) dan M4 (Meja, Self-Order, Customer) sudah dicatat selesai. Penutupan teknis M3 juga selesai: limit paket `e7ac7e3`, browser disposable `10799b9`, regresi/build lulus. M3 tetap **Menunggu review** pengguna dan uji monitor dapur fisik; M4 kemudian kembali **Berjalan** atas instruksi pengguna `lanjut m4` setelah baseline `2a5f8fd`: BE + UI/E2E [moderasi Basic](./milestones/M04-moderasi-basic.md#9-bukti-checkpoint-m4-gap01-ui) sudah tersedia, terverifikasi lokal dan dipush sebagai `93f4931`; GAP-01 selesai teknis, GAP-05 [gambar menu tamu](./milestones/M04-gambar-menu-tamu.md) juga selesai teknis/terverifikasi lokal dan dipush sebagai `e287eb4`. Penerimaan pengguna M4/FLOOR-005 masih terbuka, sedangkan GAP-06 selesai teknis: [GAP06A](./milestones/M04-struk-kunjungan.md) memperbaiki allocation struk per-order, dan bill/struk satu kunjungan GAP06B kini selesai teknis end-to-end. Fondasi kontrak/proyeksi finansial B-01 sudah dipush (`765d453`); query API snapshot B-02 kini selesai teknis/terverifikasi dan dipush (`86b3eef`; 43 integrasi penuh, root gates/build API/web), UI/cetak B-03 juga terverifikasi: 7 browser/34 capture, 2 smoke Storybook, regresi receipt/moderasi/gambar, root gates dan build API/web/Storybook lulus; dipush sebagai `53592d2`. Review visual pengguna/FLOOR-005 serta printer fisik belum diterima otomatis. Review visual/uji fisik M3 tetap terbuka. Sebelumnya pengguna menolak kualitas visual KDS dan mengizinkan koreksi M3-UX-05 serta audit ulang layout M2. Koreksi KDS/M2 sendiri bukan persetujuan visual; izin lanjut M4 berasal dari instruksi pengguna. M5 belum dimulai.

- Catalog, POS, Pengaturan, KDS, editor/operasi meja, halaman tamu `/t/[token]`, dan pelanggan di POS sudah terhubung ke API. Bank warna Calm Neutral, Tabler, dua bahasa, dan tema terang/gelap sudah dipakai surface tersebut.
- Inventory sudah memiliki fondasi numerik, schema enam master/guard, query unit/conversion (B2a) dan create unit transaksional berizin internal (B2b1), diuji di PostgreSQL disposable; belum diterapkan ke development atau menjadi modul/API/UI operasional. Business Finance, HC, laporan, dan UI Platform Admin belum dibangun. API dasar platform sudah ada; itu bukan UI Platform Admin lengkap. `/inventory` hanya pratinjau development.
- Profil/menu publik `/m/[slug]` dan beberapa capability Basic lain masih memiliki gap; gambar menu tamu kini tersedia melalui proxy QR ber-gate, moderasi pesanan tamu dan bill/struk satu kunjungan selesai teknis dan telah diterima dalam hasil M4; ini bukan penerimaan gap modul lain atau hasil printer fisik. Checkbox task tidak menggantikan acceptance atau kontrak produk.
- Deploy produksi dan pilot belum dikerjakan.

Rincian per area ada di [`product/prd.md` bagian 11.1](./product/prd.md). Mulai pekerjaan berikutnya dari [`milestones/README.md`](./milestones/README.md), [`review M3/M4`](./milestones/REVIEW-M03-M04.md), dan [`TODO.md`](../TODO.md). Dokumen audit bertanggal lama dan checkpoint historis bukan gambaran runtime terkini.

Kredensial aplikasi lokal dikelola terpisah di `CREDENTIALS.local.md` dan bukan bagian dari source of truth produk.
