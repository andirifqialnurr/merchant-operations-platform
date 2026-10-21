# M5 — create kategori Inventory

**Status:** Selesai teknis/terverifikasi — B2c2, baseline `a2de362` setelah query kategori `30cb048`; commit/push dicatat setelah gate akhir. Parent B2/B/BE-01/FT-01 belum selesai.

## 1. Kontrak sebelum implementasi

PRD §15 (category/item master mandiri), schema B.6, backend/security dan NEXT M5 mengatur checkpoint ini. Owner data/command adalah Inventory, bukan Catalog. Hanya create kategori internal; tanpa update/lifecycle, tabel/migration/grant baru, AppModule/manifest/HTTP/OpenAPI/JSX/ledger atau aktivasi capability/deploy/mutasi development.

- Body strict hanya `name`, trim/min 1/max 160 sesuai kategori read/B1. Tidak menerima id/status/tenant/outlet/actor/timestamp/audit/key/item relation/count/financial data. Status create ditentukan server **ACTIVE**, bukan input yang dapat mengaktifkan/mengganti kategori existing. Response nonsecret DTO `id/name/status` saja.
- Otorisasi fresh existing `inventory.master.manage` + all-outlet/Backoffice/no-device, membership/user/workspace aktif, subscription usable, instalasi ACTIVE (missing ditolak), capability `inventory.item.manage`; sebelum validasi/IO dan sebelum setiap replay. Permission read operasional B2c1 bukan hak create. Identity/origin dari adapter server, bukan body/role flag.
- Name unik case-insensitive per tenant memakai indeks SQL B1 yang sama, termasuk kategori INACTIVE. Collision menjadi `INVENTORY_CATEGORY_NAME_TAKEN` (409) tanpa detail SQL/status/name kategori pihak lain; tidak auto-reactivate, overwrite atau return existing row pada key berbeda. Tidak mengada-adakan slug/code/hierarchy, normalisasi accent/Unicode lain atau dimension kuota kategori yang tidak dikontrak paket.
- Name case-preserving; logical input hanya di-trim. Same key dengan casing nama berbeda merupakan payload berbeda (`IDEMPOTENCY_KEY_REUSED`), sedangkan key berbeda dapat conflict lewat CI DB. Hash normalized body, scope tenant/operation/actor dan key mengikuti Core helper existing; window 24 jam, race claim menunggu transaksi pemilik.
- Kategori + critical audit `inventory.category.create` + completed key/snapshot hasil satu commit/rollback. Audit aman berisi actor/channel/request/correlation/entity dan after.status ACTIVE saja, **tanpa duplikasi nama bebas/body/key/hash**. Tidak membuat event master/usage event atau LimitGate kategori yang tidak ada pada kontrak paket.
- Replay strict DTO harus cocok dengan normalized input name dan status create ACTIVE; ID harus ada pada tenant sendiri. Pemeriksaan DB berada di luar parser agar gangguan infrastruktur tidak dilabeli corrupt DTO. Hasil pertama tetap dikembalikan walau kategori kemudian berganti nama/INACTIVE melalui workflow terpisah; bukan read nama/status terkini, bukan reactivation atau mutasi ulang. Snapshot operasi/actor/tenant lain tidak dipakai.
- PENDING/FAILED/expired/incomplete/corrupt tetap fail closed/reserved, tidak dihapus/dijalankan ulang. Fault mutation/audit/result/completion/serialization membatalkan kategori/audit/key bersama. Jangan menumpuk interceptor HTTP generik nanti. Scoped shape/input/existence validation bukan klaim cryptographic integrity terhadap arbitrary database administrator tampering.
- Tidak ada parent binding pada model kategori ini. Item attachment/status validation tetap checkpoint master item. Tidak mengklaim Inventory-only end-to-end atau acceptance M5 dari create master saja. Existing constraint/retention/CI guards tetap berlaku, tanpa migration baru.

## 2. Inventaris action (tanpa JSX)

| Datum                                                     | Klasifikasi               | Aturan                                                                  |
| --------------------------------------------------------- | ------------------------- | ----------------------------------------------------------------------- |
| name                                                      | User input create berizin | Satu field, trim/name case-preserving; bukan slug/code atau nilai stok. |
| id/name/status hasil                                      | Read-only authoritative   | UUID dan ACTIVE ditentukan server; snapshot original untuk replay.      |
| hash/normalized body                                      | Derived internal          | Bukan input pengguna atau metadata tambahan DTO.                        |
| tenant/outlet/actor/origin/key/audit/timestamps           | Hidden/system-only        | Dari adapter/Core/server, bukan body.                                   |
| parent/hierarchy/items/count/saldo/cost/HPP/contact/usage | Out of scope              | Tidak diciptakan atau diberi nol placeholder.                           |

