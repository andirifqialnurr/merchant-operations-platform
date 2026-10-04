# PRD — Cafe Companion Pro

**Status:** Ringkasan produk terkonsolidasi
**Tanggal:** 2 Oktober 2026
**Bahasa dokumen:** Indonesia

Dokumen ini adalah pintu masuk untuk memahami cakupan produk. Ia merangkum tiga dokumen rinci dan mencatat keputusan baru tanggal 2 Oktober 2026.

| Butuh | Baca |
|---|---|
| Gambaran cakupan, peran, modul, rilis | Dokumen ini |
| Requirement bernomor (`POS-001`, `FLOOR-012`, …) dan acceptance criteria | [`CAFE-COMPANION-PRD-V2-MODULAR-PLATFORM.md`](./CAFE-COMPANION-PRD-V2-MODULAR-PLATFORM.md) |
| Kunci capability per tier | [`CAFE-COMPANION-MODULE-TIERS-V1.md`](./CAFE-COMPANION-MODULE-TIERS-V1.md) |
| Angka limit paket dan add-on | [`CAFE-COMPANION-PACKAGES-LIMITS-V1.md`](./CAFE-COMPANION-PACKAGES-LIMITS-V1.md) |

Bila ringkasan di sini berbeda dari dokumen rinci, dokumen rinci berlaku — kecuali untuk keputusan di bagian 2, yang menggantikan isi lama.

---

## 1. Produk dalam satu paragraf

Cafe Companion Pro adalah platform operasional modular untuk usaha, dengan fokus awal kafe dan UMKM makanan-minuman. Pelanggan dapat membeli satu modul, beberapa modul yang saling terhubung, atau paket siap pakai, dan menambah atau melepas modul tanpa berganti aplikasi. Semua modul berjalan di satu backend dan satu database; data tiap pelanggan terisolasi.

## 2. Keputusan baru (2 Oktober 2026)

| ID | Keputusan | Menggantikan |
|---|---|---|
| D-01 | Tema visual **Calm Neutral**: monokrom abu netral dan tinta, tanpa warna aksen; warna hanya untuk status dan chart | Warm Operational (cream, espresso, amber) pada PRD V2 bagian 33.1 |
| D-02 | Font **Geist Sans** (sudah terpasang); Geist Mono terbatas | DM Sans + Fraunces |
| D-03 | Ikon **Tabler Icons** melalui satu wrapper | Lucide |
| D-04 | Chart **ApexCharts** melalui wrapper | — (ditegaskan) |
| D-05 | UI tersedia dalam **Bahasa Indonesia dan Inggris**; pengguna dapat mengganti | Indonesia saja (PRD V2 bagian 35.6) |
| D-06 | Mode **terang, gelap, dan system** wajib pada semua surface | — (ditegaskan) |
| D-07 | Aturan halaman minimalis: judul tanpa deskripsi, satu aksi utama, satu fakta satu lokasi | — (baru) |
| D-08 | UI di-*reslice* dari kondisi kode saat ini; tech stack tidak diganti | — |
| D-09 | Bahasa bawaan mengikuti bahasa browser; pilihan pengguna yang tersimpan tetap diutamakan | — |
| D-10 | Hosting produksi: VPS milik sendiri dengan Docker dan Nginx sebagai reverse proxy; dikerjakan paling akhir | — |

Rincian D-01 sampai D-07 dan D-09 ada di [`../foundation/design-system.md`](../foundation/design-system.md).

---

## 3. Masalah dan sasaran

### 3.1 Masalah yang diselesaikan

- Usaha kecil dipaksa membeli sistem lengkap padahal hanya butuh kasir, atau hanya butuh absensi.
- Sistem yang "modular" di atas kertas sering terkunci di belakang: modul tidak dapat dipakai sendiri, atau penambahan modul butuh migrasi khusus pelanggan.
- Aplikasi operasional sering ramai: data berulang, penjelasan panjang, dan terlalu banyak tombol.

