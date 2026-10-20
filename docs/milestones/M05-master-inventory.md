# M5 — master Inventory

**Status:** M5-BE-01B1 selesai teknis/terverifikasi — `f3f7e5f` (dipush ke `origin/main`). B2a query internal selesai teknis/terverifikasi (bagian 6–7). Parent B/M5 tetap Berjalan. Baseline fondasi numerik `89ba34f`/`0ea003c`.

## 1. Scope checkpoint

PRD Modular §15 (INV-001–009), Module Tiers §7, Packages & Limits §4.6/§5.5 dan schema B.6 adalah acuan. B1 hanya menambah enam model/tabel master: unit, direct conversion, kategori item, item, pemasok dan stock location. Tidak ada ledger/balance/receipt/resep, endpoint, repository/use case produksi, aktivasi manifest/capability, grant permission, kuota paket baru atau JSX. Master belum menjadi fitur pengguna hanya karena Prisma dapat membacanya.

B dipisah: **B1 schema/guard/migration test**, lalu **B2 kontrak dan akses master berizin melalui use case/repository/API** (boleh dipecah per resource). Task induk M5-BE-01 dan M5-FT-01/09 tetap belum selesai. Tidak menjalankan migrasi pada development atau deploy.

## 2. Keputusan persistence sebelum DDL

- Setiap master dimiliki Inventory dengan `tenant_id NOT NULL`, PK UUIDv7, unik `(tenant_id,id)`, timestamps dan FK komposit ke induknya. Item tidak mempunyai FK/ketergantungan pada Catalog/POS/KDS.
- Kategori dinormalisasi ke `inventory_categories`; item menggunakan `category_id?`, bukan kategori Catalog. Status ACTIVE/INACTIVE tersedia untuk kategori/item/pemasok/stock location, tanpa hard delete; unit/conversion mempertahankan definisinya tanpa menambah workflow arsip yang belum ditetapkan.
- Unit code unik case-insensitive per workspace dan case-preserving pada data; category name juga unik per workspace. SKU opsional unik case-insensitive per workspace (termasuk inactive); item name tidak unik. Supplier name tidak dipaksa unik: dua pemasok bernama sama tetap dapat dibedakan oleh ID/contact.
- Stock location mempunyai `outlet_id?`: outlet harus dalam tenant yang sama, sedangkan NULL berarti storage workspace tanpa ikatan outlet, bukan nol/placeholder outlet. Nama unik case-insensitive per outlet; lokasi NULL unik dalam lingkup workspace. Ini bukan dimensi lokasi organisasi dan tidak menambah warehouse governance Pro. Akses NULL harus memerlukan scope workspace pada tahap API nanti.
- **Koreksi teknis representasi A:** batas quantity tetap 24 digit bulat/6 pecahan dan factor 18 digit bulat/12 pecahan. Kolom menggunakan **NUMERIC tanpa typmod + CHECK range/scale**, bukan NUMERIC(30,6)/(30,12) yang membulatkan sebelum CHECK. Nilai NaN/Infinity, overflow dan pecahan melebihi batas ditolak; tidak mengubah/mengurangi presisi kontrak A.
- Minimum stock nullable (tidak diisi nol palsu), nonnegatif dan tepat pada precision base unit. Trigger memeriksanya setelah mengunci definisi unit. Factor direct conversion positif dan unit asal/tujuan berbeda, satu pasangan terarah per tenant; tidak membuat inverse/path atau membuktikan dimensi fisik otomatis.
- Unit code/precision boleh dikoreksi selama belum direferensikan. Reference pertama item/conversion melatch flag teknis `definition_locked` melalui UPDATE parent dalam transaksi yang sama: BEFORE mengunci/memeriksa unit, AFTER melatch hanya row tersimpan. Skipped insert/ON CONFLICT candidate tidak meninggalkan latch palsu. Setelah true, tidak dapat dibuka kembali atau mengubah code/precision; name tetap label yang dapat diperbaiki. Latch menulis versi row sehingga update definition vs first reference terserialisasi, termasuk stale repeatable-read (harus gagal/rollback, bukan meninggalkan minimum stock invalid). Kegagalan insert membatalkan latch bersama statement/transaksinya.
- Identitas id/tenant master tidak dapat dipindah. Base unit item, pasangan conversion dan ikatan outlet stock location tidak dapat diganti pada row yang sudah dibuat; koreksi memakai record baru/penonaktifan yang tersedia, bukan menafsirkan ulang referensi historis. Factor dapat diperbarui untuk penggunaan mendatang; mutasi stok nanti wajib menyimpan quantity base yang sudah dikonversi, tidak menghitung ulang movement lama dengan factor baru.
- DELETE/TRUNCATE master ditolak database. Seluruh guard ini melindungi integritas, **bukan pengganti sesi, role/scope, active-parent validation, audit/outbox, idempotency atau LimitGate**. Tidak ada mutasi data/izin/modul existing pada migrasi selain definisi tabel/index/function/trigger baru dan FK.

