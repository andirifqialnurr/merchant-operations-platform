# Paket Custom Modular

**Status:** Hipotesis paket awal  
**Target:** Merchant yang membutuhkan kombinasi modul di luar paket standar

## 1. Tujuan paket

Memungkinkan merchant mengaktifkan modul tertentu tanpa membuat deployment atau aplikasi terpisah. Paket standar tetap direkomendasikan karena lebih mudah dijual, dipahami, dan didukung.

## 2. Core yang selalu wajib

Setiap tenant Custom Modular tetap memperoleh:

- Tenant, satu brand, dan satu outlet.
- Owner/Admin, role dasar, dan audit.
- Product/menu master.
- Subscription dan entitlement.
- Basic platform support.

Core tidak menyediakan transaksi sampai POS atau Digital Cafe diaktifkan.

## 3. Modul yang dapat dipilih

| Modul | Scope harga | Harga hipotesis |
|---|---|---:|
| Core Platform | Tenant/bulan | Rp149.000 |
| Cafe Profile | Brand/bulan | Rp75.000 |
| POS | Outlet/bulan | Rp175.000 |
| Table Layout + QR Self-Order | Outlet/bulan | Rp125.000 |
| KDS | Device/station/bulan | Rp75.000 |
| Inventory Basic | Outlet/bulan | Rp125.000 |
| Finance Basic | Tenant/bulan | Rp100.000 |
| Customer Basic | Tenant/bulan | Rp75.000 |
| POS device tambahan | Device/bulan | Rp50.000 |

Harga paket bundle dapat lebih murah daripada total modul satu per satu.

## 4. Dependency rules

- POS memerlukan Core dan Product/Menu.
- Self-Order memerlukan Cafe Profile, Order Management, serta Table Layout/Management.
- Table Layout mencakup lantai, posisi meja snap-to-grid, bentuk/ukuran sederhana, status POS, dan QR mapping; bukan editor denah bangunan.
- KDS memerlukan POS atau Self-Order sebagai sumber order.
- Inventory memerlukan Product/Menu; automatic consumption memerlukan Order Management.
- Finance memerlukan Payment/Sales data; HPP memerlukan Inventory dan Recipe.
- Customer Basic memerlukan transaksi untuk menghasilkan histori.
- Integrated Payment nantinya memerlukan POS atau Self-Order.

Konfigurasi yang tidak memenuhi dependency harus ditolak oleh sistem dan tim sales.

## 5. Contoh konfigurasi

### Profile dan menu saja

```text
Core Platform       Rp149.000
Cafe Profile         Rp75.000
Total               Rp224.000/bulan
```

Merchant kecil sebaiknya diarahkan ke Paket Profile Rp99.000 karena lebih ekonomis.

### POS dan Inventory tanpa QR order

```text
Core Platform       Rp149.000
POS                 Rp175.000
Inventory Basic     Rp125.000
Total               Rp449.000/outlet/bulan
```

### Self-Order dan KDS tanpa POS penuh

```text
Core Platform             Rp149.000
Cafe Profile               Rp75.000
Table Layout/Self-Order   Rp125.000
KDS                        Rp75.000
Total                     Rp424.000/outlet/bulan
```

## 6. Onboarding

| Konfigurasi | Harga onboarding minimum |
|---|---:|
| Core + satu modul | Rp500.000 |
| Dua-tiga modul operasional | Rp1.000.000 |
| Empat modul atau lebih | Rp1.500.000 |
| Migrasi/data/custom workflow | Quotation |

Onboarding final mengikuti jumlah outlet, produk, recipe, lantai, meja, table layout, perangkat, dan kompleksitas migrasi.

## 7. Business rules komersial

- Minimum subscription satu bulan.
- Annual billing memperoleh nilai dua bulan subscription tanpa biaya, kecuali quotation menyatakan lain.
- Downgrade tidak menghapus data; data modul dibuat read-only sesuai retention policy.
- Export diberikan sebelum penghapusan data sesuai kebijakan kontrak.
- Custom development tidak otomatis menjadi bagian paket standar.
- Perubahan dependency dapat memengaruhi harga dan harus diberitahukan.

## 8. Risiko paket

- Pilihan terlalu banyak dapat membingungkan merchant.
- Kombinasi langka meningkatkan biaya support dan testing.
- Modul murah dapat dipakai menghindari bundle walaupun kebutuhannya setara.

Karena itu, Custom Modular sebaiknya ditawarkan setelah discovery oleh sales, bukan menjadi pilihan utama pada halaman harga.

## 9. Acceptance criteria

- Entitlement diperiksa frontend dan backend.
- Dependency invalid tidak dapat diaktifkan.
- Upgrade tidak memerlukan migrasi data ulang.
- Downgrade tidak merusak histori transaksi.
- Invoice menjelaskan modul, scope, outlet, dan perangkat.