### 3.2 Sasaran Release 1

1. Core Platform yang aman untuk semua jenis langganan.
2. Katalog modul dan entitlement yang konsisten.
3. Versi Basic dari modul prioritas.
4. Bukti bahwa modul berjalan mandiri **dan** terintegrasi dengan logika yang sama.
5. Platform Admin untuk paket, langganan, override, limit, dan status integrasi.
6. Pengalaman F&B yang sederhana, tidak terasa seperti ERP besar.
7. Fondasi database dan API yang siap untuk mobile HC dan Personal Finance tanpa bongkar ulang.
8. UI minimalis, dua bahasa, dua mode tema, dapat dipakai di HP, tablet, dan desktop.

### 3.3 Bukan sasaran Release 1

Microservices; message broker eksternal; database per modul atau per pelanggan; aplikasi mobile native; sinkronisasi offline penuh; pembayaran atau mutasi stok offline; payroll; akuntansi formal; bank feed; dompet atau saldo konsumen; pembayaran terintegrasi sebelum ada mitra berizin dan review legal; inventory lanjutan (batch, kedaluwarsa, central kitchen); pelacakan GPS karyawan terus-menerus; biometrik.

---

## 4. Pengguna dan peran

### 4.1 Peran platform

| Peran | Tujuan |
|---|---|
| Platform Owner | Mengelola platform, paket, kebijakan penagihan, akses admin |
| Platform Admin | Mengelola workspace, langganan, modul, limit, dukungan |
| Platform Support | Membantu pelanggan dengan akses beralasan, berbatas waktu, dan diaudit |

### 4.2 Peran workspace

| Peran | Cakupan umum | Surface utama |
|---|---|---|
| Owner | Semua modul yang dibeli dan konfigurasi workspace | Backoffice |
| Manager | Operasi lokasi yang ditugaskan dan persetujuan tertentu | Backoffice, POS |
| Cashier | Pesanan, pembayaran manual, shift kas | POS |
| Kitchen | Antrean dan status produksi | KDS |
| Waiter | Meja, pesanan, permintaan pelanggan | POS |
| Inventory Staff | Stok, penerimaan, penyesuaian | Backoffice |
| Finance Staff | Pemasukan, pengeluaran, rekonsiliasi, laporan | Backoffice |
| HR Admin | Karyawan, jadwal, absensi, cuti | Backoffice |
| Employee | Layanan mandiri HC | Backoffice (web) |
| Tamu | Melihat menu, memesan, melihat status | Customer |

`User` (identitas login) dan `Employee` (data kepegawaian) adalah entitas berbeda. Karyawan dapat ada tanpa akun login.

---

## 5. Model organisasi

```text
Platform
└── Workspace            (batas data dan langganan)
    ├── Business Unit    (brand / perusahaan)
    │   └── Location     (outlet / cabang)
    ├── Membership
    ├── Subscription
    ├── Module Installation
    └── Integration Binding
```

| Internal | Label kafe | Label HC-only |
|---|---|---|
| Workspace | Bisnis | Perusahaan |
| Business Unit | Brand | Unit |
| Location | Outlet | Cabang |

Jenis workspace: `BUSINESS` (R1) dan `PERSONAL` (fondasi sekarang, UI nanti). Business template (Cafe, Restaurant, Bakery/Retail, Cloud Kitchen, HC Only, Finance Only, Personal) hanya mengubah label, navigasi bawaan, dan onboarding — tidak mengubah skema atau aturan keamanan.

### 5.1 Mata uang dasar bisnis (rencana M2)

