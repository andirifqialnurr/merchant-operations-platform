# M5 — kategori Inventory

**Status:** Selesai teknis/terverifikasi — B2c1 query kategori berizin, baseline `89aaeb1` setelah update factor `c91ba73`; implementasi `30cb048` dipush ke `origin/main`. Parent B2/B/BE-01/FT-01 belum selesai.

## 1. Kontrak sebelum implementasi

PRD §15 (category/item master mandiri), Module Tiers §7, schema B.6, backend/security dan NEXT M5 mengatur checkpoint ini. Kategori dimiliki Inventory (`inventory_categories`), bukan kategori Catalog. Hanya kontrak read/port/Prisma reader/use case internal; tidak membuat tabel, migration, grant, mutation/create/update/status workflow, AppModule/manifest/HTTP/OpenAPI/JSX, ledger atau aktivasi capability.

- Query strict hanya cursor UUID, limit 1–100 (default 25), status opsional `ACTIVE`/`INACTIVE`. Tanpa filter status berarti **semua status**, bukan implicit ACTIVE; pilihan eksplisit menghasilkan filter exact, tidak fallback unfiltered. Nama/pencarian/ID lookup/item count bukan tambahan input pada checkpoint list ini.
- DTO strict hanya `id/name/status`. Nama authoritative max 160 karakter sesuai master B1; status dari enum record Inventory, bukan status Catalog atau client assertion. Tidak ada tenant/outlet/actor/timestamp, item relation/count, saldo/cost/HPP/contact, quota usage atau nol placeholder. Kategori inactive tetap tersedia untuk konteks histori/administrasi bila diminta; membaca bukan hak mutasi/aktivasi.
- Fresh authorizer read existing B2a sebelum validasi/IO pada setiap query: membership/user/workspace aktif dan identity cocok, subscription usable, instalasi ACTIVE (missing ditolak), capability `inventory.item.manage`, salah satu permission `inventory.master.manage`/`inventory.receive`/`inventory.adjust`/`inventory.stocktake`. Tidak memakai nama role/body sebagai otorisasi dan tidak menambah grant baru. Device session ditolak. Staf scoped-outlet boleh membaca definisi workspace bersama yang tidak memuat data finansial/outlet, bukan hak mutation all-outlet.
- Port reader kecil khusus kategori, menggunakan `InventoryMasterScope` existing. Tidak memperlebar port unit/conversion dan tidak menambahkan method kategori ke fake/writer resource lain. Adapter memvalidasi tenant/query juga untuk caller internal agar undefined scope tidak menjadi query semua workspace.
- ORM select eksplisit tiga kolom, WHERE tenant_id + optional status + id > cursor, ORDER BY id asc, TAKE limit + 1. Tidak ada count/lookup cursor lain/include item atau Catalog. Cursor adalah posisi UUID, termasuk cursor asing/acak; tidak dibaca sebagai row tenant lain dan tidak mengungkap kepemilikan. PageInfo derived bounded: hasNextPage dan nextCursor hanya dari peek; tanpa total palsu.
- Shared response schema memvalidasi page, status dan DTO; use case menolak hasil port di luar limit+1 atau tidak sesuai filter status (bukan menyembunyikan masalah dengan filter di memory). Keyset menjaga posisi, bukan snapshot lintas request: perubahan status/kategori di antara page merupakan perubahan data nyata, tidak dijanjikan snapshot daftar penuh.
- Query tidak melakukan mutation/audit write/idempotency/LimitGate/event. Tidak ada dimensi kuota kategori yang diciptakan. Create/update/lifecycle kategori dan master lain tetap checkpoint berikutnya, dengan audit/idempotency/CI conflict dan parent/limit sesuai resource; query saja bukan penyelesaian B2/BE-01/Inventory-only end-to-end.

## 2. Inventaris data (tanpa JSX)

| Datum                                        | Klasifikasi                   | Aturan                                                     |
| -------------------------------------------- | ----------------------------- | ---------------------------------------------------------- |
| cursor/limit/status filter                   | User input query              | Strict/bounded; status filter tidak menjadi mutation body. |
| category id/name/status                      | Read-only authoritative       | Satu DTO Inventory, tidak digabung kategori Catalog.       |
| pageInfo.hasNextPage/nextCursor              | Derived display/read metadata | Dari bounded peek, tidak menjadi fakta stok/count.         |
| tenant/outlet/actor/timestamp/audit/identity | Hidden/system-only            | Dari adapter/Core, bukan payload query pengguna.           |
| item relation/count/saldo/cost/contact/usage | Out of scope                  | Tidak dirender/dikirim/diisi nol sebagai tambahan.         |

