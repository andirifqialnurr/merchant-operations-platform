# M4 — bill dan struk kunjungan (GAP-06)

**Status:** GAP06A selesai teknis, diverifikasi dan dipush ke `origin/main` sebagai `d86dd72` setelah `920cbc4`. GAP06B berjalan: B-01 menyiapkan kontrak/proyeksi finansial murni; query API dan UI/cetak belum tersedia. Bukan penerimaan pengguna/M4.

## 1. Sumber dan batas

[PRD FLOOR-005](../product/CAFE-COMPANION-PRD-V2-MODULAR-PLATFORM.md) mengatur satu bill per table session sebagai batas UI Basic; split bill penuh future. [Register GAP-06](./REVIEW-M03-M04.md) meminta representasi struk kunjungan tanpa nominal pembayaran gabungan berulang/menyesatkan pada struk per pesanan. [Schema B.3/B.4](../foundation/schema.md) tetap menyimpan bill/sale per order dan alokasi satu pembayaran ke beberapa bill. Struktur ledger bukan alasan menurunkan kontrak UI.

Pisahkan dua checkpoint keuangan yang dapat diverifikasi:

1. **GAP06A — koreksi struk per pesanan:** baca alokasi ledger yang sebenarnya; jangan menampilkan uang diterima/kembalian satu kunjungan pada tiap struk order. Pertahankan pembayaran/refund/shift/claim dan ledger yang sudah ada. Tidak menambah halaman/rute atau merancang ulang receipt primitive.
2. **GAP06B — representasi bill/struk satu kunjungan:** agregasi snapshot order/bill dan deduplikasi pembayaran/refund, akses dari flow kunjungan yang ada, penanganan visit pending/belum lunas dan pembayaran lama per-order. Inventaris/state dan scope UI ditetapkan sebelum JSX tahap itu; tidak diimplementasikan dalam A.

**GAP-06 baru ditutup setelah B terpenuhi dan diuji**, bukan karena struk per-order tidak lagi salah. Tidak memulai M5, mixed payment, split bill, diskon, deploy atau migrasi development.

## 2. Audit baseline A

- `PrismaBillingRepository.findPaidCheckoutByOrder` mengambil allocation pertama tetapi membuang `allocation.amount_minor`; yang dikembalikan adalah `payment.amount_minor/tendered_minor` gabungan.
- `BillingService.paidCheckout` menjaga pembayaran sebenarnya untuk refund/ledger; `PosOrdersService.receipt` meneruskannya tanpa konteks alokasi.
- `ReceiptContent` mencetak `payment.tenderedMinor ?? payment.amountMinor` serta `payment.changeMinor`, sehingga dua order 50.000 + 25.000 yang dibayar dengan 100.000 sama-sama mencetak 100.000 dan kembalian 25.000.
- `useReceipt` memakai staleTime Infinity meskipun refund/history dapat berubah. Print hanya memeriksa keberadaan cache; kegagalan refetch dapat meninggalkan print aktif dengan data lama.

## 3. Kontrak checkpoint A

- Billing repository membaca nominal alokasi, jumlah allocation pada bill dan pada payment dari relasi ledger pada proyeksi repository yang sama dan tetap scoped workspace/outlet/order. Nilai bukan hitungan proporsi dari total atau input klien.
- Tambahkan proyeksi receipt `paymentAllocation: { amountMinor, shared }`. `payment` tetap snapshot transaksi sebenarnya (termasuk tender/change), bukan dipalsukan menjadi transaksi per-order baru. Refund dan kas tetap memakai payment/sale ID/amount asli.
- Untuk model R1 saat ini, bill paid harus memiliki tepat satu allocation yang sama dengan paidMinor/totalMinor. Payment harus menutup alokasi itu; payment tunggal harus sama dengan allocation. Banyak allocation pada satu bill (mixed tender yang belum dibangun), nilai tidak konsisten atau data hilang membuat receipt gagal tertutup, bukan mengarang nol/alokasi/pembayaran. Endpoint refund tidak diubah oleh koreksi display ini.
- `shared` berdasarkan jumlah relasi payment allocation, bukan dugaan dari selisih uang. Struk shared menampilkan **Bagian pembayaran · metode** sebesar allocation order itu; nominal uang diterima dan kembalian gabungan **tidak dicetak**. Referensi pembayaran dan refund order yang memang tersedia tetap di lokasi semula.
- Struk payment satu order tetap menampilkan tender/change asli seperti sebelumnya. IDR/USD dan jumlah di atas safe integer dihitung sebagai bigint/string, tanpa pembagian float atau pembulatan alokasi.
- Tidak ada update data, migrasi, payment replay baru, event, grant izin atau perubahan mutasi uang. Endpoint receipt tetap memeriksa sesi/modul/izin dan scope yang sudah ada.
- Saat dibuka kembali, receipt mengambil data server terbaru. Print tidak tersedia selama fetch/paused/error meskipun ada cache lama; gangguan sementara menawarkan Coba lagi, allocation tidak representable meminta pemeriksaan pengelola tanpa retry loop. Tidak ada optimistic receipt/payment/refund.

