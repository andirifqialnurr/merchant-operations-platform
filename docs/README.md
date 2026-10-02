# Dokumentasi Cafe Companion Pro

**Status:** Indeks source of truth
**Diselaraskan:** 2 Oktober 2026

Dokumen produk dan foundation di folder ini menjadi dasar keputusan. Dokumen kemajuan implementasi tidak boleh mengubah cakupan hanya agar sesuai dengan kode yang sudah ada.

## Mulai dari sini

| Ingin tahu | Baca |
|---|---|
| Aplikasi ini apa dan cakupannya | [`product/prd.md`](./product/prd.md) |
| Tampilan, komponen, aturan halaman | [`foundation/design-system.md`](./foundation/design-system.md) |
| Alur layar per pengguna | [`foundation/flowchart.md`](./foundation/flowchart.md) |
| Batas teknis dan keputusan arsitektur | [`foundation/architecture.md`](./foundation/architecture.md) |
| Tabel database | [`foundation/schema.md`](./foundation/schema.md) |
| Struktur dan aturan kode backend | [`foundation/backend.md`](./foundation/backend.md) |
| Struktur dan aturan kode frontend | [`foundation/frontend.md`](./foundation/frontend.md) |
| Keamanan dan privasi | [`foundation/security.md`](./foundation/security.md) |
| Lingkungan, build, rilis | [`foundation/deploy.md`](./foundation/deploy.md) |

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
11. [`TODO.md`](../TODO.md) — checkpoint aktif dan urutan pengerjaan.

Bila terjadi konflik, dokumen dengan urutan lebih tinggi mengatur area tanggung jawabnya. Keputusan teknis tidak boleh mengubah capability produk tanpa menyelaraskan dokumen produk.

## Struktur folder

- `docs/product/` — kontrak produk, tier, paket, limit, arah rilis.
- `docs/foundation/` — arsitektur, skema, backend, frontend, keamanan, deploy, design system, alur, dan audit.
- `apps/web/src/app/foundation/page.tsx` hanyalah rute pratinjau development, bukan dokumentasi.

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

Backend (login, organisasi, peran dan izin, langganan, audit, keamanan dasar) lebih maju daripada UI. Di web, hanya Catalog Backoffice yang terhubung ke API; POS, KDS, dan Inventory masih placeholder; Floor, Finance, HC, Customer, Reports, Settings, dan Platform Admin belum punya rute. Bank warna baru sudah diterapkan; ikon dan dua bahasa belum. Rincian per area ada di `prd.md` bagian 11.1.

Kredensial aplikasi lokal dikelola terpisah di `CREDENTIALS.local.md` dan bukan bagian dari source of truth produk.
