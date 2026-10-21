# M5-BE-01B2d1 — Kontrak/query item Inventory

**Status:** Selesai teknis/terverifikasi, baseline `6fda28a`; commit/push dicatat setelah gate akhir. Internal read-only checkpoint, bukan API/UI atau acceptance M5.

## 1. Kontrak dan inventaris data

PRD §15.2/INV-001/INV-003/INV-009 serta privacy PRD §4.3 dan otorisasi foundation/security §7 mengatur item mandiri tanpa Catalog, minimum threshold bukan saldo, dan biaya/HPP hanya dalam workflow berizin yang memiliki sumber valid. Schema B1 memiliki item master, belum ledger/cost projection.

| Data                                                                                                     | Klasifikasi               | Lokasi/tujuan                                                                                                                                                     |
| -------------------------------------------------------------------------------------------------------- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| limit, cursor                                                                                            | User input query          | Keyset immutable ID asc; default 25, maksimum 100, peek satu                                                                                                      |
| status, categoryId, baseUnitId                                                                           | User input query opsional | Exact filters AND; absent status berarti semua, UUID canonical case-insensitive                                                                                   |
| id, sku, name, categoryId, baseUnitId, minStock, status                                                  | Read-only display         | DTO master tunggal strict; sku/categoryId/minStock required nullable, bukan fake empty/zero. MinStock decimal string eksak tanpa exponent/rounding, bukan balance |
| hasNextPage, nextCursor                                                                                  | Derived display           | Page metadata, bukan payload mutasi atau total count                                                                                                              |
| tenant/actor/timestamp/audit/latch, outlet scope, parent names/status/dimension, contacts, Catalog links | Hidden/out of scope       | Scope dari fresh authorizer, parent definitions dibaca melalui port existing; tidak join/copy data tanpa tujuan                                                   |
| HPP/cost/price/margin/valuation, balance/lowStock                                                        | Hidden/out of scope       | Tidak dipilih/diterima pada query/DTO, tidak fake zero; financial projection dan ledger belum tersedia. Izin baca operasional bukan izin finance                  |

Tidak ada JSX; inventaris ini juga bukan persetujuan field form mutasi item berikutnya. Nullable category berarti memang tidak dikategorikan; minStock NULL berarti belum ditetapkan dan `"0"` berarti threshold nol nyata. Kategori INACTIVE pada relasi lama tetap terbaca; query tidak menyembunyikan item berdasarkan status parent atau menganggap read sebagai izin assignment parent. New parent ownership/status/locking dan LimitGate tetap command item berikutnya.

## 2. Akses dan batas

Reuse fresh `InventoryMasterReadAuthorizer` sebelum validation/IO pada setiap halaman: active membership/user, usable subscription, entitlement/install ACTIVE, capability `inventory.item.manage`, salah satu izin operasional receive/adjust/stocktake atau master manage. Staf scoped-outlet boleh membaca master bersama tanpa saldo/biaya; device ditolak. Tidak grant permission/capability atau aktivasi modul baru.

Port item terpisah, Prisma narrow select tujuh field, tenant UUID wajib sebelum IO (undefined filter fail closed), status/category/unit filters dan cursor semuanya AND tenant. Foreign/missing parent filter mengembalikan empty, tidak lookup global atau membocorkan existence. Foreign/arbitrary cursor hanya posisi, bukan scope. Limit+1 tanpa COUNT; use case memvalidasi bounded page, filter, ordering/cursor, strict DTO. Tidak menjanjikan snapshot stabil saat ada insert/update antarpages; stable rows diuji lengkap tanpa duplicate/skipped.

Tidak ada migration, mutation, audit/event/idempotency write, AppModule/manifest/HTTP/OpenAPI/UI, cost DTO, development migration/data mutation atau deploy. SQL hanya database disposable invocation-owned.

## 3. Gate

- [x] Strict contracts dan source use case: nullable/exact minStock, query bounds/filters, auth-first, leak rejection, bad port pagination/filter/order.
- [x] PostgreSQL disposable: >100 rows, exact/empty pages, precision extremes/null/zero, parent inactive/unknown legacy dimension, cross-tenant filters/cursor, fresh revocations/device/mismatch, invalid adapter scope dan no writes.
- [x] Root lint/boundaries/colors/typecheck/test/format, Prisma validate, full integration, isolated API/web production build; restore next-env. TODO dan evidence diperbarui; commit/push dicatat setelah gate akhir.

## 4. Bukti dan batas

- **4 contracts + 6 source tests baru**: tujuh field strict read-only, required nullable SKU/category/minimum; minStock NULL, explicit zero, smallest scale-six dan maksimum 24+6 digit tetap beda/eksak. Query strict menolak scope/finance/mutation fields, status/filter/limit/cursor invalid; page metadata bounded/coherent tanpa total. Fresh auth mendahului validation/IO. Port salah filter/order/duplicate/pre-cursor/unbounded atau DTO leak termasuk peek ditolak, bukan silently filtered/stripped.
- **10 PostgreSQL tests baru (satu induk + sembilan subtest)** pada database disposable invocation-owned: 107 item lintas max/small keyset pages tanpa duplicate/skip; exact-limit/empty tanpa fake facts; seluruh kombinasi status/category/base-unit AND filters; foreign/missing parent empty, foreign/arbitrary cursor scoped position, UUID case-insensitive. Category inactive tetap terbaca pada existing active item. Legacy NULL-dimension unit/item di-seed melalui beforeMigration sebelum guard dimensi, bukan melemahkan guard atau menyisipkan unit baru tanpa dimensi.
- Facade entitlement facts fixture + membership/role/user PostgreSQL nyata: empat permission existing untuk outlet-scoped staff; permission/membership/user/subscription/module/capability/install revocation menolak next page sebelum item IO; device/membership/workspace mismatch ditolak. Bukan HTTP/session atau aktivasi capability sungguhan.
- Snapshot seluruh enam master (termasuk latch/timestamp), audit/key/outbox/install/usage counter/event identik sesudah reads. Catalog/POS/KDS tidak terpasang/tidak ditulis. No-op write semantics tidak berlaku di sini karena command mutasi belum ada; reader hanya SELECT.
- **158 integrasi Inventory terfokus dan 201 integrasi PostgreSQL penuh lulus, 0 gagal/skip**. Root lint/boundaries/colors/typecheck/test/format dan Prisma validate lulus: **527 API source + 6 scripts, 85 contracts, 285 UI, 69 web TS + 10 scripts**, database 3, worker 10. Build API/web produksi terisolasi `.next/inventory-item-query-build` lulus; next-env dipulihkan sebelum final typecheck. `git diff --check` dan final format/typecheck lulus. Log `.cache/m5-item-query-*` Git-ignored; warning pg existing tidak diklaim diperbaiki. Type narrowing fixture dan historical seed/counter composite-order fixture dikoreksi sebelum full passing run, tanpa production policy/schema change.
- Tidak ada JSX/label UI baru (browser/visual tidak dijalankan), new dependency/grant/migration, runtime/HTTP/manifest wiring, mutation/LimitGate atau HPP/balance projection. Query-only completion bukan delivery capability/master-item CRUD/BE-01/FT-01/end-to-end/acceptance M5. Data development tidak dimigrasi/diubah.

## 5. NEXT

B2d2 create item: field inventory/input vs derived/read-only ditetapkan sebelum implementasi, fresh master/all-outlet access, category/base-unit ownership/status/reference rules, minimum precision, active-item LimitGate, audit dan idempotency atomik. Tidak mulai sebelum checkpoint query ditutup; belum endpoint/UI atau stock integration/OD-05.