## 4. Inventaris sebelum JSX A

| Datum                                                                     | Klasifikasi                      | Lokasi dan aturan                                                                                                    |
| ------------------------------------------------------------------------- | -------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Lebar kertas 58mm/80mm/A4                                                 | User input konfigurasi perangkat | Pemilih yang sudah ada; tidak menjadi payload keuangan                                                               |
| Print / retry / tutup                                                     | User command lokal/read          | Satu primary Print saat data siap; retry pada error, tidak submit transaksi                                          |
| Nama outlet/workspace, order/sale number, waktu bayar, cashier name       | Read-only                        | Metadata receipt; pengulangan konteks di struk diizinkan design-system 4.2; ID internal/actor ID tidak ditampilkan   |
| Nama/item/varian/modifier/catatan, jumlah                                 | Read-only                        | Baris snapshot order yang sudah ada, tidak dapat diubah dari receipt                                                 |
| Total, subtotal/pajak/service/rounding/discount jika berlaku              | Derived/read-only snapshot       | Area total receipt; tidak menghitung ulang dengan tarif kini                                                         |
| `paymentAllocation.amountMinor` dan shared                                | Derived/read-only ledger         | Satu baris bagian pembayaran pada shared receipt; tidak menjadi input                                                |
| Metode/reference, tender/change pada single-order payment                 | Read-only/derived                | Area payment yang sudah ada; tender/change disembunyikan jika shared                                                 |
| Refund order                                                              | Read-only                        | Satu baris per refund pada receipt order itu; tidak mengurangi allocation/snapshot original payment secara diam-diam |
| Total payment/tender/change kunjungan pada shared order receipt           | Hidden dari rendering order      | Tetap benar pada snapshot transaksi API, tidak dipresentasikan sebagai uang diterima/kembalian order                 |
| Internal IDs, relation count, timestamps/actors audit, kontak, kredensial | Hidden                           | Tidak diubah menjadi field atau fakta tambahan                                                                       |

Semua label dari kamus id/en, Receipt menerima props. Tetap Calm Neutral/light/dark, tanpa page description, nested card atau route baru. Receipt per-order bukan pengganti bill/struk kunjungan B.

Regresi offline mengungkap overflow shell POS 24 px pada 320 px. Koreksi dibatasi padding navigasi Small dengan target minimal 48×48 px; tujuan, urutan, label dan field context/status shell tidak ditambah/dihapus. Status koneksi tetap fakta read-only di shell. Tidak ada reslicing/redesign rute.

## 5. Verifikasi A yang wajib

- Unit/contracts: sumber alokasi aktual, shared/single, invariant fail-closed, precision bigint, field input ditolak/tidak ditambahkan ke command; view tidak memproyeksikan tender/change grup pada shared order.
- Integrasi PostgreSQL disposable: dua order berjumlah berbeda dibayar tunai sekali, struk masing-masing memiliki allocation benar dan snapshot payment sama; non-tunai, refund parsial/full, ulang baca tidak mengubah uang/ledger/outbox; single-order tetap; scope/izin; data allocation tak representable ditolak tanpa mutasi.
- Browser: shared per-order receipt label/nominal benar, cash tender/change grup tidak muncul; single-order dan non-tunai, refund/history, cache-error/retry/Print disabled, ID/EN, S/M/L dan dua tema. Print media hanya mencetak receipt; 58/80/A4 diuji tanpa mengklaim hasil printer fisik.
- Root lint/boundary/warna, typecheck/test/format, build API/web; update TODO dan milestone dengan bukti/batas, commit dan push ke branch aktif sebelum B.

