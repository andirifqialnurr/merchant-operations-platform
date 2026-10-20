# M5 — pembuatan satuan

**Status:** B2b1 selesai teknis/terverifikasi; commit dicatat setelah push. Parent B2b/B2/M5 tetap Berjalan. Baseline B2a `8ccf52f`/`90a3988`.

## 1. Scope sebelum implementasi

PRD Modular §15, Module Tiers §7, Packages & Limits §4.6/§5.5, schema B.6 dan backend/security mengatur checkpoint ini. B2b dipecah: **B2b1 create unit**, B2b2 create direct conversion/parent validation, lalu update/lifecycle dan master lain sesuai checkpoint. B2b/BE-01/FT-01 belum selesai. Tidak ada AppModule/manifest/capability delivery, HTTP/OpenAPI, JSX/rute baru, ledger, deployment atau migrasi development.

- Permission baru `inventory.master.manage` terpisah dari izin menerima/adjust/opname. Ditentukan untuk role sistem OWNER/MANAGER saja (migrasi katalog/grant serta default provisioning yang sudah memakai seluruh izin); bukan INVENTORY_STAFF/CASHIER/KITCHEN/WAITER atau custom role otomatis. Izin bukan aktivasi capability/modul. Query definisi B2a juga menerima permission master baru; operasional tetap tidak boleh menulis.
- Otorisasi fresh membership/user/workspace + subscription + instalasi ACTIVE (missing ditolak) + capability `inventory.item.manage` + master permission + **all-outlet workspace scope tanpa sesi perangkat** sebelum setiap percobaan/replay. Nama role atau body tidak menjadi bukti hak. Identity/origin dari adapter sesi; aktor origin harus cocok dengan actor scope.
- Body create hanya `code/name/precision` sesuai kontrak A. Tidak ada balance/cost/status/id/scope/actor/timestamp/latch/reason yang diciptakan sebagai input. Unit belum mempunyai parent/conversion atau quantity untuk dikonversi. Tidak menambahkan kuota unit yang tidak ada pada kontrak paket; limit item/location/supplier bukan limit unit.
- Writer melalui port kecil; transaksi berada pada adapter persistence. Create unit + audit kritis `inventory.unit.create` + hasil idempotency harus satu commit/rollback. Kode unik CI per tenant dijaga DB, race dipetakan menjadi `INVENTORY_UNIT_CODE_TAKEN` tanpa detail SQL. Tidak ada event master baru yang belum ditetapkan kontrak produk.
- Core tetap memiliki tabel idempotency: helper transaksional opt-in diekspor melalui `core/idempotency/public.ts`, menerima client interactive transaction hanya di adapter, tidak mengubah interceptor generic existing. Claim NULL outlet memakai unique index existing/createMany skipDuplicates; request hash dari body ter-normalisasi, scope operation + actor dan tenant. Concurrent key menunggu transaksi pemilik; gagal mutation/audit/result tidak meninggalkan PENDING/unit/audit parsial. Different body ditolak; different actor tidak memperoleh hasil actor lain.
- Response non-secret DTO disimpan sebagai snapshot create, bukan dibaca ulang sebagai nilai master terkini. Replay memvalidasi bentuk, kesesuaian input dan keberadaan ID dalam tenant. Window 24 jam mengikuti core: PENDING/FAILED/expired/incomplete/corrupt tidak dieksekusi ulang atau dibebaskan otomatis; retention/pembersihan reservation tidak diimplementasikan di sini dan harus mempertahankan perlindungan ini. Tidak menumpuk interceptor HTTP di atas command ini kelak.
- Metadata audit berisi actor/tenant/entity/channel/request correlation yang sah dan code/precision setelah create; nama bebas, key/hash/request body tidak diduplikasi ke audit. Label permission/error masuk kamus id/en untuk metadata Pengaturan yang sudah ada, bukan form/slicing Inventory.

## 2. Inventaris action

