# M4 — bill dan struk kunjungan (GAP-06)

**Status:** GAP06A selesai teknis lokal setelah `920cbc4`; verifikasi akhir dan commit/push dicatat pada bagian 6. GAP06B tetap terbuka. Bukan penerimaan pengguna/M4.

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

- Repository memproyeksikan allocation positif aktual dan kardinalitas; domain menolak bentuk R1 tak representable. DTO staff/OpenAPI menambah field read-only, bukan command. Refund/shift/claim dan snapshot payment asli tidak diubah. Test double kas diperbaiki agar menghitung payment unik seperti repository nyata, bukan menggandakan payment per checkout.
- Root unit **409** test sumber API + test skrip, **45** contracts, serta web/UI/worker lulus. Precision di atas safe integer, USD cents, single/shared, penolakan nol/invariant, dan tidak adanya allocation pada command diverifikasi.
- Seluruh **29** test integrasi PostgreSQL lulus; **7** di file `receipt-allocation.integration.test.mjs` (parent + enam subtest) memeriksa cash/non-cash, IDR/USD, partial/full refund, snapshot payment asli, ledger/audit/outbox tidak berubah saat read, kas dihitung sekali, scope/izin dan fail-closed fault injection. Tidak memakai data development.
- **4** browser receipt disposable lulus, **22** capture: 12 kombinasi 320/768/1440 × light/dark × id/en, print media 58/80/A4, single cash, transfer/reference, USD, refund dari request terpisah, paused/offline, cached-error/retry serta allocation 409 tanpa Print. Native Print distub; media print diverifikasi, bukan printer/driver fisik atau jaminan ukuran kertas perangkat. Tidak ada overflow dokumen/receipt pada capture.
- Sembilan sampel screenshot dibaca: 320 dark/en, 768 dark/id, 1440 light/id, USD 320 dark/en, print 58mm, refund, offline/paused, transient error dan allocation invalid. Pemeriksaan duplicate fact/conditional visibility tidak menambahkan field, input nominal turunan, atau nested card. Ini bukan penerimaan visual pengguna.
- Regresi browser moderasi **16** dan gambar tamu **3** lulus. Root lint/boundary/warna/typecheck/test/format, build produksi API/web lulus; import generated route pada `next-env.d.ts` dikembalikan ke path development normal setelah build/fixtures.
- Log lokal di `.cache/m4-receipt-*.log`; capture di `apps/web/test-results/receipts` (Git-ignored). Reproduksi browser: `pnpm --filter @merchant/web test:e2e:receipts`; integrasi dari `apps/api`: `node --env-file=../../.env --import tsx --test --test-concurrency=1 test/*.integration.test.mjs`.

**Batas:** tidak ada migrasi/dependency baru, perubahan database/bucket development, deploy atau persetujuan M3/M4. Tidak ada benchmark beban atau uji printer fisik. **GAP06B — bill/struk satu kunjungan — belum diimplementasikan**, sehingga GAP-06/FLOOR-005 tetap terbuka. Migrasi moderasi sebelumnya tetap memerlukan proses deployment yang diotorisasi sebelum backend baru dipakai dengan schema development lama.