## 6. Bukti checkpoint A

Implementasi dan bukti verifikasi dipush sebagai `d86dd72` (`fix(receipts): show actual order allocations for shared payments`). Gate verify → commit → push A terpenuhi sebelum B.

- Repository memproyeksikan allocation positif aktual dan kardinalitas; domain menolak bentuk R1 tak representable. DTO staff/OpenAPI menambah field read-only, bukan command. Refund/shift/claim dan snapshot payment asli tidak diubah. Test double kas diperbaiki agar menghitung payment unik seperti repository nyata, bukan menggandakan payment per checkout.
- Root unit **409** test sumber API + test skrip, **45** contracts, serta web/UI/worker lulus. Precision di atas safe integer, USD cents, single/shared, penolakan nol/invariant, dan tidak adanya allocation pada command diverifikasi.
- Seluruh **29** test integrasi PostgreSQL lulus; **7** di file `receipt-allocation.integration.test.mjs` (parent + enam subtest) memeriksa cash/non-cash, IDR/USD, partial/full refund, snapshot payment asli, ledger/audit/outbox tidak berubah saat read, kas dihitung sekali, scope/izin dan fail-closed fault injection. Tidak memakai data development.
- **4** browser receipt disposable lulus, **22** capture: 12 kombinasi 320/768/1440 × light/dark × id/en, print media 58/80/A4, single cash, transfer/reference, USD, refund dari request terpisah, paused/offline, cached-error/retry serta allocation 409 tanpa Print. Native Print distub; media print diverifikasi, bukan printer/driver fisik atau jaminan ukuran kertas perangkat. Tidak ada overflow dokumen/receipt pada capture.
- Sembilan sampel screenshot dibaca: 320 dark/en, 768 dark/id, 1440 light/id, USD 320 dark/en, print 58mm, refund, offline/paused, transient error dan allocation invalid. Pemeriksaan duplicate fact/conditional visibility tidak menambahkan field, input nominal turunan, atau nested card. Ini bukan penerimaan visual pengguna.
- Regresi browser moderasi **16** dan gambar tamu **3** lulus. Root lint/boundary/warna/typecheck/test/format, build produksi API/web lulus; import generated route pada `next-env.d.ts` dikembalikan ke path development normal setelah build/fixtures.
- Log lokal di `.cache/m4-receipt-*.log`; capture di `apps/web/test-results/receipts` (Git-ignored). Reproduksi browser: `pnpm --filter @merchant/web test:e2e:receipts`; integrasi dari `apps/api`: `node --env-file=../../.env --import tsx --test --test-concurrency=1 test/*.integration.test.mjs`.

**Batas:** tidak ada migrasi/dependency baru, perubahan database/bucket development, deploy atau persetujuan M3/M4. Tidak ada benchmark beban atau uji printer fisik. **GAP06B — bill/struk satu kunjungan — belum tersedia end-to-end**, sehingga GAP-06/FLOOR-005 tetap terbuka. Migrasi moderasi sebelumnya tetap memerlukan proses deployment yang diotorisasi sebelum backend baru dipakai dengan schema development lama.

## 7. GAP06B — checkpoint dan kontrak

Instruksi pengguna sesi 20 Oktober 2026: lanjutkan pekerjaan, verifikasi → commit → push setiap task; prioritaskan jarak layout, satu fakta satu lokasi, tanpa deskripsi panjang. Tidak ada izin reslicing/redesign rute baru.

