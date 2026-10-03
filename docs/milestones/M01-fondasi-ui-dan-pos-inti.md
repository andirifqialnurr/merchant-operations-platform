# M1 — Fondasi UI dan POS inti

**Status:** Berjalan
**Tahap PRD:** A (Fondasi UI) dan C (Catalog + POS)
**Bergantung pada:** —

## 1. Tujuan

Membuktikan bahwa satu modul berjalan utuh dari ujung ke ujung dengan UI baru. Owner mengelola katalog di Backoffice. Kasir membuka shift, menjual, menerima pembayaran manual, mencetak struk, melayani refund, lalu menutup shift dengan kas yang cocok. Semua ini berjalan dengan tema Calm Neutral, dua bahasa, terang/gelap, dan di HP, tablet, serta desktop.

Milestone ini juga menutup sisa fondasi UI yang dibutuhkan semua milestone berikutnya.

## 2. Cakupan

**Termasuk:** fondasi design system dan komponen dasar; shell Backoffice dan POS; i18n; Catalog Backoffice; POS Basic (shift, menu jual, pesanan bawa pulang, pembayaran tunai/QRIS/transfer/EDC manual, struk, refund sederhana, daftar pesanan, tahan pesanan, catatan item).

**Tidak termasuk (ada di milestone lain):** makan di tempat dan meja (M4); tiket dapur (M3); stok berkurang dari penjualan (M5); pencatatan keuangan otomatis (M6); gambar produk dan unggah berkas (M2); registrasi perangkat POS (M2); halaman Pengaturan (M2).

## 3. Kriteria selesai

- [x] Catalog Backoffice memakai AppShell dan aturan halaman baru di S/M/L, terang/gelap, `id`/`en`.
- [~] POS-only menyelesaikan siklus penuh: buka shift → jual → bayar (tunai, QRIS, transfer, EDC) → struk → refund → tutup shift dengan kas seharusnya yang benar.
- [~] Pesanan dapat ditahan, dibayar nanti, dan dibatalkan dengan alasan; tidak ada pesanan yang bisa dibayar dua kali atau dibatalkan setelah dibayar.
- [ ] Tidak ada teks tertanam di surface yang dipakai M1 (Backoffice Catalog, POS, login) maupun di komponen `packages/ui` yang dipakainya.
- [ ] Pengguna meninjau Storybook dan alur POS di browser pada terang dan gelap, lalu menyetujui.

## 4. Task

### FT — Fitur produk

- [x] **M1-FT-01 Shift kas** — buka shift dengan kas awal, kas masuk/keluar beralasan, tutup shift dengan kas fisik dan alasan selisih. `34b484c`, `432f10b`
- [x] **M1-FT-02 Menu jual** — produk, varian, dan modifier yang benar-benar bisa dijual di outlet beserta harga outlet. `b72ed41`
- [x] **M1-FT-03 Pesanan bawa pulang** — harga dihitung server dari menu, disimpan sebagai snapshot, nomor berurutan per outlet. `9e8242a`
- [x] **M1-FT-04 Pembayaran tunai dan QRIS manual** — bayar penuh dalam shift terbuka, kembalian dihitung server, penjualan tunai masuk kas seharusnya. `76e0a57`
- [x] **M1-FT-05 Layar jual** — kategori, produk, pilihan varian/tambahan, keranjang, pembayaran, layar lunas. `293e37c`
- [x] **M1-FT-06 Daftar pesanan dan batal** — pesanan 24 jam terakhir, bayar nanti, batal dengan alasan. `e68e655`, `a1932b6`
- [x] **M1-FT-07 Struk** `928e049` — tampilan struk setelah lunas dan dari daftar pesanan, bisa dicetak dari browser (cetak ulang ditandai "salinan"). Selesai bila: struk memuat nama outlet, nomor penjualan, waktu, baris item, total, metode, uang diterima, dan kembalian; tidak memuat ID internal.
- [x] **M1-FT-08 Transfer dan EDC manual** `f8a2922` — dua metode tambahan dengan nomor referensi opsional, tercatat terpisah dari tunai. Selesai bila: tidak menambah kas seharusnya; muncul di ringkasan shift per metode.
- [x] **M1-FT-09 Refund sederhana** `241efa6` — refund penuh atau sebagian atas penjualan dengan alasan wajib, izin `payment.refund`; penjualan asli tetap ada. Selesai bila: refund tunai mengurangi kas seharusnya shift yang sedang terbuka; refund melebihi sisa ditolak; event `sale.refunded.v1`.
- [ ] **M1-FT-10 Persetujuan manager untuk refund** — kasir tanpa izin refund meminta persetujuan manager dengan PIN (flowchart 5.4). Selesai bila: PIN tersimpan ber-hash; persetujuan diaudit dengan nama penyetuju. Boleh dipindah ke M2 bila PIN butuh pengaturan pengguna.
- [x] **M1-FT-11 Catatan per item** `d5a3561` — catatan bebas pada baris keranjang, ikut ke snapshot pesanan.
- [x] **M1-FT-12 Tahan pesanan** `9cba9c0` — simpan keranjang dengan label sebagai keranjang tertahan (lihat M1-BE-07), lanjutkan atau buang dari daftar. Selesai bila: pesanan yang ditahan tidak bernomor penjualan dan tidak memengaruhi kas.
- [x] **M1-FT-13 Ringkasan shift tertutup** `ee5b054` — ringkasan per metode bayar (tunai, QRIS, transfer, EDC), refund, kas masuk/keluar, dan selisih; bisa dicetak. Selisih hanya untuk yang berizin.
- [ ] **M1-FT-14 Pengaturan pajak dan service charge per outlet** — pola "harga sudah termasuk" atau "ditambahkan di struk", tarif per outlet. Menunggu keputusan `M1-OD-01`; sampai diputuskan total = subtotal.

