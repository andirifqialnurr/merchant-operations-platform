# M4 — kontrak checkpoint moderasi Self-Order Basic

**Status:** GAP-01 ditutup secara teknis melalui BE + UI dan E2E lokal. Review visual pengguna/penerimaan M4 tetap terbuka. Belum commit/push.
**Baseline audit:** `2a5f8fd`.
**Otorisasi:** pengguna meminta lanjut M4 setelah koreksi KDS/M2. Ini pengecualian urutan milestone, bukan penerimaan visual M3 atau hasil uji monitor fisik.

## 1. Batas checkpoint

Sumber requirement: [Module Tiers 5.2](../product/CAFE-COMPANION-MODULE-TIERS-V1.md), Basic **Staff accept/reject**; auto-accept policy mulai Pro. [PRD](../product/CAFE-COMPANION-PRD-V2-MODULAR-PLATFORM.md) tetap mengatur order kernel dan FLOOR-005.

Implementasikan moderasi pesanan QR pada kernel order-intake, dengan controller/orchestration di modul Floor. Tidak membuat rute halaman baru, mereslicing `/floor` atau `/pos/tables`, mengerjakan auto-accept Pro, atau menyentuh GAP-02–07 dalam checkpoint backend. Tidak mengubah pesanan POS menjadi perlu moderasi.

Tahap berikutnya memakai panel kunjungan yang sudah ada untuk tindakan staf; perubahan JSX memerlukan inventaris field dan verifikasi visual tersendiri. Backend saja **tidak menutup GAP-01**.

## 2. Hasil audit kode

