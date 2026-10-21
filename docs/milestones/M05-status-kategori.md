# M5 — lifecycle kategori Inventory

**Status:** Selesai teknis/terverifikasi — B2c3b, baseline `f3af90d` setelah rename kategori `0dd60c8`; implementasi `68a4421` dipush ke `origin/main`. Parent B2/B/BE-01/FT-01 belum selesai.

## 1. Kontrak sebelum implementasi

PRD §15/INV-003–004, schema B.6, master B1, backend/security dan NEXT M5 mengatur checkpoint ini. Kategori adalah pengelompokan Inventory sendiri, bukan kategori sellable Catalog. Hanya command lifecycle internal; tanpa item master write/stock movement, delete/hierarchy, migration/grant/kuota baru, AppModule/manifest/HTTP/OpenAPI/JSX/aktivasi/deploy atau mutation development.

- Body strict hanya `status` wajib `ACTIVE`/`INACTIVE`, pada command khusus `SetInventoryCategoryStatus`; rename/create tetap menolak field status. UUID target dari adapter; name/identity/scope/actor/reason/timestamp/relasi bukan input lifecycle. Dua transisi ACTIVE→INACTIVE dan INACTIVE→ACTIVE diperbolehkan berizin; status sama adalah no-op, bukan mutasi baru.
- Fresh authorizer existing `inventory.master.manage` + all-outlet/Backoffice/no-device, membership/user/workspace aktif, subscription usable, instalasi ACTIVE (missing ditolak), capability `inventory.item.manage`, sebelum validasi/IO dan setiap replay. Izin baca operasional bukan izin lifecycle. Missing/foreign target satu 404 `INVENTORY_CATEGORY_NOT_FOUND` tanpa detail tenant.
- Kategori tidak memiliki parent/hierarchy. Status ini hanya ketersediaan definisi pengelompokan: **tidak cascade** ke status, FK, min_stock, quantity atau histori item yang sudah terhubung. Tidak menghentikan operasi/reversal histori dengan menafsirkan ulang kategori. Tidak menambah aturan blocker jumlah item aktif yang tidak dikontrak produk. Validasi ACTIVE untuk pemilihan parent kategori baru/recategorization tetap kewajiban command item di checkpoint master item; histori relasi lama tidak dihapus atau dipaksa dipindah. Tidak meniru efek kategori Catalog terhadap menu sellable.
- Tidak ada dimensi kuota kategori pada paket; reactivate kategori tidak mengaktifkan item atau mengubah usage `inventory.items.active`. Tidak menciptakan LimitGate kategori atau melewatkan limit item dengan cascade. Item/supplier/location/limit dan integration ledger tetap checkpoint lain.
- Claim key Core lalu lock category tenant-scoped `FOR NO KEY UPDATE`; before name/status dibaca dari row terkunci terkini. Mutation hanya status memakai composite scoped key. Result pertama harus mempertahankan before id/name dan sesuai status tujuan; CI name uniqueness dan retention/identity guards B1 tidak berubah. Nama tetap reserved saat INACTIVE. Status/rename bersamaan terserialisasi tanpa lost field updates; tidak menambah expectedVersion input.
- Row + critical audit `inventory.category.status_change` + completed result/key satu commit/rollback. Audit hanya before/after status dan actor/channel/request/correlation/entity server, bukan nama bebas/body/key/hash/linked-item count. No-op tidak menulis row/timestamp/audit tetapi menyimpan original result/key agar retry setelah status berubah lagi tidak menerapkan transisi lama.
- Hash logical command mencakup lowercase target UUID + status, scope tenant/actor/operation. Replay strict DTO `id/name/status`, target/status tujuan harus cocok; scoped existence diperiksa di luar parser, bukan membandingkan current mutable name/status. Original create/rename/lifecycle snapshot dan audit sebelumnya tidak direwrite; same key beda target/status ditolak, actor/tenant/operation terisolasi.
- Window Core 24 jam; PENDING/FAILED/expired/incomplete/corrupt tetap reserved/fail closed, tidak dihapus/dieksekusi ulang. Fault audit/result/status/name/completion membatalkan row/timestamp/audit/key bersama. Tidak menumpuk interceptor HTTP generik. Tidak mengklaim cryptographic integrity arbitrary DB admin tampering di luar DTO/input/scoped-existence checks.

## 2. Inventaris action (tanpa JSX)

| Datum                                   | Klasifikasi                           | Aturan                                                          |
| --------------------------------------- | ------------------------------------- | --------------------------------------------------------------- |
| status tujuan                           | User input workflow lifecycle berizin | Satu enum wajib pada command khusus, bukan field create/rename. |
| id target                               | Read-only identity                    | UUID dari adapter, bukan body.                                  |
| id/name/status hasil                    | Read-only authoritative               | Snapshot hasil pertama, name tidak editable pada aksi ini.      |
| before status/changed/hash              | Derived/internal context              | Dari locked row; tidak dikirim sebagai user input.              |
| actor/scope/origin/key/audit/timestamps | Hidden/system-only                    | Dari server/Core, bukan body.                                   |
| item status/FK/count/stock/cost/histori | Out of scope mutation                 | Tidak di-cascade/diubah atau dipalsukan nol.                    |