Tambahan permintaan user 4 Oktober 2026: satu bisnis dapat memilih **IDR atau USD (dolar AS)**, berlaku untuk seluruh outlet dan terpisah dari pilihan bahasa. Perubahan hanya tersedia sebelum ada data bernilai uang; setelah itu mata uang baca-saja dengan alasan, sementara nama bisnis tetap dapat diedit. Histori dan nominal lama tidak dikonversi atau diganti label. USD mendukung sen; skala IDR lama dipertahankan. Requirement rinci: PRD Modular 6.5 (`CUR-001`–`CUR-005`); alur: `flowchart.md` 12.1; implementasi: `M2-FT-10`. Status saat ini masih rencana, bukan fitur yang sudah tersedia.

---

## 6. Modul

### 6.1 Core Platform (selalu aktif, tidak dijual terpisah)

Login dan sesi; workspace dan keanggotaan; peran dan izin berbatas lokasi; langganan, entitlement, instalasi, limit, dan pemakaian; registri perangkat; audit; idempotency; event bus dengan outbox/inbox; integration binding; feature flag.

### 6.2 Kernel internal (otomatis, tidak tampil sebagai menu)

Catalog Kernel, Order Intake Kernel, Bill & Payment Ledger, Finance Core, Reporting Projection.

### 6.3 Modul produk

| Modul | Fungsi Basic (R1) | Mandiri | Terhubung opsional ke |
|---|---|---|---|
| Catalog & Profile | Kategori, produk, varian, modifier, harga per lokasi, ketersediaan, profil publik | Ya | POS, Self-Order, Inventory |
| POS & Sales | Keranjang, pesanan, pembayaran manual (tunai, QRIS merchant, transfer, EDC), struk, shift kas, refund sederhana | Ya | KDS, Inventory, Finance, Customer |
| Floor & Self-Order | Lantai → area → meja, editor tata letak, tampilan meja langsung, sesi meja, pindah meja, QR per meja, pesan dari meja | Ya (paket digital) | POS, KDS |
| KDS | Antrean ticket, terima → siapkan → siap → sajikan, timer, peringatan ticket baru, input manual | Ya | POS, Self-Order |
| Inventory | Item, satuan, stok masuk/keluar, penyesuaian, opname, waste, transfer, pembelian sederhana, resep | Ya | Catalog, POS, Finance |
| Business Finance | Akun, pemasukan, pengeluaran, transfer, buku kas, rekonsiliasi manual, estimasi laba | Ya | POS, Inventory |
| Human Capital | Karyawan, departemen, shift, jadwal mingguan, absensi web, cuti | Ya | Finance (nanti) |
| Customer | Nama, telepon, catatan, riwayat kunjungan | Ya | POS |
| Reports | Laporan dasar melekat pada tiap modul | — | Analytics lintas modul (nanti) |
| Personal Finance | — (nanti) | Ya | — |

Setiap modul memiliki tier **Basic, Pro, Advanced**. Tier menentukan fitur; paket, add-on, dan override menentukan kapasitas.

### 6.4 Perilaku kombinasi

| Modul aktif | Perilaku |
|---|---|
| POS saja | Pesanan, penjualan, pembayaran, dan shift lengkap; event tanpa penerima tidak menimbulkan error |
| POS + KDS | Pesanan yang dikirim otomatis menjadi ticket dapur; status dapur kembali ke pesanan |
| POS + Finance | Penjualan dan pembayaran tercatat otomatis sesuai pemetaan akun |
| POS + Inventory | Stok berkurang sesuai resep dan titik potong yang dikonfigurasi |
| KDS saja | Ticket dari input manual atau API; tanpa POS |
| Inventory saja | Buku stok, opname, dan penerimaan tanpa Catalog |
| Finance saja | Pemasukan, pengeluaran, buku kas tanpa POS |
| HC saja | Tanpa istilah menu, meja, atau outlet |

Aturan inti: **banyak pintu masuk, satu use case.** Ticket dapur dari POS, input manual, dan API eksternal diproses oleh logika yang sama.

---

## 7. Paket

