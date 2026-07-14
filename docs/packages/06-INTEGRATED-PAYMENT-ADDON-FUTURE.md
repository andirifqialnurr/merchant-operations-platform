# Integrated Payment Add-on - Future

**Status:** Future draft; bukan bagian MVP  
**Ketergantungan eksternal:** Kerja sama dan persetujuan PJP/payment gateway  
**Target:** Merchant yang ingin QRIS dinamis dan konfirmasi otomatis

## 1. Tujuan add-on

Menghilangkan konfirmasi pembayaran manual pada POS dan QR Self-Order dengan membuat payment request yang dapat dipantau sistem.

Add-on tidak menjadikan platform sebagai penyimpan dana. Pemrosesan, onboarding, dan settlement dilakukan melalui PJP/payment gateway berizin sesuai kontrak.

## 2. Fitur yang direncanakan

- Merchant/sub-account onboarding dan KYC status.
- Payment provider configuration per tenant/outlet.
- Dynamic QRIS pada POS dan Self-Order.
- Automatic amount dan unique external reference.
- Webhook signature verification dan idempotency.
- Pending, paid, expired, failed, refund-pending, dan refunded.
- Polling/reconciliation fallback ketika webhook terlambat.
- Settlement dan payout report.
- Refund dan dispute workflow.
- Optional split platform fee jika didukung dan disetujui PJP.
- Manual payment tetap tersedia sebagai fallback.

## 3. Alur utama

```text
Order membuat bill
→ Platform meminta dynamic QRIS ke PJP
→ Customer membayar
→ PJP mengirim webhook
→ Payment otomatis PAID
→ Order dilepas/dilanjutkan sesuai kebijakan outlet
→ Settlement dan platform fee direkonsiliasi
```

## 4. Tidak termasuk

- Wallet atau penyimpanan saldo konsumen oleh platform.
- Pinjaman, paylater, atau produk finansial milik platform.
- Jaminan settlement di luar SLA PJP.
- Automatic use of existing static merchant QRIS tanpa dukungan acquirer.

## 5. Pricelist hipotesis

Harga berikut belum dapat dijadikan penawaran final sebelum proposal PJP tersedia.

| Komponen | Harga hipotesis |
|---|---:|
| Activation/onboarding support | Rp500.000/tenant |
| Add-on bulanan | Rp99.000/outlet/bulan |
| Platform fee | Rp700/successfully settled payment |
| Biaya PJP/MDR/payout/refund | Pass-through sesuai kontrak |
| Custom reconciliation/integration | Quotation |

Alternatif paket flat tanpa platform fee per transaksi dapat ditawarkan kepada merchant volume tinggi setelah unit economics tervalidasi.

## 6. Business rules yang harus diputuskan

- Pihak yang menanggung fee PJP dan pajak.
- Definisi successfully settled payment.
- Perlakuan platform fee pada full/partial refund.
- Cut-off, settlement, payout, dan reserve.
- Merchant name yang ditampilkan kepada customer.
- Penanganan dispute, fraud, chargeback, dan account suspension.
- Manual reconciliation dan fallback ketika provider down.
- Apakah order masuk dapur sebelum atau setelah paid.

## 7. Kriteria go-live

- Kontrak dan commercial terms PJP disetujui.
- Merchant onboarding/KYC berhasil pada environment produksi.
- Security review API key, webhook, data, dan access control selesai.
- Idempotency, duplicate webhook, timeout, retry, expiry, dan late webhook diuji.
- Refund dan reconciliation diuji end-to-end.
- Settlement report dapat direkonsiliasi dengan order dan platform fee.
- Terms, privacy, disclosure biaya, dan merchant agreement telah direview.
- Manual payment fallback tetap berfungsi.

## 8. Metric keberhasilan

- Payment success rate.
- Median payment confirmation time.
- Webhook delay/failure rate.
- Reconciliation mismatch.
- Refund completion time.
- Platform revenue per settled payment.
- Merchant adoption dan retention.