- [x] **B-01 — kontrak/proyeksi finansial:** skema read-only `visitFinancialDocumentSchema` dan fungsi domain murni `visitFinancialDocument`; belum ada HTTP, repository, query hook atau JSX. Implementasi diverifikasi; hash dicatat setelah commit sebelum push.
- [ ] **B-02 — query API:** satu query kunjungan melalui facade publik kernel; scoped tenant/outlet/session, izin baca keuangan sama dengan receipt (`order.view`) ditambah konteks modul Floor. Pilih query/read consistency sebelum implementasi; dilarang merangkai receipt per-order dari pembacaan berbeda lalu menganggapnya satu snapshot atomik. Paid bills, allocation, payment dan refund harus konsisten; seluruh pembayaran shared harus tertutup di visit yang sama. Data tidak lengkap/tidak representable ditolak, bukan diubah menjadi unpaid. Uji API lokal/PostgreSQL disposable, rollback/read-only, izin dan substitusi scope.
- [ ] **B-03 — UI/cetak:** akses dari panel kunjungan dan hasil pembayaran yang sudah ada; tanpa rute/shell baru. Fresh read saat membuka; Print disabled saat fetching/paused/error. Bayar/close tetap command yang ada, bukan aksi dalam struk. Uji browser S/M/L × light/dark × id/en, state finansial/error/cache/retry serta media 58/80/A4. Review sampel screenshot dan duplicate fact sebelum commit/push. Printer fisik dan acceptance pengguna tidak diganti oleh browser test.

### 7.1 Semantik finansial B-01

- Input domain berasal dari snapshot kernel otoritatif: paid receipts lengkap dan order belum dibayar; bukan kontrak command/body pengguna. Domain tidak membaca database, memanggil HTTP, atau menulis ledger.
- Snapshot bill/sale/order yang sudah dibayar dipertahankan, termasuk tarif lama. Hanya order approved belum dibayar memakai `computeCharges` dengan tarif kini; sumber pricing ditandai `PAID_SNAPSHOT`/`CURRENT_CHARGES`. Ini bill sementara, bukan janji tarif setelah perubahan berikutnya.
- Payment unik berdasarkan ID transaksi. Jumlah allocation setiap payment harus persis sama dengan nominal payment dan bentuk single/shared harus cocok; satu payment yang hanya terbaca sebagian atau menjangkau visit lain ditolak. Tender/change/reference/cashier hanya satu record per transaksi, tidak dimasukkan kembali pada tiap order. Pembayaran lama per-order tetap masuk bersama pembayaran visit baru.
- Refund unik berdasarkan ID, tetap terikat order. Duplikat identik tidak dihitung dua kali; snapshot duplikat yang bertentangan ditolak. Refund tidak mengurangi total penjualan asli atau membuka kembali hutang. `paidMinor` adalah payment asli, `refundedMinor` pengembalian unik, `netPaidMinor` selisih keduanya, `dueMinor` hanya total approved belum dibayar.
- Pending ditempatkan pada `pendingOrders`, tanpa pricing/bill/sale; tidak disamakan dengan diterima, hutang nol, atau lunas. Canceled/rejected yang telah dibatalkan tidak dicetak. Paid snapshot dengan order canceled/pending atau ledger/totals/refund tak konsisten membuat hasil `null` (fail closed).
- State `PENDING` mendahului state pembayaran; selain itu `EMPTY`, `UNPAID`, `PARTIALLY_PAID`, `PAID`. Hanya `PAID` menjadi `kind: RECEIPT`; zero-price order yang belum memiliki payment tetap `UNPAID`, bukan receipt palsu.
- Semua jumlah menggunakan bigint/string integer, termasuk USD cents dan nilai di atas safe integer. Agregasi subtotal dasar + service + tax − discount + rounding, tanpa menerapkan tarif tunggal baru pada seluruh visit. Tarif yang berbeda tetap berada pada breakdown snapshot order; label gabungan tidak boleh mengklaim semua order memiliki tarif/included mode sama.
- Query B-02 wajib menyediakan semua order visit, bukan hanya hasil pagination/daftar terbaru. Fungsi murni dapat menolak shared payment tidak lengkap, tetapi tidak dapat mendeteksi satu legacy payment yang hilang seluruhnya; itu tanggung jawab sumber query lengkap dan konsisten, bukan alasan untuk mengarang nilai.

### 7.2 Inventaris sebelum JSX B