### BE — Backend dan data

- [x] **M1-BE-01 Tabel shift dan kas** — `pos_register_sessions`, `pos_cash_movements`. `34b484c`
- [x] **M1-BE-02 Kernel order intake** — `order_orders`, item, modifier, counter nomor. `9e8242a`
- [x] **M1-BE-03 Kernel billing** — bill, payment, alokasi, sale, counter nomor penjualan; penguncian baris shift antara bayar, kas, dan tutup shift. `76e0a57`
- [x] **M1-BE-04 Batal pesanan** — kolom pembatalan, penguncian baris pesanan antara batal dan bayar. `e68e655`
- [x] **M1-BE-05 Refund** `241efa6` — tabel `sales_refunds` dan alokasi refund ke pembayaran; status penjualan `PARTIALLY_REFUNDED`/`REFUNDED`; kas seharusnya shift dikurangi refund tunai di bawah kunci shift yang sama.
- [x] **M1-BE-06 Metode transfer dan EDC** `f8a2922` — perluas `payOrderSchema`; ringkasan shift per metode dari billing.
- [x] **M1-BE-07 Keranjang tertahan** `9cba9c0` — diwujudkan sebagai `pos_held_carts` (bukan pesanan `DRAFT`): hanya pilihan dan label, tanpa nomor dan harga; nomor pesanan diberikan saat dibayar seperti biasa.
- [x] **M1-BE-08 Data struk** `928e049` — endpoint baca struk per penjualan (snapshot, tanpa ID internal selain nomor).
- [x] **M1-BE-09 Preferensi pengguna** `766dca2` — kolom `users.locale` dan `users.theme` (schema B.1); endpoint ubah preferensi; bahasa tersimpan menang atas bahasa browser (D-09).
- [ ] **M1-BE-10 Pesan error katalog berbahasa netral** — ganti pesan server Indonesia di modul catalog dengan pesan Inggris + kode stabil, terjemahan di kamus web (`SEC-F6`).

### UX — Alur dan interaksi

- [x] **M1-UX-01 Shell Backoffice dan guard sesi** — AppShell, ContextSwitcher, UserMenu, rute `(auth)`/`(backoffice)`. `6c87c75`, `8754d5c`
- [x] **M1-UX-02 Dua bahasa** — next-intl berbasis cookie, bawaan dari browser. `928b619`
- [x] **M1-UX-03 Shell kasir** — rute `(pos)`, bar atas 56px, navigasi Jual/Pesanan/Shift. `432f10b`, `a1932b6`
- [ ] **M1-UX-04 Status shift dan koneksi di bar atas POS** — indikator shift terbuka dan offline (flowchart 15); tanpa mengulang data yang sudah ada di halaman.
- [ ] **M1-UX-05 Uji browser Catalog lengkap** — tambah produk, kategori, modifier, varian, assignment outlet, dan pengguna outlet-scoped; semua dengan dua bahasa dan dua tema.
- [x] **M1-UX-06 Bahasa dan tema tersimpan di profil** `766dca2` — UserMenu menyimpan ke `users.locale`/`users.theme` (setelah M1-BE-09).
- [ ] **M1-UX-07 Halaman dev keluar dari rute aplikasi** — `/foundation`, `/design-system`, `/color-bank`, `/typography`, dan placeholder `/kds`, `/inventory` dipindah ke grup dev yang tidak ikut build produksi, atau dihapus bila sudah tercakup Storybook.

### DS — Design system dan komponen

