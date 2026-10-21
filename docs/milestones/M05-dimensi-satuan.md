# M5 — dimensi satuan sebelum direct conversion

**Status:** Selesai teknis/terverifikasi — prasyarat B2b2a setelah baseline `ddfe279`; commit/push dicatat setelah verifikasi akhir. Pengguna menyetujui penambahan dimensi melalui **“silahkan lanjutkan”** setelah celah kompatibilitas dijelaskan. B2b2 create conversion belum selesai.

## 1. Kontrak sebelum implementasi

PRD §15 (conversion dasar), schema B.6, backend/security dan keputusan pengguna mengatur checkpoint ini. Satu checkpoint bounded: dimensi unit pada kontrak, schema, create/read internal existing dan predicate domain. Belum writer conversion/HTTP/UI/manifest/ledger, deployment atau migrasi development.

- Dimensi eksplisit `MASS`, `VOLUME`, `COUNT`, `LENGTH`, `AREA`; bukan angka precision, kuota paket, unit biaya, nama/kode, faktor SI atau dimensi limit Core. Tidak menebak dari `kg`, `g`, `L`, bahasa atau label. Tidak ada fallback `OTHER` yang membuat dua unit tak dikenal kompatibel. Penambahan jenis dimensi berikutnya perlu perubahan kontrak/migrasi tersendiri.
- Create unit wajib menerima dimensi yang dikenal. DTO read menyertakan `dimension: enum | null`; NULL khusus definisi lama yang belum diklasifikasi, bukan dimensi atau default COUNT. CREATE DB baru juga wajib mempunyai dimensi, tanpa SQL default. Migrasi tidak mengisi ulang data lama atau mengubah conversion/audit/key/hasil replay.
- Dimensi yang sudah diketahui immutable sejak create, termasuk sebelum reference pertama; tidak boleh menjadi NULL atau berubah MASS menjadi VOLUME. Legacy NULL hanya boleh diklasifikasi melalui write terkontrol yang belum disediakan, dan hanya bila belum direferensikan (`definition_locked = false`). Legacy terpakai perlu keputusan remediation khusus yang mempertahankan histori; tidak dibuka paksa di checkpoint ini.
- Predicate kompatibilitas hanya true bila kedua dimensi dikenal dan sama. MASS → VOLUME dan NULL → NULL ditolak. Ini syarat perlu, bukan bukti ownership, parent availability atau factor yang benar: B2b2 writer berikutnya wajib membaca kedua parent scoped dan stabil dalam transaksi, menjalankan predicate, lalu menyimpan factor eksak/audit/key atomik. Tidak ada inverse/path otomatis.
- COUNT tidak berarti kemasan punya isi standar. Faktor pack/box tetap eksplisit dan hanya tepat bila definisi global pasangan benar; pack → MASS/VOLUME atau density/resep spesifik item tidak boleh diakali dengan mengganti dimensi. Konversi lintas dimensi/item-specific memerlukan kontrak tersendiri, belum diimplementasikan.
- Permission, all-outlet/Backoffice, fresh authorization sebelum replay, entitlement/install/capability dan no-device dari B2b1 tidak berubah. Tidak menambah limit unit/dimensi yang tidak ada di paket. Dimensi disertakan pada hash logical body, audit critical aman dan snapshot hasil baru.
- Rilis/rollback: writer baru memerlukan schema baru; writer lama yang tidak mengirim dimensi akan ditolak INSERT guard. Karena belum ada runtime/HTTP Inventory, checkpoint tidak mengaktifkan jalur tersebut. Jangan menghapus kolom/enum/guard atau menebak dimensi sebagai rollback; hentikan writer terkait dan lakukan koreksi maju melalui proses rilis yang disetujui. Klasifikasi legacy terpakai bukan backfill otomatis.
- Ini perubahan kontrak internal sebelum HTTP. Snapshot lama yang tidak memiliki dimensi tidak diperbaiki/diperluas dengan fakta tebakan: retry dengan body baru berbeda hash ditolak `IDEMPOTENCY_KEY_REUSED`, hasil tak lengkap tetap fail closed. Reservation lama tidak dihapus. Adapter baru memerlukan migrasi rilis yang disetujui sebelum dipakai; migrasi di sini hanya diuji disposable.

## 2. Inventaris data (tanpa JSX)