| Paket | Isi | Ketersediaan |
|---|---|---|
| Profile | Profil dan menu publik | R1 |
| POS Basic | Catalog + POS | R1 |
| Cafe Digital | POS Basic + Floor/Self-Order + KDS | R1 setelah POS dan KDS stabil |
| Cafe Operations | Cafe Digital + Inventory + Finance + Customer | R1 bertahap |
| Cafe Growth | Tier Pro pada modul utama + Analytics | R1+ |
| Enterprise | Komposisi dan limit khusus | Kontrak |
| Catalog / POS / KDS / Inventory / Finance / HC / Customer Only | Satu modul + Core | Basic R1 |
| Personal Finance | Workspace pribadi | Nanti |

Paket adalah preset berversi, bukan versi aplikasi berbeda. Versi paket yang sudah dipublikasikan tidak berubah; pelanggan lama memakai snapshot versinya. Angka limit masih baseline dan belum merupakan harga.

### 7.1 Limit

| Jenis | Contoh | Saat tercapai |
|---|---|---|
| Hard count | Pengguna, lokasi, perangkat, meja, produk, karyawan | Menolak pembuatan baru; yang lama tetap berfungsi |
| Soft metered | Penjualan, ticket, mutasi stok, transaksi finance, absensi | Tetap diproses; workspace ditandai melebihi kuota |
| Throttled | Ekspor, API eksternal | Ditunda atau ditolak dengan aman |
| Capability gate | Split bill, gabung meja, budget, absensi mobile | Butuh tier atau add-on yang sesuai |

Refund, pembalikan, koreksi stok, check-out absensi, penutupan sesi meja, dan ekspor data tidak pernah diblokir kuota. Penurunan paket tidak menghapus data.

---

## 8. Akses efektif

Sebuah aksi hanya boleh dijalankan bila semua syarat terpenuhi:

```text
langganan workspace dapat dipakai
DAN instalasi modul aktif
DAN capability ter-entitle
DAN pengguna punya izin
DAN lokasi dalam cakupan pengguna
DAN feature flag membuka fitur
```

Setiap syarat yang gagal menghasilkan alasan berbeda di API dan UI. Menyembunyikan menu bukan pengamanan; backend selalu memeriksa.

---

## 9. Requirement lintas modul

### 9.1 Data dan transaksi

- Data setiap workspace terisolasi; akses satu workspace tidak memberi akses ke workspace lain.
- Status pesanan dan status pembayaran terpisah.
- Transaksi final tidak dihapus; koreksi memakai void, refund, pembalikan, atau penyesuaian.
- Harga disalin sebagai snapshot ke pesanan; perubahan katalog tidak mengubah transaksi lama.
- Uang tidak memakai floating point.
- Waktu disimpan UTC; zona waktu berada pada lokasi.
- Mutasi kritis menerima kunci idempotency; permintaan ganda mengembalikan hasil pertama.

### 9.2 Pembayaran

- R1 hanya mencatat pembayaran manual; platform tidak memindahkan dana.
- Klaim "sudah bayar" dari pelanggan berstatus `VERIFYING` sampai kasir mengonfirmasi.
- Tidak ada dompet atau saldo konsumen.
- Pembayaran terintegrasi menunggu mitra berizin dan review legal.

### 9.3 Privasi per surface

| Surface | Tidak boleh menerima |
|---|---|
| KDS | Harga, HPP, pembayaran, telepon pelanggan |
| POS | HPP, laba |
| Customer | ID internal meja/sesi, koordinat tata letak, token mentah |
| Karyawan (HC) | Data karyawan lain tanpa izin |

### 9.4 UI

- Dua bahasa (`id`, `en`) dan tiga pilihan tema (terang, gelap, system) pada semua surface.
- Tiga kelas layar: Small 320–767px, Medium 768–1279px, Large ≥1280px. Semua fitur yang dimiliki pengguna dapat dipakai di ketiganya; responsive tidak pernah menjadi fitur berbayar.
- Aturan halaman minimalis sesuai design system bagian 4.
- Target aksesibilitas WCAG 2.2 AA; target sentuh minimal 44×44px pada POS, KDS, Floor, dan Customer.

