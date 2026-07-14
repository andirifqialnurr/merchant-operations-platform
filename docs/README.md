# Dokumentasi Produk Platform Operasional Kafe

Dokumentasi ini memisahkan tiga hal yang berbeda:

1. **Ruang lingkup global produk**: arah aplikasi jika terus dikembangkan.
2. **Versi produk**: fitur yang benar-benar dibangun pada suatu release.
3. **Paket komersial**: subset modul yang diaktifkan untuk merchant sesuai langganan.

## Dokumen utama

- [Global Product Scope](./00-GLOBAL-PRODUCT-SCOPE.md)
- [PRD MVP Release 1](./versions/01-MVP-RELEASE-1.md)

## Paket komersial

- [Profile](./packages/01-PROFILE.md)
- [POS Basic](./packages/02-POS-BASIC.md)
- [Cafe Digital](./packages/03-CAFE-DIGITAL.md)
- [Cafe Operations](./packages/04-CAFE-OPERATIONS.md)
- [Custom Modular](./packages/05-CUSTOM-MODULAR.md)
- [Integrated Payment Add-on - Future](./packages/06-INTEGRATED-PAYMENT-ADDON-FUTURE.md)

## Status harga

Seluruh harga dalam dokumen paket adalah **hipotesis komersial per 14 Juli 2026**. Harga harus divalidasi melalui wawancara dan pilot pada 2-3 merchant sebelum ditetapkan sebagai harga publik.

Harga belum termasuk:

- PPN atau pajak lain yang berlaku.
- Perangkat kasir, tablet, KDS, printer, cash drawer, dan jaringan.
- Biaya instalasi perangkat di luar onboarding standar.
- Biaya payment gateway, MDR QRIS, payout, refund, atau biaya PJP.
- Pekerjaan custom dan migrasi data kompleks.

## Keputusan produk saat ini

- Pembayaran MVP masih manual: tunai, QRIS merchant, transfer, dan EDC merchant.
- Aplikasi mencatat pembayaran setelah dikonfirmasi kasir, tetapi tidak memproses dana.
- Inventory Basic dan Finance Basic termasuk dalam MVP Release 1.
- Integrated Payment dipersiapkan sebagai add-on masa depan melalui PJP/payment gateway berizin.
- Arsitektur produk ditujukan untuk multi-tenant dan multi-outlet.