| Datum                                      | Klasifikasi               | Aturan                                                                               |
| ------------------------------------------ | ------------------------- | ------------------------------------------------------------------------------------ |
| code/name/precision/dimension              | User input create berizin | Dimensi wajib eksplisit; empat field strict, bukan status/saldo/hasil konversi.      |
| id/code/name/precision/dimension pada DTO  | Read-only authoritative   | Satu representasi, dimensi legacy NULL tetap tidak diketahui; bukan field edit umum. |
| hasil predicate                            | Derived internal          | Tidak dikirim sebagai input atau bukti izin/ownership.                               |
| scope/actor/key/hash/audit/latch/timestamp | Hidden/system-only        | Dari adapter/Core, bukan body.                                                       |
| factor/conversion result/saldo/cost/kontak | Out of scope              | Belum create conversion atau UI baru.                                                |

## 3. Gate

- [x] Contracts dan source tests: explicit dimension, strict/legacy DTO, predicate dikenal/sama, hash/replay/audit/create/read dan tanpa perubahan izin.
- [x] PostgreSQL disposable: upgrade data lama tanpa tebakan, new insert wajib dimensi, immutability/null/legacy latch, race dan rollback, replay/key lama fail closed, query scoped.
- [x] Root lint/boundary/warna/typecheck/test/format, Prisma format/validate/generate dan build API/web; update TODO. Commit/push dicatat di bawah. Tidak menjalankan browser karena tidak ada JSX/HTTP/surface baru.

## 4. Bukti dan batas

- **3 contracts + 6 source tests baru**: dimensi wajib eksplisit/closed, legacy NULL hanya read, strict metadata, predicate seluruh pasangan dimensi dan unknown, create menolak dimensi absen/unknown sebelum writer serta menolak hasil create NULL; static schema/migration tanpa data rewrite/grant/activation.
- **7 test PostgreSQL baru (induk + 6 subtest)**: fixture historis disisipkan tepat sebelum migrasi baru melalui hook harness yang hanya menerima database disposable milik invocation; unit g/L yang pernah punya conversion lama tetap unknown. Semua kolom lama/latch/timestamp, conversion, audit dan key/hasil dibandingkan sebelum/sesudah dan tidak berubah. DTO read NULL dan scope tenant asing diuji; SQL/Prisma menolak dimensi baru kosong/unknown, lima dimensi exact create/audit/snapshot, known immutable meski belum dipakai, label tetap bisa dikoreksi, legacy referenced NULL tak bisa diklasifikasi, rollback klasifikasi dan race first reference.
- Hash body menyertakan dimensi, replay normalized mengembalikan snapshot asli sesudah rename, beda dimensi conflict. Hash lama tetap reserved (`IDEMPOTENCY_KEY_REUSED`); snapshot tanpa dimensi dengan hash baru yang rusak gagal `IDEMPOTENCY_RESULT_UNAVAILABLE`, tanpa mutasi ulang. Suite create existing tetap memverifikasi permission/fresh access, revoked access sebelum replay, race, rollback audit/result/completion serta kini menolak snapshot dengan dimensi NULL/berbeda.
- **38 test integrasi Inventory terfokus dan 81 integrasi PostgreSQL penuh lulus, 0 gagal/skip**. Run terfokus awal gagal karena key fixture baru lebih pendek dari minimum 16 karakter; key test diperbaiki dan suite sah diulang seluruhnya, bukan mengabaikan kegagalan. Entitlement facts fixture tetap disimulasikan, bukan instalasi/aktivasi atau test HTTP sesi.
- Root gates lulus: **466 source API + 6 scripts, 62 contracts, 285 UI, 69 web TS + 10 scripts**, database 3 dan worker 10. Prisma format/generate/validate, build API dan web produksi terisolasi `.next/inventory-dimension-build` lulus; generated next-env dipulihkan dan typecheck diulang. Log `.cache/m5-dimension-*` Git-ignored. Tidak ada dependency/JSX/label UI baru sehingga browser/Storybook visual tidak dijalankan.
- Belum writer atau guard DB compatibility conversion, endpoint/module wiring/manifest/capability delivery/ledger/UI/acceptance M5. Predicate baru adalah syarat perlu untuk checkpoint writer berikutnya, bukan klaim bahwa raw SQL conversion lama kini aman/kompatibel. Tidak ada migrasi development, deployment, grant baru atau perubahan data pengguna.

## 5. NEXT

B2b2b create direct conversion memakai dimensi ini untuk parent/ownership/compatibility dalam transaksi, factor eksak, audit/idempotency/conflict mapping. B2b2/B2b/B2/BE-01/FT-01 tetap terbuka; endpoint, update/lifecycle dan master lain tetap checkpoint terpisah.
