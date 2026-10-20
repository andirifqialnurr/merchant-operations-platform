# M5 — fondasi satuan dan jumlah

**Status:** Selesai teknis/terverifikasi — checkpoint M5-BE-01A, hash dicatat setelah commit sebelum push; setelah pengguna menerima M4 dan meminta lanjut M5 pada baseline `6129b5b`.

## 1. Sumber dan batas

PRD Modular §15/INV-001–009 dan §15.4, Module Tiers §7, Packages & Limits §4.6/§5.5, schema B.6, backend §5/§7, serta milestone M5 mengatur pekerjaan ini. Inventory mempunyai item/satuan sendiri, tanpa ketergantungan wajib pada Catalog/POS/KDS.

M5-BE-01A menyiapkan kontrak read/write **satuan dan definisi konversi** serta aritmetika jumlah murni. Bukan CRUD/API, manifest aktif, migrasi/tabel, saldo, ledger, pemasok, resep, biaya/HPP, integrasi atau UI. Task induk M5-BE-01 dan M5-FT-01 belum selesai karena fondasi numerik ini tersedia. Folder domain tidak berarti modul/fitur sudah diaktifkan.

## 2. Kontrak teknis sebelum implementasi

- Jumlah dikirim sebagai string desimal, bukan JSON number, notasi eksponen, pemisah ribuan atau format locale. Rencana persistence `numeric(30,6)`: maksimal 24 digit bulat + 6 pecahan; presisi satuan integer 0–6. Ini batas representasi R1, bukan kuota paket atau batas jumlah item. Perubahan presisi setelah pemakaian ledger harus digerbang pada checkpoint persistence, bukan menafsirkan ulang stok lama.
- Conversion factor adalah string positif dengan rencana `numeric(30,12)` (18 digit bulat + 12 pecahan), bukan uang/jumlah stok. Nol/negatif ditolak. Faktor kecil dan reverse conversion yang tidak dapat direpresentasikan tidak dibulatkan diam-diam.
- Input boleh mempunyai trailing zero di dalam skala yang didukung (`1.000` pada satuan presisi 0 tetap tepat 1). Output kanonik membuang trailing zero, mengubah signed zero menjadi `0`, tanpa exponent atau float. Nilai dengan digit pecahan nonzero di luar presisi satuan ditolak.
- Domain mengubah jumlah ke atom `bigint` menurut presisi satuan; konversi memakai perkalian/pembagian integer eksak. Hasil dengan sisa pembagian atau di luar rentang penyimpanan ditolak. Tidak ada `Number`, `parseFloat`, pembagian float, `toFixed`, atau pembulatan stok.
- Jumlah bertanda tersedia untuk ledger/projection; input positif dan nonnegatif memiliki skema terpisah. Saldo negatif belum diizinkan/dilarang oleh primitive ini: INV-008 tetap kebijakan workspace/location di checkpoint mutasi. Validitas aritmetika bukan otorisasi/policy saldo.
- Definisi konversi hanya menyatakan pasangan unit berbeda dan faktor positif. Domain numerik bukan pencari jalur, reciprocal otomatis, pengenal dimensi fisik, atau bukti unit milik workspace yang sama. Scope/izin, kedua unit aktif/kompatibel, aturan pemakaian dan keunikan pasangan wajib diperiksa oleh use case/repository nanti. Jangan menganggap gram↔liter sah hanya karena faktornya positif.
- Satuan memiliki input `code`, `name`, `precision`; definisi konversi memiliki `fromUnitId`, `toUnitId`, `factor`. ID server, tenant/outlet, aktor/waktu, stock balance, biaya dan status transaksi tidak diterima sebagai field command master tersebut. Kode ASCII case-preserving; aturan keunikan workspace/case ditetapkan pada persistence, tidak ditentukan dari package name.
- Uang tetap integer minor-unit sesuai kontrak money. Fondasi ini tidak menentukan average cost, pembulatan nilai receipt/HPP atau payload biaya.

## 3. Inventaris data (belum JSX)

| Datum                                             | Klasifikasi                              | Lokasi/aturan tahap UI nanti                                                                         |
| ------------------------------------------------- | ---------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Kode, nama, presisi satuan                        | User input pada form satuan yang berizin | Satu kelompok field; presisi bukan saldo atau harga. Perubahan unit terpakai perlu guard server.     |
| Unit asal/tujuan dan factor                       | User input definisi konversi             | Unit dipilih dari scope terotorisasi; tidak menerima tenant/outlet/derived quantity dari klien.      |
| ID unit, scope tenant/outlet, aktor/waktu audit   | Hidden                                   | Key dan otorisasi server; bukan field editable/tambahan cetak.                                       |
| Jumlah hasil konversi, saldo, low-stock, cost/HPP | Derived atau hidden/out of scope         | Tidak menjadi input master; belum ada nilai atau nol placeholder pada tahap ini.                     |
| SKU/item/category/minimum stock/pemasok           | Out of scope checkpoint A                | Ditetapkan inventarisnya sebelum kontrak/API/UI master berikutnya; bukan ditambahkan ke form satuan. |