## 3. Gate

- [x] Contracts/source: strict query/status/DTO/page, auth-before-IO, bounded/filter port refusal, empty/partial page dan privacy failures.
- [x] PostgreSQL disposable: all/ACTIVE/INACTIVE/keyset pages tanpa duplikasi/lompatan untuk data stabil, cross-tenant/foreign cursor, missing scope/invalid filter, real scoped membership/permissions dan fresh revocation/entitlement/device refusal sebelum reader, snapshot no-write/standalone.
- [x] Root lint/boundary/warna/typecheck/test/format, Prisma validate, build API/web terisolasi; TODO/milestone diperbarui. Implementasi terverifikasi, di-commit dan dipush sebagai `30cb048` ke `origin/main`. Tanpa JSX/HTTP sehingga browser bukan gate.

## 4. Bukti dan batas

- **4 contracts + 6 source tests baru**: strict bounded/status query, default all-status, narrow id/name/status DTO tanpa metadata/financial/count fields, bounded page/end-cursor/no fake totals. Query tests auth-first/normalization/filter forwarding, invalid inputs sebelum reader, empty/exact-limit page, unbounded/wrong-filter port refusal dan fail-closed leaked/invalid output.
- **9 PostgreSQL tests baru (induk + 8 subtest)**: 107 kategori tenant A (ACTIVE/INACTIVE) dan empat tenant B (ACTIVE saja), tenant kosong; page 100/7 dan 37 tanpa duplicate/lompatan pada dataset stabil. Raw adapter terbukti maksimal limit+1 (101 untuk limit 100), semua row/peek hanya tiga kolom DTO. Filter status exact melintasi keyset 17, empty inactive/empty workspace tanpa row/count/cursor palsu. Cursor asing/acak/uppercase hanya posisi tanpa foreign row lookup/exposure.
- Staf dengan assignment satu outlet/allOutlets=false membaca shared categories melalui masing-masing receive/adjust/stocktake/master permission existing. Setiap query memuat fakta entitlement fresh; permission/user/membership/subscription/module/install/capability dicabut atau device/identity foreign membuat query ditolak sebelum reader, bukan memakai hasil izin page sebelumnya. Test role/membership/facts diubah hanya sebagai fixture disposable, bukan production grant/aktivasi.
- Internal scope absent/invalid dan query/status invalid gagal sebelum broad/unfiltered query. Snapshot sebelum/sesudah seluruh read menunjukkan enam master (termasuk latch/timestamps), audit/outbox/idempotency/installation tidak berubah. Query tidak membuat Catalog/POS/KDS/install records; entitlement facts tetap facade fixture, bukan HTTP/session atau aktivasi modul sungguhan.
- **102 integrasi Inventory terfokus dan 145 integrasi PostgreSQL penuh lulus, 0 gagal/skip**. Seluruh history migration diuji hanya pada database disposable milik invocation; checkpoint tidak menambah migration/DDL/Prisma model atau memutasi data development. Warning deprecation `pg` dari suite existing tetap tercatat, bukan klaim diperbaiki.
- Root gates lulus: **500 source API + 6 scripts, 72 contracts, 285 UI, 69 web TS + 10 scripts**, database 3 dan worker 10. Prisma validate dan build API/web produksi terisolasi `.next/inventory-category-read-build` lulus; generated next-env dipulihkan sebelum typecheck final. Log `.cache/m5-category-read-*` Git-ignored. `git diff --check`, format checkpoint dan 134 tautan file lokal lulus. Tidak ada dependency/JSX/label UI baru, sehingga browser/Storybook visual tidak dijalankan.
- Belum mutation kategori/status workflow, grant baru, AppModule/manifest/HTTP/OpenAPI/module activation/capability delivery, ledger/item/supplier/location/API/UI Inventory. Query kategori selesai teknis, bukan penyelesaian B2/BE-01/FT-01/Inventory-only end-to-end atau acceptance M5.

## 5. NEXT

NEXT saat B2c1 ditutup adalah B2c2 create kategori Inventory. Kini [B2c2](./M05-pembuatan-kategori.md) selesai teknis/terverifikasi: CI name uniqueness scoped/strict name-only/ACTIVE server-owned dan audit/idempotency/fresh all-outlet master access. NEXT aktif B2c3a update nama kategori; lifecycle kategori dan item/supplier/location/LimitGate terkait tetap berikutnya. Tidak memulai endpoint/reslicing atau memilih OD-05 dari query kategori ini.