### 9.5 Kinerja

| Area | Target kondisi normal |
|---|---|
| API baca p95 | ≤500 ms |
| API perintah p95 | ≤1 detik |
| Konfirmasi kirim/selesai POS p95 | ≤2 detik |
| Rambatan event antarmodul p99 | ≤5 detik |
| Ketersediaan bulanan | 99,5% |

---

## 10. Surface dan shell

| Shell | Pengguna | Karakter |
|---|---|---|
| Backoffice | Owner, manager, staf | Navigasi mengikuti modul aktif; tabel dan form |
| POS | Kasir, pelayan | Layar penuh, sentuh, transaksi cepat |
| KDS | Dapur | Kios, terbaca dari jarak, tombol besar |
| Customer | Tamu | HP dulu, aman untuk publik |
| Platform Admin | Operator SaaS | Tabel padat, konfigurasi langganan |

Inventory, Finance, HC, Customer, dan Reports berada di Backoffice. Alur per layar ada di [`../foundation/flowchart.md`](../foundation/flowchart.md).

---

## 11. Rilis

### 11.1 Posisi saat ini

| Area | Status |
|---|---|
| Login, sesi, organisasi, peran/izin, langganan/entitlement, audit, outbox | Berjalan (API + database) |
| Catalog | Berjalan dari database sampai halaman Backoffice, dengan AppShell, dua bahasa, dan terang/gelap |
| Kontrak modular (manifest, instalasi, binding, limit, event, command context, QR token, support access, batas modul) | Tersedia sebagai kontrak tipe; belum ada tabel dan API |
| POS | Berjalan dari database sampai layar kasir: shift dan kas, jual, bayar (tunai, QRIS, transfer, EDC), struk, refund, batal, catatan item, tahan pesanan. Belum: pajak per outlet, persetujuan PIN manager, makan di tempat, gambar produk |
| KDS, Inventory | Komponen UI ada; halaman hanya placeholder di mode development; belum ada API dan tabel |
| Floor, Finance, HC, Customer, Reports, Platform Admin | Sebagian komponen UI ada; belum ada halaman, API, dan tabel |
| Bank warna | Sudah mengikuti D-01 |
| Komponen UI, ikon, dua bahasa | Komponen dasar, shell, dan komponen POS mengikuti D-03 sampai D-07; label lewat props dan kamus `id`/`en`. Komponen domain lain (Floor, KDS, Inventory, Finance, Customer, Platform) dibenahi di milestone masing-masing |

### 11.2 Urutan pengerjaan

| Tahap | Isi | Selesai bila |
|---|---|---|
| A. Fondasi UI | Bank warna (selesai), komponen dibenahi satu per satu, Tabler, i18n, AppShell, PageHeader, FilterBar, state akses modul | Halaman Catalog memakai shell dan aturan baru di S/M/L, terang/gelap, `id`/`en` |
| B. Core modular | Tabel dan API instalasi, binding, paket berversi, limit, inbox | Provisioning idempotent; alasan akses dibedakan |
| C. Catalog + POS | Order, bill, payment, sale, shift | POS-only menyelesaikan transaksi dari awal sampai akhir |
| D. KDS | Ticket, input manual, intake dari POS | KDS-only dan POS+KDS memakai use case yang sama |
| E. Floor + Self-Order + Customer | Tata letak, sesi meja, QR, alur tamu | Pindah meja menjaga identitas sesi dan pesanan |
| F. Inventory | Buku stok, opname, penerimaan, resep, konsumsi | Inventory-only dan terintegrasi lulus |
| G. Business Finance | Finance Core, buku kas, binding POS | Tidak ada pendapatan ganda |
| H. Human Capital | Karyawan, jadwal, absensi, cuti | HC-only tanpa istilah F&B |
| I. Platform Admin + Reports | Package Builder, limit, laporan dasar | — |
| J. Hardening + pilot | Uji beban, uji isolasi, backup/restore, aksesibilitas | Pilot 2–3 merchant |