## 3. Gate

- [x] Contracts/source: required strict status-only, dedicated command/auth-first/target/key/origin, stable errors/infrastructure mapping, DTO privacy dan critical audit.
- [x] PostgreSQL disposable: dua transisi/no-op, unchanged name/item/FK/status/minimum/usage/history, CI reserved name, original lifecycle/create/rename replay/key isolation, fresh access denial, fault rollback, corrupt/reserved states, concurrent same-key/opposite status/rename/row-lock barriers.
- [x] Root lint/boundary/warna/typecheck/test/format, Prisma validate, build API/web terisolasi; TODO/milestone diperbarui. Implementasi terverifikasi, di-commit dan dipush sebagai `68a4421` ke `origin/main`. Tanpa JSX/HTTP sehingga browser bukan gate.

## 4. Bukti dan batas

- **3 contracts + 7 source tests baru**: status wajib/enum strict pada dedicated lifecycle contract, rename/create tetap menolak status; metadata/rename/relation/financial fields ditolak. Enam use-case tests auth-first/normalization/target/key/origin/404/409/infrastructure/privacy dan critical before/after audit tanpa nama bebas/item count.
- **18 PostgreSQL tests baru (dua induk + 16 subtest)**: seluruh empat kombinasi source/target status (dua transisi + dua no-op), narrow id/name/status DTO, status-200 completed result/key dan attributed critical audit; no-op tidak menulis timestamp/row/audit. Nama/identity/created_at tetap; CI name masih reserved ketika INACTIVE.
- Deactivate/reactivate kategori dengan item ACTIVE dan INACTIVE mempertahankan seluruh item/FK/minimum/status dan unit definitions, active-item count, usage counter/event serta outbox. Tidak ada cascade atau kuota kategori baru; bukan implementasi active-parent validation command item yang belum dibuat. History relasi lama tetap terbaca, tanpa klaim stock ledger/operasional end-to-end.
- Delapan same-key attempts menghasilkan satu transition/audit/result. Original lifecycle/create/rename snapshots tidak direwrite setelah status dan nama berubah; no-op result tetap reserved agar retry tidak mengembalikan state lama ke master. Target/status hash, operation/actor/workspace scope diuji dengan dua workspace/owner kedua dan key sama pada create/rename/status actions.
- Fresh permission (read operasional bukan lifecycle), all-outlet/device/membership/user/subscription/module/install/capability refusal sebelum replay tidak mengubah key. PENDING/FAILED/expired/incomplete/wrong HTTP status/mismatched target/status/leaked result fail closed tanpa transisi ulang. Fault injection audit/result name/result status/completion membatalkan row/timestamp/audit/key bersama; retry key berhasil setelah rollback/fault dilepas.
- Opposite different-key transitions terserialisasi sebagai before/after chain valid (termasuk kemungkinan leading no-op); parallel rename+status mempertahankan kedua perubahan. Writer menunggu external committed name/status lalu membaca locked row terkini, termasuk no-op dengan exact SQL epoch text untuk timestamp. Advisory barrier pada critical audit menunjukkan authorized renamer dan reader PID spesifik menunggu hingga commit, lalu melihat status baru tanpa lost name update.
- **148 integrasi Inventory terfokus dan 191 integrasi PostgreSQL penuh lulus, 0 gagal/skip**. Fakta entitlement tetap facade fixture, bukan HTTP/session/installation atau capability activation sungguhan. Seluruh SQL/fixture/migration history hanya pada database disposable milik invocation; data development tidak diubah. Warning deprecation `pg` suite existing tetap tercatat, tidak diklaim diperbaiki.
- Root gates lulus: **521 source API + 6 scripts, 81 contracts, 285 UI, 69 web TS + 10 scripts**, database 3 dan worker 10. Prisma validate dan build API/web produksi terisolasi `.next/inventory-category-status-build` lulus; generated next-env dipulihkan sebelum typecheck final. Log `.cache/m5-category-status-*` Git-ignored. `git diff --check`, format checkpoint dan 155 tautan file lokal lulus. Tidak ada label UI/JSX baru, sehingga browser/Storybook visual tidak dijalankan.
- Tidak ada migration/Prisma schema/grant/permission/dependency baru, item/stock/event mutation, AppModule/manifest/HTTP/OpenAPI/module activation/capability delivery atau UI baru. B2c3b selesai teknis, bukan completion master item/supplier/location/B2/BE-01/FT-01/Inventory-only end-to-end atau acceptance M5.

## 5. NEXT

B2d1 kontrak/query item Inventory berizin/scoped dengan field inventory dan privacy HPP/cost yang ditetapkan sebelum coding; category/base-unit ownership/status serta limit item pada mutation checkpoint terpisah. Tidak membuka endpoint/route/reslicing atau memilih OD-05 dari lifecycle kategori ini.