## 3. Inventaris (tanpa JSX)

| Datum                                                  | Klasifikasi                                                    | Aturan                                                                                                              |
| ------------------------------------------------------ | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Unit code/name/precision, conversion from/to/factor    | User input definisi sesuai workflow                            | Kontrak strict A; edit definition yang sudah dipakai ditolak. Scope/kompatibilitas bukan dibuktikan oleh UUID saja. |
| Item SKU/name/category/base unit/minimum stock         | User input master                                              | Category/unit dipilih dari workspace terotorisasi; base unit hanya saat create; minimum bukan saldo.                |
| Supplier name/contact opsional                         | User input master, contact sensitif operasional                | Tidak dipublikasikan atau dikirim ke POS/KDS; belum ada DTO/API yang membuka contact.                               |
| Stock location name/outlet opsional                    | User input create berizin                                      | Outlet pilihan scoped; binding tidak bisa dipindah setelah create. NULL perlu akses workspace nanti.                |
| Status                                                 | Read-only state, diubah command aktivasi/nonaktif khusus nanti | Tidak dianggap field transaksi bebas atau izin implicit untuk mengaktifkan kembali tanpa LimitGate.                 |
| id/tenant/created/updated, definition_locked           | Hidden/system-only                                             | Flag latch adalah guard internal, bukan input/display tambahan; DTO unit A tetap hanya id/code/name/precision.      |
| Saldo, kuantitas mutasi, nilai biaya/HPP dan ringkasan | Hidden/out of scope                                            | Tidak ada kolom saldo/cost/default nol pada master; bukan input item.                                               |

UI tetap checkpoint terpisah: Backoffice, gap bagian ≥16px, label pendek, satu fakta satu lokasi/primary action, tanpa nested card, light/dark dan id/en; scope route/slicing dikonfirmasi sebelum JSX.

## 4. Gate B1

- [x] Prisma format/validate/generate; enam tabel sesuai model, numeric tanpa typmod dan guard tidak melakukan silent rounding.
- [x] Static schema tests: FK komposit/owner, no Catalog/cost/balance, retention dan latch/precision guards; migrasi tidak memberi izin/capability/kuota.
- [x] PostgreSQL disposable + Prisma: master tanpa Catalog, nullable/zero minimum, exact big decimal/factor, invalid scale/range/unit precision/special numeric, cross-workspace FK, unique scope/case, rollback/latch dan concurrent reference vs definition, DELETE/TRUNCATE/identity retention.
- [x] Root gates dan build API/web; dokumentasi/TODO diperbarui. Implementasi `f3f7e5f` dipush sebelum B2. Bukan verifikasi API/izin/limit/audit/stock workflow atau acceptance M5.

## 5. Bukti B1

- Migrasi `20261020010000_inventory_masters`, enam model Prisma dan enum status; `db:format`, `db:validate`, `db:generate` lulus. `atttypmod = -1` diverifikasi langsung untuk min_stock/factor; baik SQL maupun Prisma menolak input pecahan berlebih, tidak membulatkan sebelum constraint.
- **5 static schema tests baru**, kontrak unit tetap menolak `definitionLocked` pada create maupun read DTO. **12 test PostgreSQL master (induk + 11 subtest)** lulus: master tanpa Catalog/POS/KDS/installation, NULL vs zero, batas besar/sangat kecil, special numeric, precision unit, scoped FK/case/uniqueness, rollback, mutable label/status/factor vs binding immutable, skipped/upsert candidate, DELETE/TRUNCATE, serta kedua urutan writer pada READ COMMITTED dan REPEATABLE READ. Client tambahan hanya dibuat oleh helper yang terikat pada database disposable milik invocation tersebut.
- **55 integrasi PostgreSQL penuh lulus, 0 gagal/skip**, seluruh migration history diterapkan pada database baru milik helper. Run awal dari root tanpa API tsconfig ditolak esbuild karena parameter decorators; bukan bukti lulus. Run sah diulang dari `apps/api` dengan konfigurasi TypeScript API, tanpa menonaktifkan test.
- **Root lint/boundaries/warna, typecheck, test, format check lulus**: 437 sumber API + 6 script boundary, 55 contracts, 285 UI, 69 web TS + 10 scripts, database 3 dan worker 10. Build API/web lulus; `next-env.d.ts` dikembalikan ke referensi development yang tracked, lalu typecheck diperiksa kembali. Tidak ada perubahan JSX sehingga browser/Storybook visual dan uji fisik bukan gate B1.
- Log lokal Git-ignored: `.cache/m5-master-*`; tidak ada migrasi/seed pada development, deploy, grant permission, aktivasi modul/capability atau perubahan dependency. B1 bukan hasil audit izin/limit/API dan bukan acceptance M5; review M2/M3, printer fisik serta OD-05 tetap terpisah.
- NEXT saat B1 ditutup: B2 akses master berizin. B2a kini tersedia di bawah; parent B/BE-01/FT-01/FT-09 tetap belum selesai. Implementasi B1 diverifikasi, di-commit dan dipush ke `origin/main` sebagai `f3f7e5f`.