Setiap tahap dipecah menjadi checkpoint kecil yang dapat di-push sendiri sesuai `AGENTS.md`.

### 11.3 Setelah Release 1

Aplikasi mobile HC dan antrean absensi offline; Personal Finance; pembayaran terintegrasi; payroll dan HC Advanced; akuntansi formal; inventory lanjutan; CRM, loyalty, promosi; delivery, marketplace, reservasi; API publik.

---

## 12. Ukuran keberhasilan

- **Produk:** tingkat aktivasi per modul; waktu dari berlangganan sampai modul aktif; pelanggan yang menambah modul; konversi trial.
- **Operasional:** waktu input pesanan; waktu pesanan sampai siap; selisih kas; frekuensi koreksi stok dan absensi.
- **Teknis:** insiden kebocoran antar-workspace (target 0); transaksi ganda akibat event (target 0); latensi API p95; keterlambatan event p99.

## 13. Risiko utama

| Risiko | Mitigasi |
|---|---|
| Cakupan terlalu luas | Rilis bertahap; paket tidak dijual sebelum modulnya selesai |
| Logika ganda untuk mode mandiri dan terintegrasi | Banyak adapter, satu use case; uji batas modul |
| Event ganda | Inbox, referensi sumber unik, handler idempotent |
| Pendapatan dihitung dua kali di Finance | Pisahkan pengakuan pendapatan dari pergerakan pembayaran |
| Data pribadi dan bisnis bocor | Isolasi workspace, pemeriksaan keanggotaan, uji otomatis |
| UI kembali ramai | Aturan halaman di design system bagian 4 dan checklist review |
| Menu disembunyikan tetapi API terbuka | Pemeriksaan entitlement dan izin di backend |

## 14. Keputusan terbuka

| ID | Pertanyaan | Batas waktu |
|---|---|---|
| OD-01 | Nama produk tetap Cafe Companion Pro atau lebih generik? | Sebelum peluncuran publik |
| OD-02 | HC Basic dijual pada R1 atau beta sesudahnya? | Sebelum roadmap dikunci |
| OD-04 | KDS Only bawaan memakai input manual atau API? | Sebelum paket dipublikasikan |
| OD-05 | Titik potong stok bawaan per template? | Sebelum pilot integrasi |
| OD-06 | Pengakuan pendapatan Basic saat penjualan selesai atau pembayaran dikonfirmasi? | Sebelum integrasi Finance |
| OD-08 | Masa simpan audit, bukti absensi, data pelanggan, lampiran? | Sebelum produksi |
| OD-12 | Harga paket dan add-on? | Setelah pilot |

## 15. Peta dokumen

| Dokumen | Isi |
|---|---|
| [`prd.md`](./prd.md) | Dokumen ini |
| [`../foundation/design-system.md`](../foundation/design-system.md) | Tema, komponen, aturan halaman |
| [`../foundation/flowchart.md`](../foundation/flowchart.md) | Alur interaksi pengguna |
| [`../foundation/architecture.md`](../foundation/architecture.md) | Batas teknis dan keputusan arsitektur |
| [`../foundation/schema.md`](../foundation/schema.md) | Skema database saat ini dan target |
| [`../foundation/backend.md`](../foundation/backend.md) | Struktur dan aturan kode backend |
| [`../foundation/frontend.md`](../foundation/frontend.md) | Struktur dan aturan kode frontend |
| [`../foundation/security.md`](../foundation/security.md) | Kontrol keamanan dan privasi |
| [`../foundation/deploy.md`](../foundation/deploy.md) | Lingkungan, build, rilis, operasi |