## 3. Gate

- [x] Contracts/source: strict name-only body/ACTIVE output, auth-first/key/origin, neutral conflict/infrastructure mapping, response privacy, critical audit/labels id/en.
- [x] PostgreSQL disposable: atomic create/audit/result, normalized retries/original snapshot setelah rename/inactive, same-key race/CI different-key conflict termasuk inactive, tenant/actor/operation isolation, fresh refusal sebelum replay, rollback audit/result/completion/serialization, uncertain/expired/corrupt snapshot fail closed, standalone/no runtime wiring.
- [x] Root lint/boundary/warna/typecheck/test/format, Prisma validate, build API/web terisolasi; TODO/milestone diperbarui. Commit/push dicatat setelah gate akhir. Tidak ada JSX/HTTP sehingga browser bukan gate.

## 4. Bukti dan batas

- **3 contracts + 7 source tests baru**: name-only/trim/case-preserving dan batas panjang, server-owned/derived fields ditolak; enam use-case tests auth-first/normalization/key/origin/stable conflict vs infrastructure/DTO privacy/ACTIVE output. Critical audit classification dan label CI conflict id/en diverifikasi. Read DTO/query B2c1 tidak diubah.
- **12 PostgreSQL tests baru (induk + 11 subtest)**: narrow id/name/ACTIVE DTO, satu category/critical attributed audit/status-201 key, audit tidak menyalin nama bebas. Query B2c1 membaca hasil create dan current inactive/renamed state secara otoritatif, berbeda dari original replay yang tetap nama/ACTIVE pertama. Trimmed name/key retry dan casing payload berbeda diuji; key/row/audit tidak direwrite saat replay.
- Delapan same-key attempts menghasilkan satu ID/audit/completed result. Different-key CI race menghasilkan satu kategori dan satu reservation sukses; duplicate kategori INACTIVE tetap conflict tanpa reactivation/overwrite. Dua workspace boleh memakai nama sama; owner kedua tidak dapat replay actor pertama, dan key sama dengan create unit sungguhan terpisah operation scope.
- Fresh permission (izin read operasional bukan write), all-outlet/device/membership/user/subscription/module/installation/capability refusal berlaku juga sebelum replay dan tidak mengubah key. Unknown/client status/scope fields ditolak; invalid internal scope/origin gagal sebelum writer IO. PENDING/FAILED/expired/incomplete/mismatched name/status/metadata/foreign atau missing-ID snapshot fail closed tanpa mutation ulang.
- Fault injection audit, result name, result status dan completion membatalkan category/audit/key bersama; setelah fault dilepas retry key berhasil. Core helper dengan JSON serialization invalid juga membatalkan category/audit/reservation. Tidak mengklaim cryptographic detection arbitrary DB admin tampering di luar scoped DTO/input/existence checks ini.
- **114 integrasi Inventory terfokus dan 157 integrasi PostgreSQL penuh lulus, 0 gagal/skip**. Entitlement facts tetap facade fixture, bukan activation/installation atau HTTP sesi. Standalone tanpa Catalog/POS/KDS/install baru, outbox/usage event unchanged; semua fixture/SQL hanya pada database disposable milik invocation, tanpa mutation development. Warning deprecation `pg` di regresi existing tetap tercatat dan tidak diklaim diperbaiki.
- Root gates lulus: **507 source API + 6 scripts, 75 contracts, 285 UI, 69 web TS + 10 scripts**, database 3 dan worker 10. Rangkaian root awal melewati timeout 300 detik (format belum dikonfirmasi); seluruh gate diulang dengan batas cukup dan lulus. Prisma validate dan build API/web produksi terisolasi `.next/inventory-category-create-build` lulus; generated next-env dipulihkan sebelum typecheck final. Log `.cache/m5-category-create-*` Git-ignored. `git diff --check`, format checkpoint dan 141 tautan file lokal lulus. Error label id/en tanpa JSX, sehingga browser/Storybook visual tidak dijalankan.
- Tidak ada migration/Prisma model/permission/grant/dependency baru, AppModule/manifest/HTTP/OpenAPI/module activation/capability delivery/ledger atau UI baru. B2c2 create kategori selesai teknis, bukan completion update/lifecycle kategori, B2/BE-01/FT-01/Inventory-only end-to-end atau acceptance M5.

## 5. NEXT

B2c3a update nama kategori transaksional berizin (CI scoped, original snapshot/audit/replay), lalu B2c3b lifecycle ACTIVE/INACTIVE dengan parent/item rules yang relevan. Item/supplier/location/LimitGate resource terkait tetap checkpoint terpisah sebelum endpoint; tidak membuka route/reslicing atau memilih OD-05 pada create kategori ini.