| Datum                                                                                                        | Klasifikasi                          | Lokasi/aturan                                                                                                                                                |
| ------------------------------------------------------------------------------------------------------------ | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Paper 58/80/A4, Print, retry, tutup                                                                          | User input konfigurasi/command lokal | Toolbar/footer sheet; satu primary Print, bukan payload keuangan.                                                                                            |
| Nomor kunjungan dan meja jika tersedia                                                                       | Read-only                            | Metadata dokumen sekali; meja closed yang sudah dilepas boleh tidak tersedia, jangan menebak.                                                                |
| Nama outlet/workspace                                                                                        | Read-only                            | Header receipt; pengecualian konteks cetak design-system 4.2, tidak jadi judul halaman kedua.                                                                |
| Order number, item snapshot, quantity, opsi/catatan yang berlaku                                             | Read-only                            | Grup per order dengan pemisah dan jarak, bukan kartu bersarang; tanpa salinan daftar order lain di dalam dokumen.                                            |
| Paid/unpaid pricing, tarif/included mode yang berbeda                                                        | Read-only/derived                    | Rincian order bila diperlukan untuk menjelaskan snapshot; total kunjungan satu area ringkasan. Jangan menampilkan satu tarif global palsu.                   |
| Pending order                                                                                                | Read-only                            | Satu area review dengan item/context, tanpa nominal terutang atau badge status berulang per item.                                                            |
| Total, due, paid/refunded/net paid                                                                           | Derived                              | Satu ringkasan finansial; omisi baris tak berlaku. Hindari baris angka sama dengan arti sama. Bill pending-only tidak menampilkan nol sebagai fakta tagihan. |
| Metode, reference, tender/change, cashier/waktu payment                                                      | Read-only                            | Satu grup per transaksi unik; reference/uang kembali hanya bila berlaku. Tidak diulang per order.                                                            |
| Refund unik dan order terkait                                                                                | Read-only                            | Satu area pengembalian; jangan merender jumlah refund yang sama lagi pada tiap payment. Reason/aktor audit bukan konteks wajib cetak.                        |
| Empty/pending/unpaid/partial/paid dan kind BILL/RECEIPT                                                      | Derived                              | Satu judul/status dokumen; unpaid/pending tidak diberi label lunas.                                                                                          |
| ID internal tenant/outlet/order/payment/sale/refund, actor ID, relation count, audit, kontak/customer, token | Hidden                               | Untuk konsistensi/key query saja; tidak menjadi field UI, nominal input, atau metadata cetak tambahan.                                                       |

### 7.3 Rencana layout B-03

Gunakan Sheet dan primitive Receipt yang sudah ada: gap bagian minimal 16 px, grup transaksi/order dengan divider dan ruang vertikal, label panjang membungkus tanpa menabrak nominal, kontrol POS 48 px. Satu judul pendek tanpa paragraf pengantar. Total kunjungan tidak diulang sebagai kartu metrik; detail payment hanya menampilkan informasi transaksi yang perlu, bukan salinan breakdown order. Saat dokumen dibuka, panel bawah bukan konten dokumen cetak. B-01 tidak mengubah layout/JSX dan belum membuktikan kualitas visual B-03.

### 7.4 Bukti/batas B-01

- **10 test domain baru**: cash shared sekali, non-cash/legacy, pending/canceled/zero-price, unpaid current rates dan paid snapshot lama, included/added campuran + discount/rounding, deduplikasi refund partial/full, sumber tidak dimutasi, precision USD/bigint, serta penolakan payment parsial/cross-visit, duplikat order/bill/sale, snapshot payment/refund bertentangan dan scope/currency/totals tak konsisten.
- **3 test contracts baru**: output strict tanpa escape hatch input/permission/total editable, integer besar/signed rounding, state/kind yang dikenal. Skema struktural bukan command atau pengganti invariant domain/otorisasi query.
- Root lint/boundary/warna, typecheck, test dan format lulus; **419 test sumber API + 48 contracts**, web/UI/worker ikut lulus. Build API produksi lulus. Log lokal `.cache/m4-visit-domain-*.log` (Git-ignored). Timeout 120 detik pada lint awal bukan bukti lulus; lint diulang dengan batas cukup dan lulus, kemudian lint final terpisah juga lulus.
- Tidak ada endpoint, persistence adapter, migrasi, dependency baru atau JSX; tidak membaca/mengubah database/bucket development. PostgreSQL/browser/print tidak dijalankan karena checkpoint hanya fungsi murni/kontrak, dan **belum membuktikan query atomic, UI, hasil cetak atau acceptance pengguna**. B-02/B-03 dan GAP-06 tetap terbuka.