## 6. B2a — query unit/conversion

B2 dipecah lagi: **B2a read contracts/port/Prisma adapter + dua query use case berizin**, lalu B2b command tulis berikut audit/idempotency/error/guard sebelum endpoint. B2a tidak mendaftarkan provider ke AppModule, manifest, route, izin baru, migration atau UI; seluruh data tetap diuji pada PostgreSQL disposable. B2/BE-01/FT-01 tetap terbuka.

- Identity berasal dari adapter sesi, bukan query/body. Adapter akses membaca ulang `AccessService.describeAccess` dan `EntitlementService.describeAccess`; keanggotaan/user/workspace harus aktif dan membership ID cocok. Wajib subscription usable, module INVENTORY_BASIC entitled, instalasi **ACTIVE** (missing ditolak), capability `inventory.item.manage`, serta salah satu izin operasional existing `inventory.receive`/`inventory.adjust`/`inventory.stocktake`. Tidak memberi hak mengubah master melalui izin operasional tersebut; permission mutasi diputuskan terpisah di B2b.
- Unit/conversion adalah definisi workspace bersama tanpa cost/contact/quantity per outlet: pembacaan diperbolehkan untuk staf Inventory scoped-outlet tanpa mengklaim all-outlet mutation. Sesi perangkat ditolak; modul tetap Backoffice. Otorisasi sebelum membaca master, tanpa cache hasil izin.
- Query strict: cursor UUID sebagai posisi (bukan lookup record), limit 1–100/default 25; conversion boleh memfilter from/to UUID persis. Keyset `id > cursor`, urutan id ascending dan limit+1; tidak ada count/total palsu atau fallback unfiltered jika filter tidak cocok. Semua query ORM mempunyai tenant non-null tervalidasi dan select kolom eksplisit. Cursor asing diperlakukan sama dengan UUID posisi acak, tidak dibaca sebagai row tenant lain.
- Factor ditulis ke DTO sebagai decimal string kanonik, termasuk 10^-12 tanpa exponent. `Decimal.toFixed()` **tanpa argumen** hanya format semua digit, bukan pembulatan/arithmetic; hasil tetap divalidasi schema factor. Tidak ada inverse/path/kompatibilitas fisik yang disimpulkan oleh query.
- Inventaris read action: cursor/limit/from/to filter = **user input**; unit id/code/name/precision dan conversion id/from/to/factor = **read-only authoritative**; pageInfo = **derived read-only**; tenant/aktor/timestamps/latch/saldo/cost/contact/status dan nilai konversi hasil = **hidden/out of scope**. Tidak ada JSX.
- Read tidak memerlukan LimitGate, audit mutasi atau idempotency write; tidak mengklaim kontrol command tersebut sudah tersedia.

## 7. Bukti B2a

**Status:** selesai teknis/terverifikasi; commit dicatat setelah push, bukan acceptance M5.

- **4 contracts + 11 source tests baru**: strict bounded pagination/DTO, cursor metadata, exact factor, no scope/derived input, auth sebelum IO, revocation/stale permission/capability, urutan refusal dan sesi perangkat. Schema response diperiksa juga oleh use case, bukan mengandalkan ORM row mentah.
- **7 PostgreSQL query tests (induk + 6 subtest)**: 107 unit tenant A + tenant B, page 100/7 serta 37 tanpa duplikasi/lompatan, keyset/filter cross-tenant, missing scope tidak menjadi Prisma undefined-filter fallback, minimum/full precision factor kanonik, DTO tanpa metadata, real membership/role revocation sebelum master IO, no-write snapshot master/latch/timestamp/audit/outbox/idempotency. Entitlement facts disimulasikan melalui facade untuk query fixture; ini bukan instalasi/aktivasi module di database atau test HTTP sesi.
- **62 integrasi PostgreSQL penuh lulus, 0 gagal/skip**. Root lint/boundary/warna/typecheck/test/format serta build API/web lulus: 448 source API + 6 scripts, 59 contracts, 285 UI, 69 web TS + 10 scripts; database/worker tetap lulus. `next-env.d.ts` dipulihkan ke referensi dev tracked dan typecheck diperiksa ulang. Log `.cache/m5-master-read-*` Git-ignored.
- Tidak ada paket, DDL/migrasi development, registrasi runtime/module/capability, grant permission, HTTP/OpenAPI/UI/JSX atau mutasi Inventory produksi. Query foundation bukan API Inventory-only end-to-end atau penyelesaian FT-01/BE-01/B2/SC-01/SC-02.
- NEXT: **B2b command master unit/conversion**, tentukan permission mutasi tersendiri, scope workspace, validasi parent/compatibility, repository transaksional, error mapping dan audit/idempotency sebelum endpoint. Resource master lain, LimitGate aktif yang relevan, activation/manifest dan acceptance tetap checkpoint berikutnya, tanpa membuka reslicing rute.
