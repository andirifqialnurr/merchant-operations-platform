# Paket Profile

**Status:** Hipotesis paket awal  
**Target:** Kafe/UMKM yang membutuhkan profil dan katalog digital tanpa POS

## 1. Tujuan paket

Memberikan halaman publik yang dapat dibagikan melalui link atau QR agar pelanggan melihat identitas bisnis, outlet, jam operasional, dan menu.

## 2. Fitur yang termasuk

- Satu tenant dan satu brand.
- Profil brand: nama, logo, banner, deskripsi, kontak, dan media sosial.
- Profil outlet: alamat, Maps link, jam operasional, dan status buka/tutup.
- Kategori dan menu publik.
- Foto, deskripsi, harga, varian, dan modifier sebagai informasi.
- Status tersedia/habis manual.
- QR menuju profil/menu.
- Basic visitor/menu-view summary jika pengukuran tersedia.
- Platform-hosted URL.
- User Owner dan Admin dasar.

## 3. Tidak termasuk

- POS dan transaksi kasir.
- Keranjang dan pemesanan.
- Table QR/Self-Order.
- KDS.
- Payment.
- Inventory dan Finance.
- Customer CRM.
- Custom domain dan white-label penuh.

## 4. Alur utama

```text
Platform membuat tenant
→ Owner mengisi profil dan outlet
→ Owner mengisi menu
→ Sistem menghasilkan link/QR
→ Pelanggan melihat profil dan menu
```

## 5. Persyaratan fungsional

- Owner dapat mengubah profil tanpa bantuan platform.
- Outlet yang tutup tetap dapat menampilkan menu dengan status tutup.
- Menu nonaktif tidak muncul pada halaman publik.
- Data tenant lain tidak dapat diakses melalui URL atau API.
- Upgrade paket tidak memerlukan input ulang brand, outlet, atau menu.

## 6. Pricelist hipotesis

| Komponen | Harga |
|---|---:|
| Subscription bulanan | Rp99.000/brand/bulan |
| Subscription tahunan | Rp990.000/brand/tahun |
| Onboarding standar | Rp350.000/brand |
| Outlet tambahan setelah outlet pertama | Rp49.000/outlet/bulan |
| Migrasi menu di atas batas onboarding | Quotation |
| Custom domain/white-label | Belum tersedia |

Onboarding standar mencakup satu brand, satu outlet, bantuan input maksimal 30 produk, dan satu sesi pelatihan remote.

## 7. Batas pemakaian awal

- Satu brand.
- Satu outlet termasuk; outlet tambahan berbayar.
- Maksimal 3 user backoffice.
- Bantuan input 30 produk saat onboarding; produk yang diinput sendiri tidak dibatasi secara komersial pada pilot.

## 8. Upgrade path

- Profile → POS Basic jika merchant membutuhkan kasir.
- Profile → Cafe Digital jika merchant membutuhkan QR Self-Order.
- Seluruh brand, outlet, dan menu digunakan kembali.

## 9. Metric keberhasilan

- Profil selesai dipublikasikan.
- Merchant memperbarui menu tanpa bantuan support.
- Kunjungan halaman/menu.
- Konversi upgrade ke POS atau Cafe Digital.