Jika tiba tahap JSX: shell Backoffice dan pola Inventory design-system-modules §9; judul pendek tanpa deskripsi, satu primary, fakta tidak diulang, gap section minimal 16 px, divider bukan nested card, light/dark dan id/en. Scope route/slicing harus dikonfirmasi sebelum implementasi layar, bukan dianggap tersedia dari halaman `.dev`.

## 4. Checkpoint sesudah A

1. M5-BE-01B: kontrak/schema/persistence master satuan, konversi, item/category, pemasok, stock location secara bounded; owner, composite FK/unik, izin, limit dan migration test disposable ditetapkan sebelum endpoint. Jangan menandai seluruh schema B.6 selesai setelah master saja.
2. API master dan scope/izin/limit/audit/idempotency; baru kemudian ledger + projection atomik, reversal/policy, serta UI menurut urutan M5. Jangan mempublikasikan capability yang belum delivered atau menambahkan dependensi Catalog pada Inventory-only.
3. OD-05 tetap terbuka sebelum handler konsumsi. PRD §15.4 mencakup **ORDER_ACCEPTED (default F&B)**, **PRODUCTION_STARTED**, dan **SALE_COMPLETED**; jangan menurunkannya menjadi dua pilihan karena rencana milestone lama. Tidak ada konsumsi otomatis atau keputusan konfigurasi di A.
4. Uji printer fisik, monitor dapur M3 dan review koreksi M2/M3 tetap terpisah dari penerimaan M4. Penerimaan M4 bukan izin deploy, migrasi development, perubahan scope modul lain atau batch milestone M6.

## 5. Gate A

- [x] Contracts: skema strict, batas SQL desimal/precision, positif/nonnegatif/bertanda, pasangan unit berbeda, tidak menerima metadata/derived/cost input.
- [x] Domain: pecahan eksak, negatif/zero, trailing zero, nilai di atas safe integer, round-trip, konversi kecil/besar/inexact/overflow, invalid precision/factor; tanpa IO/framework/float.
- [x] Root lint/boundary/warna, typecheck, test/format dan build API/web; tidak perlu PostgreSQL/browser untuk primitive tanpa persistence/HTTP/JSX ini. Test tersebut tetap wajib pada checkpoint integrasinya nanti.
- [~] Update TODO/milestone, commit dan push ke branch aktif sebelum checkpoint berikutnya. Implementasi terverifikasi, hash dicatat setelah commit/push. Penerimaan M5 tidak otomatis dari test fondasi.

## 6. Bukti dan batas checkpoint A

- **10 test domain** lulus: parse/format atom eksak, signed/zero/trailing-zero, precision invalid, rentang numeric(30,6) dan angka di atas safe integer, direct conversion kg/g/pack, factor kecil, inexact/overflow dan round-trip/reverse dengan faktor eksplisit. Tidak ada IO, float atau pembulatan.
- **6 test contracts baru** lulus: finite precision 0–6, string decimal/rentang factor, positif/nonnegatif vs ledger signed, payload strict tanpa ID/tenant/outlet/actor/balance/cost/derived result, serta pasangan UUID berbeda (termasuk penolakan self-conversion beda casing). Aritmetika bukan guard kompatibilitas/scope unit; guard itu tetap pekerjaan tahap persistence/API.
- Root lint/boundary/warna, typecheck, test, format lulus: **432 test sumber API + 55 contracts**, web/UI/worker ikut lulus. Build API dan web produksi terisolasi `.next/inventory-quantity-build` lulus; tidak ada route Inventory pada build. Generated `next-env.d.ts` dikembalikan ke path dev normal.
- Run verifikasi sebelumnya terputus/tidak selesai bersih dan log test mencatat kegagalan file tanpa detail assertion; run tersebut tidak dipakai sebagai bukti lulus. Suite penuh diulang dan lulus tanpa menonaktifkan test; tidak mengklaim akar gangguan runner/lingkungan sudah diperbaiki. Log lokal `.cache/m5-quantity-*.log` (Git-ignored).
- Tidak ada migration/Prisma table, endpoint, module activation/manifest delivery, ledger, seed, dependency baru, JSX/route atau stok yang dimutasi. Tidak menjalankan PostgreSQL/browser karena hanya primitive/kontrak tanpa IO; ini **bukan** verifikasi scope/izin/limit/transaksi master, Inventory-only end-to-end, layout UI atau acceptance M5. Database/bucket development tidak dibaca/dimutasi untuk task ini.
- Penerimaan M4 setelah baseline `6129b5b` dicatat di TODO, indeks/milestone dan register review. M3/koreksi M2/printer fisik serta GAP-02/03/04/07 tetap tidak ditutup olehnya. NEXT M5-BE-01B: master schema/persistence bounded sebelum API, bukan form/route atau consumption.
