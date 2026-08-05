# Dokumentasi Cafe Companion Pro

**Status:** Source-of-truth index
**Diselaraskan:** 5 Agustus 2026

Dokumen produk dan foundation di folder ini menjadi basis keputusan berikutnya. Dokumen kemajuan implementasi tidak boleh mengubah scope hanya agar sesuai dengan code yang sudah ada.

## Urutan source of truth

1. [PRD Modular Platform v2.3](./product/CAFE-COMPANION-PRD-V2-MODULAR-PLATFORM.md) - visi, scope, module boundary, integration, security, roadmap, dan Release 1.
2. [Module Tiers v1.2](./product/CAFE-COMPANION-MODULE-TIERS-V1.md) - capability Basic/Pro/Advanced, dependency, dan delivery status.
3. [Packages and Limits v1.2](./product/CAFE-COMPANION-PACKAGES-LIMITS-V1.md) - package composition, limit, add-on, usage, dan enforcement. Angkanya masih baseline, bukan harga publik.
4. [Architecture](./foundation/architecture.md) - technical boundary modular monolith, data ownership, API, event, persistence, dan security.
5. [Design System](./foundation/design-system.md) - visual dan interaction contract Warm Operational, light/dark/system, component, responsive, dan accessibility.
6. [Design System per Module](./foundation/design-system-modules.md) - mapping module ke shell, screen, component, state, responsive behavior, dan data guard.
7. [Application Audit](./foundation/DESIGN_SYSTEM_APP_AUDIT.md) - bukti kondisi implementasi dan gap; bukan sumber requirement.
8. [`TODO.md`](../TODO.md) - checkpoint aktif, acceptance gate, dan urutan implementasi.

Jika terjadi konflik, dokumen dengan urutan lebih tinggi mengatur area yang menjadi tanggung jawabnya. Keputusan teknis tidak boleh mengubah capability produk tanpa menyelaraskan PRD dan dokumen tier terkait.

## Struktur folder

- `docs/product/` berisi kontrak produk, capability tier, package, limit, add-on, dan release direction.
- `docs/foundation/` berisi kontrak arsitektur, design system, mapping UI per modul, dan audit aplikasi.
- `apps/web/src/app/foundation/page.tsx` hanya route preview development; file tersebut bukan source-of-truth dokumentasi.

## Dokumen yang digantikan

Pada alignment 5 Agustus 2026, `docs/00-GLOBAL-PRODUCT-SCOPE.md`, `docs/FEATURE_INVENTORY.md`, `docs/versions/*`, dan `docs/packages/*` dihapus karena sudah diserap dan diperinci oleh PRD v2.3, Module Tiers v1.2, Packages and Limits v1.2, serta dokumen foundation.

Traceability keputusan lama tetap tersedia pada PRD bagian 4 dan 44 serta Packages and Limits bagian 19. Harga pada paket lama tidak lagi berlaku sebagai baseline; pricing tetap keputusan terbuka sampai pilot dan validasi komersial selesai.

## Kondisi implementasi

Fondasi backend, API, isolation, security, reliability, dan operational contracts saat ini lebih maju daripada UI route. Source web memiliki device-mode shell, development reference routes, dan Catalog Backoffice yang terhubung API; route POS, KDS, dan Inventory masih placeholder, sedangkan Floor/Table, Finance, HC, Customer/Self-Order, Reports, Settings, dan Platform Admin belum mempunyai route aplikasi aktif.

Status terperinci dan batas verifikasinya dicatat di [Application Audit](./foundation/DESIGN_SYSTEM_APP_AUDIT.md). Credential aplikasi lokal tetap dikelola terpisah di `CREDENTIALS.local.md` dan tidak menjadi bagian source-of-truth produk.