| Lokasi                                                                       | Kondisi baseline dan dampak                                                                                                                                       |
| ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/api/src/modules/floor/application/guest-ordering.ts`                   | `placeOrder` langsung `submitTableOrder(..., "SELF_ORDER")`; `SUBMITTED` dipetakan menjadi `RECEIVED`. Tagihan/claim menyertakan semua pesanan selain `CANCELED`. |
| `apps/api/src/kernels/order-intake/adapters/prisma-order.repository.ts`      | `createSubmitted` menulis order, snapshot item, audit, dan `order.submitted.v1` dalam satu transaksi. Tidak ada keputusan moderasi.                               |
| `apps/api/src/modules/kds/adapters/order-events.handler.ts`                  | Semua `order.submitted.v1` membuat tiket kecuali order sudah dibatalkan. Filter UI KDS saja tidak mengamankan intake.                                             |
| `apps/api/src/modules/floor/application/table-sessions.ts`                   | Detail menghitung semua pesanan belum lunas selain batal; close mensyaratkan semuanya lunas/batal.                                                                |
| `apps/api/src/kernels/billing-payment-ledger/application/billing.service.ts` | `sessionBills` menolak batal, bukan menunggu moderasi. Perubahan hitungan display saja tidak mengamankan pembayaran langsung.                                     |
| `packages/contracts/src/self-order.ts`                                       | DTO tamu strict, tanpa ID internal; status belum punya state menunggu staf.                                                                                       |
| `apps/api/src/modules/floor/manifest.ts`                                     | Auto-accept tercatat capability Pro; belum ada implementasi policy. Entitlement Pro bukan izin mengaktifkan otomatis secara diam-diam.                            |

## 3. State dan kepemilikan yang ditargetkan

Pisahkan keputusan moderasi dari progres dapur. Jangan memakai `ACCEPTED` dapur sebagai satu-satunya bukti staf menerima pesanan.

- Kernel order-intake memiliki keputusan `NOT_REQUIRED | PENDING | ACCEPTED | REJECTED`, waktu keputusan, pelaku, dan alasan penolakan. Nama kolom/schema final diselaraskan dalam checkpoint implementasi.
- Pesanan POS: `NOT_REQUIRED`; alur event dan pembayaran tetap.
- Pesanan QR baru: order `SUBMITTED`, moderasi `PENDING`; snapshot harga tersimpan, tetapi **belum ada** event pemicu dapur.
- Accept: `PENDING → ACCEPTED`, mempertahankan nomor, snapshot dan identitas order. Transaksi yang sama menulis metadata keputusan, audit, serta satu `order.submitted.v1` untuk integrasi dapur yang sudah ada.
- Reject: `PENDING → REJECTED` dan order `CANCELED` dalam transaksi yang sama; alasan wajib, aktor/waktu dari server. Gunakan mekanisme event pembatalan yang kompatibel, tanpa membuat tiket.
- Keputusan bersifat terminal. Retry keputusan sama mengembalikan hasil tersimpan tanpa audit/event baru. Keputusan berlawanan mengembalikan conflict, bukan membalik hasil.
- Existing orders dimigrasikan sebagai `NOT_REQUIRED`, termasuk SELF_ORDER lama yang mungkin sudah masuk dapur atau dibayar. Jangan mengirim ulang event atau membatalkan transaksi lama.
- Tidak ada auto-accept sampai policy Pro diimplementasikan secara eksplisit pada checkpoint terpisah.

## 4. Transaksi, otorisasi, dan integrasi

Target endpoint staf pada namespace `/floor`: command accept/reject berbasis ID order, tanpa token tamu. Controller wajib memvalidasi schema strict, sesi, instalasi/entitlement modul, izin mutasi dan scope workspace/outlet. Detail/list hanya melalui izin baca yang sesuai.

- Accept memakai izin `order.create`; reject memakai `order.cancel`. Periksa grant peran aktual dan manifest sebelum menambahkan endpoint; jangan meluaskan grant otomatis untuk mengejar test.
- Tenant/outlet/actor berasal dari konteks terotorisasi, bukan body. ID di outlet/workspace lain menjawab not-found tanpa bocoran state.
- Kernel mengunci order atau memakai conditional update yang setara. Hanya `SELF_ORDER`, `PENDING`, kunjungan masih terbuka yang boleh diputuskan. Serialisasikan terhadap cancel, payment, dan close; cek di luar transaksi saja tidak cukup.
- Semua jalur billing (per-order, per-session, klaim tamu dan konfirmasi klaim) menolak order `PENDING`/`REJECTED` setelah penguncian yang relevan. Jangan mengandalkan penyembunyian tombol.
- `dueMinor` tamu/staf tidak memasukkan `PENDING` atau `REJECTED`. Nilai order pending tetap estimasi read-only pada baris order, bukan hutang yang sudah diterima.
- Close tetap menolak kunjungan dengan order pending, meskipun `dueMinor` nol. Staf harus menerima atau menolak terlebih dahulu. Reject semua order tidak otomatis menutup kunjungan atau menghapus riwayat meja.
- Pertahankan satu definisi kelayakan tagih dan uji konsistensinya antara projection, claim dan pembayaran. Hindari predicate terpisah yang kemudian berbeda.
- Handler dapur juga memeriksa kelayakan moderasi dari sumber order: replay event lama/salah tidak boleh memasukkan order pending. Progress dapur tidak boleh membuat pending seolah sudah diterima.
- Payload audit/event tidak berisi token QR, kontak pelanggan, atau catatan sensitif. Perbarui manifest/registry/OpenAPI jika kontrak event atau DTO berubah.
- Pertahankan rate limit tamu dan idempotensi submit. Retry submit setelah keputusan mengembalikan order yang sama, bukan order pending baru. Uji reuse key lintas konteks meja agar tidak mengembalikan order milik kunjungan lain.

## 5. Inventaris field sebelum JSX

| Datum                                               | Klasifikasi               | Lokasi / aturan                                                                                                        |
| --------------------------------------------------- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Accept / reject                                     | User input berupa command | Satu lokasi pada order pending di panel kunjungan yang sudah ada; tunduk izin.                                         |
| Alasan reject                                       | User input                | Dialog penolakan, wajib; batas panjang melalui kontrak.                                                                |
| Nomor order, item, jumlah, opsi, catatan order      | Read-only                 | Detail order yang sudah ada; jangan menambahkan salinan di shell.                                                      |
| Meja/kunjungan                                      | Read-only                 | Konteks panel; tidak diulang per field bila sudah jelas.                                                               |
| Menunggu staf / diterima / ditolak                  | Read-only                 | Status moderasi, dibedakan dari progres dapur dan pembayaran. Tamu tidak melihat pending sebagai sudah diterima dapur. |
| Nilai order pending, total hutang diterima          | Derived display           | Lokasi semantik berbeda: estimasi order versus tagihan kunjungan; tidak masuk payload input.                           |
| ID internal, token QR, actor/waktu keputusan mentah | Hidden dari tamu          | ID hanya untuk command staf internal; metadata audit tidak menjadi field editable.                                     |
| Kontak, grant, harga buatan klien, flag auto-accept | Hidden / out of scope     | Tidak ditambah ke alur moderasi.                                                                                       |

Teks dari kamus id/en. Komponen UI menerima labels melalui props. State guest pending ditambahkan pada kontrak dan dictionary, bukan fallback `RECEIVED`. Tidak merancang halaman/rute baru pada checkpoint ini.

## 6. Acceptance matrix implementasi

- Submit QR Basic: satu order pending, snapshot benar, nol tiket/event dapur; polling guest menunjukkan menunggu staf, hutang belum bertambah.
- Accept: satu keputusan/audit/event; dispatcher membuat tepat satu tiket SELF_ORDER di station yang sama dengan POS; ronde berikutnya mengikuti aturan sama.
- Reject: alasan wajib, batal tanpa bill/penjualan/tiket; order tetap terlihat sebagai ditolak/batal pada kunjungan.
- Retry submit/accept/reject; dua accept bersamaan; accept lawan reject: satu pemenang, tanpa efek ganda. Rollback transaksi tidak meninggalkan keputusan tanpa event atau sebaliknya.
- Replay outbox pending/canceled dan progress dapur palsu/terlambat tidak melewati moderasi.
- Semua jalur bayar/claim langsung terhadap pending ditolak; due accepted-only sama di staf/tamu/server; close pending ditolak. Uji keputusan bersamaan dengan bayar, tambah order dan close.
- Izin baca saja tidak dapat memutuskan; tanpa modul/entitlement ditolak; scope workspace/outlet dan ID tamu tidak bocor. Kasir/pelayan diuji sesuai grant aktual, bukan asumsi.
- Migrasi existing POS/SELF_ORDER tidak mengubah tiket, status, bill, pembayaran, atau subscription lama. POS biasa tetap langsung ke KDS.
- Browser setelah backend: staf accept/reject, guest pending → progres dapur, state kosong/error/retry/read-only, minimum 320px serta S/M/L, id/en dan light/dark. Baca screenshot sampel; test bukan persetujuan visual pengguna.

## 7. Urutan checkpoint lanjut

1. **M4-GAP01-PLAN:** audit + kontrak ini; tidak menyatakan capability sudah tersedia.
2. **M4-GAP01-BE:** schema/migrasi maju, kernel commands, endpoint staf, DTO guest/staf, semua billing gates, KDS defense, test unit/kontrak/PostgreSQL disposable. Update schema/flowchart sesuai implementasi. Tidak mengubah database development tanpa kebutuhan/izin yang jelas.
3. **M4-GAP01-UI:** integrasi pada panel yang ada dan status tamu, dictionary, browser disposable dan review visual. Reslicing/redesign baru tetap perlu konfirmasi khusus.

Commit/push hanya bila diizinkan; satu checkpoint selesai diverifikasi sebelum lanjut. GAP-01 baru dicentang sesudah BE dan UI lulus, bukan karena rancangan ini tersedia. GAP-05 gambar dan GAP-06 struk tetap terbuka.

### Inventaris dan batas checkpoint UI (sebelum JSX)

Pengguna menginstruksikan `lanju` setelah checkpoint BE; UI dilanjutkan eksplisit meskipun BE belum commit/push. Tidak ada izin commit/push atau migrasi development yang diasumsikan.

- **Input:** command Terima pada order pending (`order.create`); command Tolak dan alasan 3–300 karakter (`order.cancel`). Alasan ditaruh pada form inline di baris order yang ditolak, bukan modal kedua di atas sheet kunjungan; menghindari perangkap focus/Escape nested overlay tanpa merancang ulang rute atau primitive. Dua aksi baris menggunakan secondary/ghost; submit penolakan satu aksi utama form. Tidak mengedit order, harga, nomor, status, actor atau timestamp.
- **Read-only:** nomor order, baris nama/varian/modifier/jumlah, catatan item/order yang benar-benar tersedia, status keputusan dan pembayaran. Perluasan DTO hanya memasok snapshot opsi/catatan yang sudah disimpan; staf harus dapat memeriksa pesanan sebelum menerima. Tidak mengirim data kontak atau audit.
- **Derived:** estimasi nilai pending di baris order; hutang accepted-only di fakta kunjungan. Jumlah pending untuk discovery pada tile meja saja, tidak diulang pada header/panel. Saat pending, hanya metrik pending yang tampil pada tile, menggantikan tamu/durasi (keduanya tetap di panel), tanpa menambah banner/queue duplikat atau count nol. Pembayaran/konfirmasi/close tidak ditawarkan selama ada pending; menolak klaim lama tetap tunduk izin.
- **Hidden:** ID internal selain argumen command staf, QR mentah kecuali sesi fixture test, metadata audit/aktor/waktu keputusan, kontak, field auto-accept Pro dan data yang tak tersedia. Pending tidak diberi label Belum dibayar atau Lunas.
- Tetap memakai `/pos/tables`, panel/sheet kunjungan, TableTile, Badge, Button, FormField dan Textarea yang ada. Tidak merancang ulang shell/editor/layout route. Audit menemukan avatar header POS melebar 24px pada 320px; koreksi hanya spacing header/nav di Small, tanpa mengubah struktur/menu/rute. Data pending muncul pada tile agar staf mengetahui perlu membuka meja, tanpa menambah rute baru.
- Mutasi tanpa optimistic update; semua tombol keputusan dan aksi kunjungan dinonaktifkan saat mutasi berjalan. Gagal kirim mempertahankan alasan dan menawarkan retry; conflict dari keputusan staf lain memuat ulang data otoritatif. Akses baca saja tidak merender form/tombol mutasi. Status ditampilkan satu lokasi per order; tidak menambah badge status terpisah yang mengulang pembayaran.
- Verifikasi: kontrak DTO, helper aksi/status, E2E memakai PostgreSQL/API disposable (submit tamu, accept/reject dari panel staf, KDS/progres/tagihan, peran, retry/conflict), serta S/M/L 320/768/1440, id/en dan light/dark dengan screenshot sampel dibaca. Bukan acceptance visual pengguna.

## 8. Bukti checkpoint M4-GAP01-BE

- Implementasi sesuai state pada bagian 3. Schema final: enum `OrderModerationStatus`, kolom `moderation_status`, `moderated_at`, `moderated_by`; alasan reject pada `cancel_reason`. Default lama `NOT_REQUIRED`, bukan backfill pending. Migration forward-only; rollback kode tidak menghapus keputusan atau schema.
- Endpoint `POST /floor/guest-orders/:id/accept` (body `{}`, `order.create`) dan `/reject` (body `{ reason }`, 3–300 karakter, `order.cancel`). Mutasi berstatus 200, resource-idempotent tanpa memerlukan replay cache generik. OpenAPI memakai schema strict. Izin Cashier menerima/menolak, Waiter hanya menerima, read-only tidak memutuskan; grant lama tidak diluaskan.
- Order kernel memiliki state/snapshot/keputusan. Floor menyediakan port baca guard kunjungan yang tidak bergantung layanan order/billing; tidak ada akses tabel Floor langsung dari kernel. Adapter terkait memakai advisory transaction lock workspace/kunjungan sebelum row lock. Close mengulang pemeriksaan settled di bawah lock; billing mengulang approval dan komposisi order kunjungan. Pending tidak masuk due, pembayaran/claim/progres/KDS; generic cancel pending menetapkannya REJECTED.
- 21 test integrasi PostgreSQL sekali pakai lulus: migrasi mempertahankan seluruh kolom lama tanpa event baru, shared kitchen POS/guest setelah approval, retry dan competing decisions, rollback order/audit/outbox, scope outlet/workspace, grant peran nyata dan uninstall modul, snapshot stale pada per-order/session/claim, close vs submit. Suite self-order diulang sesudah menambah race accept/payment dan claim yang terhalang ronde pending baru: lulus.
- Root lint/boundary/warna, typecheck, test dan format lulus; 398 test sumber API, 41 contracts, regresi web/worker/UI/Storybook; Prisma validate dan build API/web lulus. P99 POS → KDS lokal pada 200 pesanan 1.291 ms. Run integrasi penuh awal melewati batas 300 detik; run ulang selesai 21/21. Warning deprecation `pg` bukan kegagalan suite. Fault injection menghasilkan 500 yang memang diuji untuk rollback.
- Kompatibilitas guest: badge pending dari kamus id/en dan toast terkirim yang netral (termasuk retry setelah keputusan); pending-only tidak menyatakan lunas, mixed pending tidak menawarkan claim. 12 browser GET-only mock test lulus pada 320/768/1440px × dua tema × dua bahasa, 12 screenshot. Tiga sampel (HP dark en, tablet dark id, desktop light id) dibaca: status satu lokasi, tanpa overflow horizontal atau klaim lunas palsu. Ini bukan E2E submit/accept/reject staf dan bukan persetujuan visual pengguna.
- Runner browser: `pnpm --filter @merchant/web test:e2e:moderation`; web sendiri port 4100, output `.next/moderation-e2e`, API dimock di browser. Screenshot di `apps/web/test-results/guest-moderation` (Git-ignored). Build produksi memakai `.next/moderation-build`.
- Tidak ada migrasi atau mutasi data development. Jalankan migrasi melalui proses normal sebelum memakai backend baru dengan database development; schema lama belum punya kolom baru. Tidak ada deploy, commit atau push pada checkpoint ini. Pada checkpoint BE ini tombol staf dan E2E dengan backend nyata masih tersisa; penyelesaiannya dicatat terpisah pada bagian 9. Jangan menyatakan seluruh Self-Order Basic/M4 diterima hanya dari backend.

## 9. Bukti checkpoint M4-GAP01-UI

- Panel kunjungan `/pos/tables` sekarang menampilkan snapshot varian/modifier, jumlah, catatan item dan order untuk review. Pending memakai satu badge Menunggu staf + estimasi, bukan label hutang/lunas. Keputusan diterima/belum dibayar, ditolak, batal dan lunas punya satu lokasi status per order. Count pending dihitung sekali melalui group-by order scoped outlet, bukan N+1 atau nilai input; tile memakai Tinjau/Review + satu count. Tidak ada queue/banner/rute baru.
- Terima (`order.create`) dan Tolak (`order.cancel`) memanggil endpoint BE lewat klien API/schema strict. Form penolakan inline memvalidasi kontrak 3–300 karakter, fokus ke alasan, kembali ke tombol saat batal dan tetap menyimpan input bila request gagal. Mutasi menunggu hasil server; cache floor yang scoped workspace/outlet diinvalidasi pada sukses maupun error/conflict. Tombol pending dan aksi kunjungan dikunci selama mutasi; pembayaran/konfirmasi/close tidak ditawarkan sebelum keputusan selesai. Read-only tidak mendapat aksi mutasi; Waiter hanya mendapat Terima.
- Test browser pertama menemukan target tombol 36px dan avatar POS melebar 24px pada 320px. Tombol keputusan kini menggunakan ukuran komponen `lg` (48px), spacing header/nav Small dipadatkan tanpa mengubah struktur menu. Dua metrik biasa tidak dipaksakan pada tile pending kecil; hanya count pending, tamu/durasi tetap pada panel.
- Navigasi browser juga memunculkan callback fokus overlay yang membaca ref portal yang sudah dilepas. Guard null untuk timer dan `event.currentTarget` untuk Tab trap memperbaikinya tanpa mengganti API/visual primitive. Test komponen mereproduksi late callback setelah unmount; suite browser kini menolak uncaught page errors.
- **16 browser test lulus:** empat test staf memakai API, cookie/peran nyata, worker dan PostgreSQL disposable; 12 test tamu GET-only mock tetap lulus. Alur nyata: submit tamu → tidak ada bill/tiket → cashier accept → satu event/tiket SELF_ORDER berlabel meja → dapur PREPARING → progres tamu; ronde berikutnya reject, input invalid/503/retry, alasan tersimpan dan tanpa tiket/bill baru. Read-only, Waiter, conflict staf lain, empty visit serta gagal-load/retry diuji. Pembayaran uang tetap dibuktikan pada integrasi backend, bukan diklaim sebagai browser checkout baru.
- **40 capture** di `apps/web/test-results/moderation` (di luar duplikat attachment): 24 pending/form staf pada 320/768/1440 × light/dark × id/en, 12 tamu, empat flow/read-only. Sampel desktop light id, tablet dark en, HP dark en, retry dan hasil tamu dibaca. Tidak mengklaim seluruh 40 gambar dibaca, persetujuan pengguna atau uji fisik.
- **21 integrasi PostgreSQL lulus** sesudah perluasan DTO: snapshot catatan/opsi untuk staf, count pending hilang setelah keputusan, isolasi, retry/race/rollback, billing/close gates, POS/KDS dan regresi modul lain. P99 POS → KDS lokal terbaru 1.091 ms/200 pesanan, bukan SLA produksi. Root lint/boundary/warna, typecheck, test dan format lulus (398 sumber API, 41 contracts, 281 UI, 61 test TS web + 10 script web; worker juga lulus); build API/web terisolasi lulus.
- `pnpm --filter @merchant/web test:e2e:moderation` kini menjalankan kedua suite pada web 4100 dan API fixture 4101; database dibuat/dihapus oleh fixture. Runner umum melewati suite staf dan tidak menyalakan fixture. Tidak ada migrasi, form submit atau mutasi data development; schema development masih harus dimigrasikan sebelum memakai kode baru.
- **GAP-01 selesai teknis, belum commit/push dan bukan penerimaan M4.** Review visual pengguna, GAP-05 gambar, GAP-06 struk dan gate fisik M3 tetap terbuka. Tidak memulai checkpoint berikutnya/M5 atau reslicing rute lain.