| Datum                                                         | Klasifikasi                      | Aturan                                                                               |
| ------------------------------------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------ |
| code/name/precision                                           | User input create                | Strict, trim sesuai A, precision integer 0–6; tidak menafsirkan ulang unit existing. |
| Unit id/code/name/precision pada hasil                        | Read-only authoritative          | DTO sempit, snapshot hasil pertama untuk replay.                                     |
| Permission pilihan role pada Pengaturan existing              | User input workflow role berizin | Metadata key baru; aturan assertCanGrant tetap berlaku. Tidak ada JSX/layout baru.   |
| actor/tenant/scope/identity/origin/key/hash/waktu/audit/latch | Hidden/system-only               | Konteks adapter/core, tidak berasal dari body atau menjadi field form unit.          |
| balance/cost/minimum/status/converted quantity                | Hidden/out of scope              | Tidak ditambahkan atau dipalsukan nol pada create unit.                              |

## 3. Gate

- [x] Source tests create, permission/access order, input/origin strict, error mapping/replay, default role policy dan audit critical; label/permission coverage.
- [x] PostgreSQL disposable: atomic create/audit/key, concurrent replay/different-key CI conflict, normalized payload hash, tenant/actor isolation, original snapshot, revoked access before replay, rollback unit/audit/serialization failure, uncertain/expired/corrupt result fail closed, grants minimal/idempotent.
- [x] Root lint/boundary/color/typecheck/test/format dan build API/web; restore generated next-env; TODO/milestone dan commit/push sebelum B2b2. Bukan acceptance M5/HTTP/UI/printer.

## 4. Bukti B2b1

- **12 source tests baru** (create + write authorizer + metadata helper sebelum IO), audit classification/metadata dan read-permission coverage diperbarui. Root lulus: **460 source API + 6 scripts, 59 contracts, 285 UI, 69 web TS + 10 scripts**, database 3 dan worker 10. Label id/en serta permission groups existing tetap lengkap.
- **12 PostgreSQL create tests (induk + 11 subtest)**: grant migration repeatable/minimal vs provisioning baru, critical audit/actor/channel/correlation, snapshot hasil asli setelah rename, canonical body/key dan mismatch hash, 8 concurrent same-key replays, different-key CI code race tanpa reservation gagal, tenant/actor isolation, scope/role/membership/capability revocation sebelum replay, device denial, audit/result/completion/serialization failure rollback, uncertain/expired/corrupt snapshot (termasuk foreign unit ID) fail closed, tanpa dependency Catalog/POS/KDS atau event master baru.
- **74 integrasi penuh PostgreSQL lulus, 0 gagal/skip**, seluruh migration history hanya pada database disposable. Membership/roles diuji nyata; entitlement facts tetap disimulasikan melalui facade, bukan aktivasi modul atau test HTTP sesi. Snapshot/idempotency policy ini tidak mengubah generic interceptor lama.
- Root lint/boundary/warna/typecheck/test/format dan build API/web lulus. Generated `next-env.d.ts` dipulihkan ke referensi dev tracked, typecheck diperiksa ulang. Log `.cache/m5-unit-create-*` Git-ignored. Tidak ada dependency/JSX/layout atau rute baru; browser visual bukan gate metadata permission/error saja.
- Terdapat **migrasi katalog/grant permission** untuk rilis, tetapi tidak dijalankan pada development dan tidak ada deploy. Sebelum memakai provisioning workspace dengan kode baru, operator perlu menerapkan migrasi tersebut melalui proses rilis yang disetujui; tidak ada auto-migrate. Writer/helper internal belum di-register ke AppModule/manifest/HTTP/OpenAPI; capability delivery, unit update/lifecycle, conversion, master lain, ledger, SC-01/02 dan acceptance M5 belum selesai.
- NEXT **B2b2 create direct conversion** dengan scope/parent/compatibility, transaksi/audit/idempotency yang sama; tidak melompat ke endpoint/JSX atau konsumsi otomatis. Implementasi dan commit hash dicatat setelah push.
