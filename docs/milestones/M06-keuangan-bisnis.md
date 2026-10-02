# M6 — Keuangan bisnis

**Status:** Belum mulai
**Tahap PRD:** G (Business Finance)
**Bergantung pada:** M2 (dapat dikerjakan sejajar dengan M3–M5)

## 1. Tujuan

Pemilik mencatat pemasukan, pengeluaran, dan transfer antarakun, melihat buku kas, merekonsiliasi saldo secara manual, dan melihat estimasi laba per outlet atau gabungan. Bila POS terhubung, penjualan dan pembayaran tercatat otomatis sesuai pemetaan akun **tanpa pendapatan dihitung dua kali**. Keuangan juga dapat dipakai sendiri tanpa POS.

## 2. Cakupan

**Termasuk:** Finance Core (akun, kategori, transaksi dan entri, pembalikan, lampiran); buku kas; rekonsiliasi manual; projection periode; binding POS → Keuangan dengan pemetaan akun; estimasi laba berlabel jelas.

**Tidak termasuk:** akuntansi formal dan jurnal umum, pajak formal, bank feed, budget (tier Pro), Personal Finance (setelah R1).

## 3. Kriteria selesai

- [ ] Finance-only mencatat transaksi tanpa referensi pesanan.
- [ ] Transaksi tidak dapat diedit setelah diposting; koreksi lewat transaksi pembalik dengan alasan.
- [ ] POS + Keuangan: satu penjualan menghasilkan tepat satu pengakuan pendapatan, terpisah dari pergerakan uang pembayaran (`OD-06`).
- [ ] Binding yang belum dipetakan berstatus "Perlu setup" dan tidak membuat transaksi.
- [ ] Rekonsiliasi menandai cocok atau pengecualian dengan catatan.
- [ ] HPP dan laba selalu berlabel "Estimasi operasional".

## 4. Task

### FT — Fitur produk

- [ ] **M6-FT-01 Akun dan kategori** — kas, bank, kliring; kategori pemasukan dan pengeluaran.
- [ ] **M6-FT-02 Catat pemasukan dan pengeluaran** — akun, kategori, nominal, tanggal, catatan, lampiran opsional.
- [ ] **M6-FT-03 Transfer antarakun.**
- [ ] **M6-FT-04 Buku kas** — filter akun, periode, sumber; transaksi dari POS bertanda sumber dan hanya-baca.
- [ ] **M6-FT-05 Pembalikan** — alasan wajib; transaksi asli tetap.
- [ ] **M6-FT-06 Rekonsiliasi manual** — tercatat vs seharusnya per akun dan periode.
- [ ] **M6-FT-07 Ringkasan periode** — pemasukan, pengeluaran, estimasi laba per outlet atau gabungan.
- [ ] **M6-FT-08 Setup binding POS** — petakan pendapatan, metode bayar ke akun, pajak, service charge, pembulatan.

### BE — Backend dan data

- [ ] **M6-BE-01 Tabel Finance Core** — schema B.7 dengan entri berimbang per transaksi.
- [ ] **M6-BE-02 Use case posting dan pembalikan.**
- [ ] **M6-BE-03 Projection periode** — dapat dibangun ulang.
- [ ] **M6-BE-04 Handler POS** — `sale.completed.v1`, `payment.recorded.v1`, `sale.refunded.v1`, `shift.closed.v1`; idempotent per sumber; mengikuti `OD-06`.
- [ ] **M6-BE-05 Lampiran** — memakai penyimpanan berkas M2.
- [ ] **M6-BE-06 Rekonsiliasi.**

### UX — Alur dan interaksi

- [ ] **M6-UX-01 Halaman Keuangan** — ringkasan, buku kas, rekonsiliasi, pengaturan akun.
- [ ] **M6-UX-02 Form cepat pengeluaran di HP** — dengan foto nota.
- [ ] **M6-UX-03 State binding** — "Perlu setup" mengarah ke pemetaan akun, bukan error.

### DS — Design system dan komponen

- [ ] **M6-DS-01 Rapikan komponen finance** — `FinanceBasicSummary`, `FinanceMetric`, `FinanceProfitEstimate`, `FinanceReconciliationSummary`, `FinanceValidatedReport`.
- [ ] **M6-DS-02 `LedgerRow` dan form transaksi** (design-system 21.2, P2).
- [ ] **M6-DS-03 Chart periode** — lewat wrapper ApexCharts dengan palet chart.

### AS — Aset

- [ ] **M6-AS-01 Ekspor CSV buku kas** — format kolom yang terdokumentasi.

### SC — Keamanan dan privasi

- [ ] **M6-SC-01 Izin per peran** — Finance Staff vs Owner; laba tidak dikirim ke POS.
- [ ] **M6-SC-02 Lampiran privat** — URL bertanda tangan berumur pendek.
- [ ] **M6-SC-03 Audit pembalikan dan rekonsiliasi.**

### QA — Kualitas kode dan test

- [ ] **M6-QA-01 Test tanpa pendapatan ganda** — event penjualan dan pembayaran ganda, refund, dan pembalikan.
- [ ] **M6-QA-02 Test entri berimbang.**
- [ ] **M6-QA-03 Test Finance-only.**

### OP — Operasional dan dokumentasi

- [ ] **M6-OP-01 Seed akun dan kategori bawaan per template.**
- [ ] **M6-OP-02 Perbarui dokumen** — `schema.md` B.7, `flowchart.md` 10, keputusan `OD-06` di `prd.md`.

## 5. Urutan checkpoint yang disarankan

1. Putuskan `OD-06`.
2. M6-BE-01, M6-BE-02, M6-QA-02, M6-FT-01, M6-OP-01.
3. M6-UX-01, M6-DS-01, M6-DS-02, M6-FT-02, M6-FT-03, M6-FT-04, M6-FT-05, M6-QA-03, M6-SC-03.
4. M6-BE-05, M6-SC-02, M6-UX-02.
5. M6-BE-03, M6-DS-03, M6-FT-07.
6. M6-FT-08, M6-UX-03, M6-BE-04, M6-QA-01, M6-SC-01.
7. M6-BE-06, M6-FT-06, M6-AS-01, M6-OP-02.

## 6. Referensi

`prd.md` 6.3–6.4, 13 · `flowchart.md` 10 · `schema.md` B.7 · `design-system-modules.md` 10 · `architecture.md` 7.2.
