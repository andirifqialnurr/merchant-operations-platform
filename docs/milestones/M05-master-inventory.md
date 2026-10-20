# M5 — master Inventory

**Status:** M5-BE-01B1 selesai teknis/terverifikasi — `f3f7e5f` (dipush ke `origin/main`). Parent B/M5 tetap Berjalan. Baseline fondasi numerik `89ba34f`/`0ea003c`.

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
- NEXT: **B2 kontrak/use case/repository master berizin**, mulai unit/conversion, termasuk error/serialization dan guard scope/kompatibilitas/audit/idempotency/limit yang relevan sebelum endpoint. Parent B/BE-01/FT-01/FT-09 tetap belum selesai. Implementasi diverifikasi, di-commit dan dipush ke `origin/main` sebagai `f3f7e5f`.