- [x] **M1-DS-01 Bank warna Calm Neutral** — token primitif dan semantik, guardrail warna. `8bde1f3`
- [x] **M1-DS-02 Komponen dasar 1–11** — Button sampai DataTable/Panel/Chart dibenahi satu per satu. `e218d59` … `3efa190`, `0ef2ed7`
- [x] **M1-DS-03 Ikon Tabler lewat AppIcon** — larangan impor `lucide-react`. `03cc2eb`
- [x] **M1-DS-04 Label kartu produk dan rel kategori lewat props.** `1b3a7fc`, `a3c3645`
- [x] **M1-DS-05 Hapus bawaan Bahasa Indonesia di komponen 4–9** `696bdff` — semua label menjadi props wajib; perbarui story dan test.
- [x] **M1-DS-06 Komponen POS lama** `2c07647` — putuskan nasib `ProductModifierPicker`, `CartItem`, `CartSummary`, `PaymentMethodTile`, `CashKeypad`, `PaymentConfirmationPanel`: dirapikan (label lewat props, tanpa deskripsi) atau dihapus beserta story. Layar pelanggan (M4) memakai hasilnya.
- [x] **M1-DS-07 `Receipt`** `928e049` — komponen struk layar dan cetak (design-system 21.2, P1).
- [ ] **M1-DS-08 `HeldOrderList` dan `PinInput`** — untuk tahan pesanan dan persetujuan manager.
- [ ] **M1-DS-09 `MultiSelect`** — hanya bila filter Catalog membutuhkannya; bila tidak, pindahkan ke milestone yang pertama memakainya.
- [x] **M1-DS-10 Penyesuaian 21.3** — hapus status `special`; tinggi kontrol `md` 36px; pastikan tidak ada kartu bersarang di komponen domain.
- [ ] **M1-DS-11 Gate review Storybook** — pengguna meninjau komponen 1–11 dan komponen POS pada terang dan gelap.

### AS — Aset

- [ ] **M1-AS-01 Logo dan wordmark** — tanda produk sederhana monokrom untuk login, sidebar, dan kepala struk; versi terang dan gelap; SVG.
- [ ] **M1-AS-02 Ikon aplikasi** — favicon, ikon PWA 192/512 dan maskable, `apple-touch-icon`; `manifest.ts` memakai nama dan warna dari token.
- [x] **M1-AS-03 Gaya cetak struk** `928e049` — stylesheet cetak untuk kertas 58 mm dan 80 mm serta A4; tanpa elemen navigasi.

### SC — Keamanan dan privasi

- [x] **M1-SC-01 Header CSRF di klien web.** `e2b007d`
- [x] **M1-SC-02 Idempotency di mutasi POS** — shift, kas, pesanan, pembayaran. `34b484c` … `76e0a57`
- [ ] **M1-SC-03 Data guard POS** — pastikan respons POS tidak memuat HPP, laba, atau data pelanggan yang tidak perlu (`security.md` 10.1).
- [ ] **M1-SC-04 Izin refund dan batal** — test bahwa kasir tanpa `payment.refund`/`order.cancel` ditolak API dan tombolnya tidak tampil.
- [ ] **M1-SC-05 Akun lokal per peran** — buat akun pengembangan Manager dan Cashier outlet-scoped (dicatat di `CREDENTIALS.local.md`) untuk menguji izin dan cakupan lokasi.

### QA — Kualitas kode dan test

- [x] **M1-QA-01 Modul POS dengan struktur target** — `modules/pos-sales` dan `kernels/*` berisi domain/application/adapters.
- [ ] **M1-QA-02 Test browser otomatis untuk POS** — skrip Playwright di repo (bukan scratch) untuk alur buka shift → jual → bayar → tutup shift, dijalankan terhadap database lokal.
- [ ] **M1-QA-03 Test komponen web** — test unit untuk logika `features/pos` (keranjang sudah ada) dan helper format.

### OP — Operasional dan dokumentasi

- [x] **M1-OP-01 Seed menu kafe** — `pnpm db:seed:menu`. `2b7095d`
- [x] **M1-OP-02 Folder milestone** — dokumen ini.
- [ ] **M1-OP-03 Rapikan `TODO.md`** — item lama yang sudah tidak relevan (gate UI Foundation lama, catatan typecheck `.next`) ditutup atau dipindah ke milestone.
- [ ] **M1-OP-04 Perbarui `prd.md` 11.1 dan `docs/README.md`** — posisi implementasi terbaru.

## 5. Urutan checkpoint yang disarankan

1. M1-BE-08 + M1-DS-07 + M1-AS-03 + M1-FT-07 — struk.
2. M1-BE-06 + M1-FT-08 — transfer dan EDC.
3. M1-BE-05 + M1-FT-09 + M1-SC-04 — refund.
4. M1-FT-13 — ringkasan shift tertutup.
5. M1-BE-07 + M1-DS-08 + M1-FT-11 + M1-FT-12 — catatan item dan tahan pesanan.
6. M1-BE-09 + M1-UX-06 — preferensi pengguna.
7. M1-DS-05, M1-DS-06, M1-DS-10 — pembersihan komponen.
8. M1-AS-01, M1-AS-02 — logo dan ikon aplikasi.
9. M1-UX-04, M1-UX-05, M1-UX-07, M1-SC-03, M1-SC-05, M1-QA-02, M1-QA-03, M1-BE-10.
10. M1-OP-03, M1-OP-04, lalu review pengguna (M1-DS-11).

M1-FT-10 dan M1-FT-14 menunggu keputusan; keduanya boleh dipindah ke M2 tanpa menghambat penutupan M1.

## 6. Referensi

`prd.md` 6.3 dan 11.2 · `flowchart.md` 5 · `design-system.md` 4, 19.2, 21 · `schema.md` B.3 · `security.md` 9–10 · `TODO.md` Tahap 12.
