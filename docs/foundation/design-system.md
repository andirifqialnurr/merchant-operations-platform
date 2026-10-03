# Design System — Cafe Companion Pro

**Status:** Source of truth visual dan interaksi (menggantikan kontrak Warm Operational)
**Tanggal:** 2 Oktober 2026
**Tema:** Calm Neutral — monokrom netral tanpa warna aksen, minim dekorasi
**Mode:** Light, Dark, System
**Bahasa UI:** Indonesia (default) dan Inggris
**Font:** Geist Sans, Geist Mono terbatas
**Ikon:** Tabler Icons
**Chart:** ApexCharts melalui wrapper `packages/ui`
**Target aksesibilitas:** WCAG 2.2 Level AA

Dokumen terkait: [`frontend.md`](./frontend.md) untuk struktur kode, [`flowchart.md`](./flowchart.md) untuk alur layar, [`design-system-modules.md`](./design-system-modules.md) untuk pemetaan modul ke layar.

---

## 1. Mengapa tema diganti

UI sebelumnya bermasalah pada empat hal, dan design system ini dibuat untuk menutup keempatnya:

| Masalah | Aturan pengganti |
|---|---|
| Data yang sama muncul berulang dalam satu halaman | Satu fakta, satu lokasi (bagian 4.2) |
| Deskripsi halaman panjang memakan ruang konten | Header halaman hanya judul dan aksi (bagian 4.3) |
| Komponen belum lengkap sehingga tiap halaman membuat markup sendiri | Inventaris komponen wajib dan daftar gap (bagian 21) |
| Tema belum konsisten (kode memakai Teal/Geist, dokumen meminta Cream/DM Sans) | Satu tema netral yang memakai font yang sudah terpasang (bagian 6–8) |

Keputusan yang berubah dari dokumen lama:

| Area | Lama | Baru |
|---|---|---|
| Arah visual | Warm Operational (cream, espresso, amber) | Calm Neutral (abu netral dan tinta; tanpa warna aksen) |
| Font | DM Sans + Fraunces | Geist Sans + Geist Mono (sudah terpasang di `apps/web`) |
| Ikon | Lucide (±1.780 ikon) | Tabler Icons (6.200+ ikon) |
| Bahasa | Indonesia saja | Indonesia dan Inggris, dapat diganti pengguna |
| Aksi utama | Espresso (terang) / amber (gelap) | Tinta netral; fokus, pilihan, dan tautan juga netral |

Yang tidak berubah: tiga kelas responsive S/M/L, data guard, kontrak status domain, aturan aksesibilitas, dan seluruh batas tier/limit dari dokumen produk.

---

## 2. Referensi

Referensi dipakai untuk prinsip, bukan untuk menyalin tampilan.

| Referensi | Yang diambil |
|---|---|
| Linear | Kepadatan tinggi dengan chrome yang tenang; hierarki dari berat huruf dan jarak, bukan dari kotak dan bayangan |
| Vercel (Geist) | Sistem monokrom: warna hanya dipakai bila bermakna; skala abu yang rapi di terang dan gelap |
| Stripe Dashboard | Tabel sebagai konten utama; warna status sangat hemat (hijau berhasil, merah gagal) |
| Square POS (redesign 2024) | Register hitam-putih untuk aksesibilitas dan tampilan seragam; tombol sentuh besar |
| Shopify POS | Tiga tolok ukur keputusan desain: cepat, andal, sederhana |
| Toast POS / KDS | Mode terang dan gelap pada perangkat dapur; ticket terbaca dari jarak |

Tren 2026 yang relevan dan diadopsi: *calm design* (sembunyikan yang tidak dibutuhkan untuk tugas saat ini), *progressive disclosure*, antarmuka berbasis peran, dan *command palette* (ditunda ke R1+, lihat bagian 22).

---

## 3. Prinsip desain

1. **Konten dulu.** Tabel, angka, pesanan, dan stok adalah isi layar. Bingkai, judul bagian, dan dekorasi tidak boleh bersaing dengannya.
2. **Satu tujuan per layar.** Setiap halaman memiliki satu tugas utama dan paling banyak satu tombol utama.
3. **Warna berarti sesuatu.** Seluruh antarmuka monokrom; warna hanya muncul untuk status dan seri chart.
4. **Tenang secara bawaan.** Tanpa gradient, tanpa bayangan besar, tanpa ikon dekoratif, tanpa animasi yang tidak membawa informasi.
5. **Mudah dijangkau.** Aksi utama terlihat tanpa menggulir pada S/M/L; target sentuh minimal 44×44px pada POS, KDS, Floor, dan Customer.
6. **Jujur terhadap state.** Layar tidak menampilkan "berhasil" sebelum server mengonfirmasi, dan tidak menampilkan nol palsu untuk data yang belum ada.

---

## 4. Aturan konten halaman (wajib)

Bagian ini adalah kontrak keras. Review UI menolak halaman yang melanggarnya.

### 4.1 Anggaran informasi

| Elemen | Batas |
|---|---|
| Judul halaman | Maksimal 3 kata, kata benda (`Produk`, `Buku kas`, `Jadwal`) |
| Deskripsi di bawah judul | **Tidak ada.** Halaman tidak punya paragraf pengantar |
| Tombol utama per halaman/dialog | 1 |
| Aksi sekunder terlihat | Maksimal 2; sisanya masuk menu `…` |
| Kartu metrik di atas daftar | Maksimal 4, dan hanya bila angkanya tidak ada di tempat lain pada halaman itu |
| Kolom tabel pada Large | Maksimal 7; sisanya di panel detail |
| Teks bantuan field | Maksimal 1 baris, hanya bila aturan pengisiannya tidak jelas dari label |
| Tingkat sarang kartu | 0 — tidak ada kartu di dalam kartu |

### 4.2 Satu fakta, satu lokasi

- Setiap datum punya satu lokasi utama. Urutan memilih lokasi: shell → header halaman → tab → bagian → baris tabel/field.
- Konteks workspace dan lokasi hanya ditampilkan di shell (pemilih konteks). Halaman tidak mengulangnya di judul, breadcrumb, atau kartu.
- Total yang sudah ada di ringkasan tidak diulang sebagai kartu metrik, dan sebaliknya.
- Status hanya tampil sebagai badge di satu tempat per entitas pada satu layar.
- Nama pengguna dan email hanya ada di menu akun.
- Pengecualian yang diizinkan: struk/tanda terima, dialog konfirmasi yang menyebut ulang objek yang akan diubah, dan layar cetak.

### 4.3 Anatomi halaman

```text
[Shell: navigasi + konteks workspace/lokasi + akun]
Judul halaman                                   [Aksi sekunder] [Aksi utama]
[Tab bila ada lebih dari satu tampilan setara]
[Filter: cari + maksimal 3 filter terlihat]
Konten utama (tabel / daftar / form / canvas)
[Pagination]
```

Tidak semua bagian wajib ada. Yang dilarang: banner sambutan, paragraf penjelasan modul, kartu "tips", ilustrasi di halaman yang sudah berisi data, dan breadcrumb pada halaman tingkat pertama.

### 4.4 Tempat teks penjelasan

Penjelasan tetap boleh ada, tetapi hanya di tiga tempat:

1. **Empty state** — satu kalimat dan satu aksi, muncul hanya ketika data kosong.
2. **Tooltip atau ikon info** di samping label yang memang ambigu.
3. **Pesan error** — apa yang gagal dan apa yang dapat dilakukan.

### 4.5 Data guard

Sebelum menulis JSX, setiap datum diklasifikasi: input pengguna, tampilan read-only, tampilan turunan, atau tersembunyi. Aturan lengkapnya ada di `AGENTS.md` dan tetap berlaku. Ringkasnya: ID internal, token, nilai turunan, aktor, dan cap waktu tidak pernah menjadi field yang dapat diedit; baris yang tidak berlaku dihilangkan, bukan ditampilkan sebagai nol.

---

## 5. Surface aplikasi

| Surface | Pengguna | Kepadatan | Input utama | Tinggi kontrol |
|---|---|---|---|---|
| Backoffice | Owner, manager, staf | Sedang–tinggi | Mouse, keyboard, sentuh | 36px |
| POS | Kasir, pelayan | Sedang | Sentuh | 48px |
| KDS | Dapur | Rendah | Sentuh | 48–56px |
| Customer / Self-Order | Tamu | Rendah | Sentuh (HP) | 48px |
| Platform Admin | Operator SaaS | Tinggi | Mouse, keyboard | 32–36px |

Inventory, Finance, HC, dan Reports memakai shell Backoffice. Satu komponen boleh memiliki kepadatan berbeda per surface, tetapi nama variant dan perilakunya sama.

---

## 6. Warna

### 6.1 Arsitektur token

```text
Primitive (nilai mentah)  ->  Semantic (light/dark)  ->  Component token  ->  Komponen
```

- Halaman fitur hanya memakai semantic token.
- Primitive hanya boleh dirujuk di file token `packages/ui/src/styles/`.
- `scripts/check-color-guardrails.mjs` tetap menjadi penjaga: tidak ada hex, fungsi warna, atau utility palet Tailwind mentah di luar file token.

### 6.2 Semantic token

Nilai hex adalah nilai kanonik. Rasio kontras dihitung dengan rumus WCAG terhadap surface terkait.

**Permukaan dan garis**

| Token | Light | Dark | Pemakaian |
|---|---|---|---|
| `bg.canvas` | `#F9FAFB` | `#090A0C` | Latar aplikasi |
| `bg.surface` | `#FFFFFF` | `#111315` | Panel, tabel, form |
| `bg.subtle` | `#F3F4F6` | `#1A1C1F` | Header tabel, hover netral, filter |
| `bg.raised` | `#FFFFFF` | `#1F2123` | Popover, dialog, menu |
| `bg.inverse` | `#16181C` | `#F0F2F4` | Tooltip |
| `bg.overlay` | `#16181C` 48% | `#000000` 64% | Latar dialog |
| `border.subtle` | `#E4E6E9` | `#252729` | Pemisah baris |
| `border.default` | `#D7D9DC` | `#313336` | Tepi panel |
| `border.control` | `#7C8186` (3,9:1) | `#71757A` (4,0:1) | Tepi input, checkbox |

**Teks**

| Token | Light | Kontras | Dark | Kontras | Pemakaian |
|---|---|---|---|---|---|
| `text.primary` | `#16181C` | 17,7:1 | `#F0F2F4` | 16,6:1 | Isi utama |
| `text.secondary` | `#4F5358` | 7,8:1 | `#A7ABB0` | 8,1:1 | Label, metadata |
| `text.muted` | `#6B6F75` | 5,1:1 | `#898C91` | 5,5:1 | Placeholder, keterangan |
| `text.disabled` | `#9B9FA3` | — | `#55585D` | — | Nonaktif |
| `text.inverse` | `#FFFFFF` | — | `#16181C` | — | Di atas `bg.inverse` |

**Aksi**

| Token | Light | Dark | Pemakaian |
|---|---|---|---|
| `action.primary` | `#16181C` | `#F3F4F6` | Tombol utama |
| `action.primary.hover` | `#313336` | `#FFFFFF` | Hover tombol utama |
| `action.onPrimary` | `#FFFFFF` (17,7:1) | `#090A0C` (17,6:1) | Teks di atas tombol utama |
| `action.primary.pressed` | `#090A0C` | `#E4E6E9` | Tekan tombol utama |
| `bg.selected` | `#E4E6E9` | `#252729` | Latar item terpilih (navigasi, baris, tile) |
| `focus.ring` | `#16181C` | `#F3F4F6` | Cincin fokus 2px dengan offset 2px |

Tidak ada warna aksen. Tombol utama, fokus, dan item terpilih memakai tinta dan abu yang sama dengan struktur halaman; pembeda item terpilih adalah latar `bg.selected`, berat huruf 500, dan ikon filled. Tautan dalam teks memakai `text.primary` dengan garis bawah. Di kode, `bg.selected` adalah token `--color-action-primary-subtle`.

**Status**

| Status | Light teks / latar | Kontras | Dark teks / latar | Kontras |
|---|---|---|---|---|
| `success` | `#006836` / `#E0F9E8` | 6,3:1 | `#6AD895` / `#0F2E1B` | 8,4:1 |
| `warning` | `#844B00` / `#FFF2D2` | 6,3:1 | `#F3BD5C` / `#372508` | 8,6:1 |
| `danger` | `#B7191C` / `#FFECE9` | 5,8:1 | `#FE8B83` / `#3F1917` | 6,8:1 |
| `info` | `#0062A1` / `#E5F4FF` | 5,7:1 | `#78BFF9` / `#0E293D` | 7,6:1 |
| `neutral` | `text.secondary` / `bg.subtle` | 7,1:1 | `text.secondary` / `bg.subtle` | 7,4:1 |

**Cetak**

| Token | Nilai | Pemakaian |
|---|---|---|
| `print.ink` | `#090A0C` | Teks dan garis pada hasil cetak, apa pun tema layar |
| `print.paper` | `#FFFFFF` | Latar hasil cetak |

Token status lama `special` (ungu) dihapus; kasus yang memakainya pindah ke `neutral` atau `info`.

### 6.3 Aturan pemakaian warna

- Pendapatan tidak otomatis hijau dan pengeluaran tidak otomatis merah. Warna status hanya untuk kondisi.
- Status selalu disertai label teks; warna dan ikon hanya mempercepat pengenalan.
- Dalam satu layar, paling banyak satu area berlatar `bg.selected` (item yang sedang dipilih).
- Komponen domain menerima enum status, bukan warna.
- Kode fitur tidak menulis pasangan `dark:`; pasangan terang/gelap hanya didefinisikan di token.

### 6.4 Palet chart

Urutan seri tetap. Warna seri sengaja diredupkan agar chart tidak lebih mencolok dari isi halaman. Semua lolos kontras 3:1 terhadap `bg.surface`. Di kode: `--color-chart-series-1` sampai `-6`.

| Seri | Light | Dark | Nama |
|---|---|---|---|
| 1 | `#31363D` | `#E3E5E8` | Tinta |
| 2 | `#4675A4` | `#79A9DB` | Biru redup |
| 3 | `#3D908B` | `#71C2BC` | Teal redup |
| 4 | `#B68947` | `#E0B771` | Amber redup |
| 5 | `#B96365` | `#E39191` | Rose redup |
| 6 | `#898C91` | `#6B6F75` | Abu (pembanding/periode lalu) |

Maksimal 6 seri. Chart dengan satu seri memakai seri 1; periode pembanding memakai seri 6.

### 6.5 Ramp netral

Seluruh struktur diambil dari satu ramp 16 langkah. Token semantic hanya menunjuk ke ramp ini.

| Langkah | Hex | Dipakai light | Dipakai dark |
|---|---|---|---|
| 0 | `#FFFFFF` | surface, teks di atas tombol | hover tombol utama |
| 25 | `#F9FAFB` | canvas | — |
| 50 | `#F3F4F6` | subtle | teks utama, tombol utama, fokus |
| 100 | `#E4E6E9` | garis halus, item terpilih | tekan tombol utama |
| 200 | `#D7D9DC` | garis panel | — |
| 300 | `#A7ABB0` | teks nonaktif | teks sekunder (8,1:1) |
| 400 | `#898C91` | garis kontrol (3,4:1) | teks redup (5,5:1), garis tegas |
| 500 | `#6B6F75` | teks redup (5,1:1) | garis kontrol (3,7:1), teks nonaktif |
| 600 | `#4F5358` | teks sekunder (7,8:1), garis tegas | — |
| 700 | `#313336` | hover tombol utama | garis panel |
| 750 | `#252729` | — | garis halus, item terpilih |
| 800 | `#1F2123` | — | raised |
| 850 | `#1A1C1F` | — | subtle |
| 900 | `#16181C` | teks utama, tombol utama, fokus | teks di atas permukaan terang |
| 925 | `#111315` | — | surface |
| 950 | `#090A0C` | tekan tombol utama | canvas, teks di atas tombol |

Beberapa nilai pada tabel bagian 6.2 berbeda tipis dari ramp ini (teks dark `#F0F2F4` menjadi `#F3F4F6`; garis kontrol `#7C8186`/`#71757A` menjadi `#898C91`/`#6B6F75`; teks nonaktif `#9B9FA3`/`#55585D` menjadi `#A7ABB0`/`#6B6F75`). Ramp inilah yang berlaku di kode; kontrasnya sudah dihitung ulang dan tetap lolos AA.

### 6.6 Bank warna di kode

| File | Isi |
|---|---|
| `packages/ui/src/styles/primitives.css` | Ramp netral, 4 warna status × 4 langkah, 10 warna chart, 10 warna preset storefront |
| `packages/ui/src/styles/tokens.css` | Token semantic light dan dark |
| `packages/ui/src/styles/merchant-presets.css` | Preset storefront |
| `packages/ui/src/styles/tailwind-theme.css` | Utility Tailwind (`bg-surface`, `text-foreground`, `bg-chart-1`, …) |
| `apps/web/src/app/color-bank/page.tsx` | Pratinjau di `/color-bank` |

Yang dihapus dari bank lama: skala Teal 11 langkah, skala Slate, serta Violet, Indigo, Rose, dan Orange versi lama. Token `--color-status-special-*` masih ada tetapi dipetakan ke netral sampai komponen yang memakainya dibenahi.

### 6.7 Merchant branding

Override warna merchant hanya berlaku di Cafe Profile dan Customer Self-Order: logo, banner, dan satu preset warna utama yang sudah lolos kontras (`ink` sebagai bawaan, `blue`, `teal`, `green`, `rose`, `orange`). Backoffice, POS, KDS, dan Platform Admin tidak pernah mengikuti warna merchant. Warna merchant tidak mengganti warna status.

---

## 7. Mode terang, gelap, dan system

- Pilihan: `Light`, `Dark`, `System`. Mekanisme: atribut `data-theme` pada `<html>` melalui `next-themes` (sudah terpasang), dengan `color-scheme` yang sesuai.
- Tema diterapkan sebelum paint; tidak boleh ada kilatan tema yang salah.
- Penyimpanan preferensi: per perangkat untuk POS dan KDS; per pengguna untuk Backoffice dan Platform Admin; mengikuti sistem untuk Customer.
- Mengganti tema tidak me-refresh halaman dan tidak mereset keranjang, form, filter, atau konteks.
- Mode gelap memakai abu netral gelap, bukan hitam murni dan bukan navy. Permukaan dibedakan dengan luminance dan garis, bukan bayangan.
- Setiap komponen dan halaman diverifikasi pada kedua mode. Perubahan belum selesai bila hanya diperiksa pada satu mode.

---

## 8. Tipografi

### 8.1 Font

```text
UI          : Geist Sans   (fallback: Inter, ui-sans-serif, system-ui, sans-serif)
Kode/teknis : Geist Mono   (hanya ID teknis, kode, dan log di Platform Admin)
```

Font dimuat dari paket `geist` yang sudah terpasang; tidak ada CDN font saat runtime. Tidak ada font display kedua.

### 8.2 Skala

| Token | Ukuran / tinggi baris | Berat | Pemakaian |
|---|---|---|---|
| `display` | 30 / 36 | 600 | Total POS, nomor antrean besar |
| `title` | 20 / 28 | 600 | Judul halaman |
| `heading` | 16 / 24 | 600 | Judul bagian, judul dialog |
| `body-lg` | 16 / 24 | 400 | Teks pada surface sentuh |
| `body` | 14 / 20 | 400 | Bawaan Backoffice |
| `body-sm` | 13 / 18 | 400 | Tabel padat, metadata |
| `label` | 13 / 18 | 500 | Label field, header tabel, tombol |
| `caption` | 12 / 16 | 400 | Keterangan, cap waktu |
| `numeric-lg` | 24 / 30 | 600 | Angka metrik |

Aturan:

- Judul halaman hanya satu per layar dan memakai `title`. Tidak ada judul yang lebih besar di Backoffice.
- Berat yang dipakai hanya 400, 500, 600.
- Teks interaktif tidak lebih kecil dari 13px; pada surface sentuh tidak lebih kecil dari 16px.
- Huruf besar semua hanya untuk kode teknis. Judul dan tombol memakai *sentence case*.
- Tracking: `-0.01em` untuk `display` dan `title`, `0` untuk lainnya.

### 8.3 Angka

`font-variant-numeric: tabular-nums` untuk uang, kuantitas, timer, nomor antrean, saldo stok, dan laporan. Nominal rata kanan di tabel.

---

## 9. Jarak, ukuran, radius, bayangan

**Jarak** — grid dasar 4px: `2, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64`. Antar-kontrol 8px; antar-field 16px; antar-bagian 24px (32px untuk bagian besar).

**Tinggi kontrol**

| Ukuran | Tinggi | Pemakaian |
|---|---|---|
| `xs` | 28px | Aksi dalam baris tabel padat |
| `sm` | 32px | Toolbar, filter, Platform Admin |
| `md` | 36px | Bawaan Backoffice |
| `lg` | 48px | POS, KDS, Customer, form sentuh |
| `xl` | 56px | Tombol bayar, aksi ticket KDS |

`xs` dan `sm` tidak dipakai pada surface sentuh.

**Radius** — mengikuti token di kode: `xs` 4px (badge, checkbox), `sm` 6px (tombol, input), `md` 8px (panel, tile, ticket), `lg` 12px (dialog, sheet), `xl` 16px (hanya surface Customer), `full` (avatar, pil status).

**Bayangan** — `none` untuk panel dan tabel; `sm` untuk elemen sticky; `md` untuk popover dan menu; `lg` untuk dialog dan sheet. Kartu tidak memiliki bayangan. Pada mode gelap, garis menggantikan bayangan.

---

## 10. Ikon

**Pustaka: Tabler Icons** (`@tabler/icons-react`, lisensi MIT).

Alasan pemilihan: 6.200+ ikon gratis (±5.100 outline dan ±1.050 filled), digambar pada grid 24×24 dengan garis 2px yang dapat diatur, sehingga gaya garisnya sama dengan Lucide yang dipakai sekarang tetapi cakupannya lebih dari tiga kali lipat. Kebutuhan domain yang tidak ada di Lucide (peralatan dapur, meja, struk, laci kas, timbangan, absensi) tersedia di Tabler.

| Ukuran | Nilai | Pemakaian |
|---|---|---|
| `xs` | 14px | Di dalam badge |
| `sm` | 16px | Kontrol padat, tabel |
| `md` | 20px | Bawaan |
| `lg` | 24px | Surface sentuh |
| `xl` | 32px | Empty state |

Aturan:

- Semua ikon dirender melalui `AppIcon` di `packages/ui`; halaman tidak mengimpor pustaka ikon secara langsung. Dengan begitu migrasi dari Lucide cukup dilakukan di satu tempat.
- Ketebalan garis 1,75px; warna `currentColor`.
- Varian outline adalah bawaan. Varian filled hanya untuk state aktif/terpilih pada navigasi.
- Impor per ikon (`import { IconReceipt } from "@tabler/icons-react"`) agar bundle tetap kecil.
- Tombol ikon wajib punya nama aksesibel dan tooltip. Aksi kritis pada POS/KDS selalu berlabel teks.
- Ikon tidak dipakai sebagai dekorasi judul bagian atau kartu metrik. Emoji tidak dipakai sebagai ikon.

---

## 11. Bahasa dan konten

### 11.1 Dua bahasa

- Bahasa: `id` (bawaan) dan `en`. Pengguna menggantinya dari menu akun; Customer dari pemilih di header.
- Urutan penentuan bahasa: pilihan tersimpan pengguna → cookie → `Accept-Language` → `id`.
- Semua teks UI berasal dari kamus terjemahan; tidak ada string yang ditulis langsung di komponen. Komponen `packages/ui` menerima label melalui props.
- Server mengirim **kode** error yang stabil; teks yang tampil diterjemahkan di frontend berdasarkan kode. Detail teknis ada di `frontend.md` bagian i18n.
- Data milik merchant (nama produk, kategori, catatan) tidak diterjemahkan.
- Tata letak harus tahan terhadap teks Indonesia yang 20–30% lebih panjang dari Inggris: tombol tidak berlebar tetap, label boleh membungkus dua baris.

### 11.2 Format lokal

| Data | `id` | `en` |
|---|---|---|
| Mata uang | `Rp50.000` | `Rp50,000` |
| Desimal | `1,5` | `1.5` |
| Tanggal | `14 Jul 2026` | `Jul 14, 2026` |
| Tanggal-waktu | `14 Jul 2026, 21.30` | `Jul 14, 2026, 21:30` |
| Timer | `14:35` | `14:35` |
| Persen | `12,5%` | `12.5%` |

Jam selalu 24 jam. Zona waktu mengikuti lokasi, bukan bahasa. Format dihasilkan `Intl`, tidak dirangkai manual.

### 11.3 Gaya bahasa

- Istilah operasional yang umum: `Pesanan`, `Meja`, `Kasir`, `Dapur`, `Stok`, `Pengeluaran`.
- Label aksi memakai kata kerja spesifik:

| Hindari | Gunakan (`id`) | Gunakan (`en`) |
|---|---|---|
| OK | Konfirmasi pembayaran | Confirm payment |
| Submit | Kirim pesanan | Send order |
| Yes | Batalkan pesanan | Cancel order |
| Process | Mulai siapkan | Start preparing |
| Delete | Hapus produk | Delete product |

- Pola pesan error: apa yang gagal, mengapa (bila aman dijelaskan), apa yang dapat dilakukan. Contoh: `Pesanan belum terkirim karena koneksi terputus. Periksa jaringan lalu coba lagi.`
- Dilarang: `Something went wrong`, `Error 500`, pesan database atau provider.

---

## 12. Kontrak umum komponen

Setiap komponen interaktif memiliki state: default, hover, focus-visible, pressed, disabled, loading (bila memproses), invalid (bila menerima input).

- Fokus memakai cincin 2px dengan offset 2px berwarna `focus.ring` (tinta), terlihat di kedua mode termasuk pada tombol utama karena ada offset.
- Hover bukan satu-satunya cara menemukan fungsi.
- Loading mempertahankan lebar komponen dan mencegah klik ganda.
- Disabled bukan pengganti pemeriksaan izin. Aksi yang tidak diizinkan disembunyikan; aksi yang diizinkan tetapi belum memenuhi syarat ditampilkan nonaktif beserta alasannya.
- API komponen minimal: `variant`, `size`, `disabled`, `loading` (bila relevan), `className` untuk tata letak saja, `aria-*`, dan ref.
- Tidak ada props warna bebas. Tidak ada string UI bawaan di dalam komponen.

---

## 13. Aksi

### 13.1 Button

| Variant | Fungsi | Tampilan |
|---|---|---|
| `primary` | Satu aksi utama | Isi tinta |
| `secondary` | Aksi pendamping | Surface + garis (`outline` adalah alias lama untuk variant ini) |
| `ghost` | Toolbar, aksi baris | Transparan, hover `bg.subtle` |
| `destructive` | Hapus, batalkan, suspend | Isi danger |
| `link` | Navigasi dalam teks | Teks utama bergaris bawah |

Ukuran `xs`–`xl` mengikuti tinggi kontrol. Lebar penuh hanya untuk aksi sentuh utama (bayar, kirim pesanan, masuk).

Aturan: satu `primary` per halaman/dialog/grup; label kata kerja spesifik; ikon di kiri kecuali ikon arah; `destructive` membuka `AlertDialog` bila tidak mudah dibatalkan; label loading berbentuk `Menyimpan…`.

### 13.2 IconButton, ButtonGroup

`IconButton` berukuran sama dengan tinggi kontrol dan wajib punya `aria-label` serta tooltip. `ButtonGroup` hanya untuk pilihan setara, bukan untuk tab halaman. Split button tidak dipakai pada versi ini.

---

## 14. Form

### 14.1 Struktur field

```text
Label
Kontrol
Pesan error (hanya saat tidak valid) atau bantuan satu baris (hanya bila perlu)
```

- Label selalu terlihat; placeholder bukan label.
- Field wajib tidak diberi tanda; field opsional diberi keterangan `opsional` di label (`FormField optionalLabel`). Ini mengurangi noise karena sebagian besar field wajib.
- Fokus input: garis berubah menjadi tinta dengan tambahan 1px, bukan cincin ber-offset, supaya form padat tetap tenang.
- Error muncul di bawah kontrol dan terhubung melalui `aria-describedby`.
- Form mempertahankan isian ketika validasi server gagal.
- Tombol simpan tidak dinonaktifkan hanya karena form belum disentuh.
- Form satu kolom pada Small; maksimal dua kolom pada Medium/Large dan hanya untuk field yang berhubungan.

### 14.2 Kontrol

| Komponen | Catatan |
|---|---|
| `Input` | Variant: default, search (dengan tombol hapus), password (tampil/sembunyi), prefix/suffix. Read-only berbeda dari disabled: read-only tetap dapat difokuskan dan disalin |
| `Textarea` | Auto-grow sampai batas; penghitung karakter hanya bila ada batas nyata |
| `NumberInput` | Integer, desimal, persen, satuan. Roda mouse tidak mengubah nilai |
| `MoneyInput` | Prefix `Rp` di dalam kontrol; nilai disimpan sebagai integer satuan terkecil; kosong, nol, dan null dibedakan |
| `Select` | Untuk ≤10 opsi; visual kustom |
| `Combobox` | Untuk data panjang (produk, pemasok, akun, karyawan); state loading, tanpa hasil, error + coba lagi |
| `MultiSelect` | **Gap** — dibutuhkan untuk filter status dan penugasan lokasi |
| `DatePicker`, `DateRangePicker`, `MonthPicker` | Preset laporan: Hari ini, 7 hari terakhir, Bulan ini, Bulan lalu |
| `TimeInput` | 24 jam |
| `Checkbox`, `Radio` | Seluruh label dapat diklik |
| `Switch` | Hanya untuk perubahan boolean yang langsung berlaku |
| `SegmentedControl` | 2–4 pilihan tampilan |
| `QuantityStepper` | Kuantitas sentuh |
| `FileUpload` | **Gap** — tombol, dropzone, pratinjau gambar; menampilkan tipe, ukuran maksimum, progres, error, hapus |
| `PinInput` | **Gap** — PIN persetujuan manager |

---

## 15. Navigasi dan shell

### 15.1 AppShell

Satu komponen shell untuk Backoffice dan Platform Admin.

| Bagian | Isi |
|---|---|
| Sidebar | Logo, daftar modul aktif, tautan Explore Modules di bawah |
| Top bar | Pemilih workspace/lokasi di kiri; pencarian (R1+), menu akun di kanan |
| Menu akun | Nama, email, bahasa, tema, keluar |

- Sidebar: 232px terbuka, 64px ringkas, drawer 280px pada Small.
- Item navigasi: tinggi 36px, ikon 20px, teks 14px. Item aktif memakai `bg.selected`, teks `text.primary` berat 500, dan ikon filled.
- Navigasi hanya menampilkan modul yang terpasang, ter-entitle, dan boleh diakses pengguna. Tidak ada item yang berujung jalan buntu.
- Sidebar tidak memiliki label grup bila item ≤7.
- Pemilih tema dan bahasa berada di menu akun, bukan di top bar.

### 15.2 Komponen navigasi

| Komponen | Catatan |
|---|---|
| `Sidebar`, `TopBar` | Ada |
| `ContextSwitcher` | **Gap** — pemilih workspace dan lokasi dalam satu popover |
| `UserMenu` | **Gap** — akun, bahasa, tema, keluar |
| `Tabs` | Variant line (bawaan) dan contained; hanya untuk konten setara |
| `Breadcrumb` | Hanya pada halaman tingkat kedua ke bawah; maksimal 3 tingkat |
| `Pagination` | Bernomor untuk Backoffice; sebelumnya/berikutnya pada Small; cursor untuk daftar transaksi besar |
| `Stepper` | Onboarding dan setup, bukan untuk lifecycle pesanan |
| `BottomNav` | **Gap** — navigasi utama POS dan Customer pada Small |
| `CommandPalette` | Ditunda ke R1+ |

### 15.3 Shell POS, KDS, Customer

- **POS:** layar penuh; bar atas 56px berisi lokasi, status koneksi, shift, dan menu; tidak ada sidebar.
- **KDS:** layar penuh; bar atas 56px berisi station, status koneksi, jam, dan pengaturan; tanpa menu Backoffice.
- **Customer:** header merchant ringkas, konten terpusat maksimal 720px, bar keranjang sticky di bawah.

---

## 16. Umpan balik dan status

| Komponen | Aturan |
|---|---|
| `Badge` | Variant neutral/info/success/warning/danger; bawaan latar lembut; tidak dapat diklik |
| `Chip` | **Gap** — filter aktif yang dapat dihapus; berbeda dari Badge |
| `Alert` | Hanya untuk kondisi yang membutuhkan tindakan; alert kritis tidak dapat ditutup selama kondisinya aktif |
| `Toast` | Maksimal 3; Backoffice kanan atas, POS/KDS tengah atas; bukan satu-satunya bukti transaksi |
| `Spinner`, `Progress`, `Skeleton` | Skeleton untuk memuat tata letak; spinner hanya untuk proses singkat dalam kontrol |
| `EmptyState` | Ukuran compact/default; satu kalimat + satu aksi; data kosong dibedakan dari hasil pencarian kosong |
| `ErrorState` | Inline, bagian (dengan coba lagi), halaman penuh, offline, akses ditolak |
| `StatusBar` | Offline, menyambung ulang, data usang; tampil terus selama kondisinya aktif |

### 16.1 Module Access State

Satu pola untuk menjelaskan mengapa modul/fitur belum dapat dipakai. State tidak boleh disatukan menjadi satu pesan `Fitur tidak tersedia`.

| State | Kode API | Tampilan |
|---|---|---|
| Tidak ter-entitle | `ENTITLEMENT_REQUIRED` | Tidak muncul di navigasi; tampil di Explore Modules dengan ajakan upgrade |
| Butuh tier lebih tinggi | `TIER_UPGRADE_REQUIRED` | Aksi terkunci dengan nama tier yang dibutuhkan |
| Sedang disiapkan | — | Progres; aksi nonaktif |
| Perlu setup | `INSTALLATION_SETUP_REQUIRED` | Checklist setup + aksi lanjutkan |
| Aktif | — | Normal sesuai izin |
| Dijeda/error | — | Banner dengan alasan aman, data terakhir, aksi coba lagi |
| Izin ditolak | `HTTP_403` | Akses ditolak tanpa ajakan upgrade |
| Langganan ditangguhkan | `SUBSCRIPTION_SUSPENDED` | Read-only + ajakan penagihan |

### 16.2 Usage dan Limit State

Menampilkan nama dimensi, pemakaian dan batas, tanggal reset, dan ajakan add-on/upgrade bagi yang berhak melihat penagihan. Ambang: normal <80%, mendekati 80–89,99%, hampir habis 90–99,99%, tercapai ≥100%. Batas hard menolak pembuatan resource baru; event operasional soft-metered tidak pernah ditampilkan sebagai transaksi gagal. Kasir, dapur, dan karyawan tidak melihat detail penagihan.

---

## 17. Overlay

| Komponen | Ukuran | Aturan |
|---|---|---|
| `Dialog` | sm 400, md 520, lg 720 | Header, isi, footer; footer sticky bila isi menggulir; tidak ditumpuk |
| `AlertDialog` | sm | Menyebut konsekuensi; aksi spesifik; alasan wajib untuk refund, penyesuaian stok besar, pembatalan pesanan produksi, suspend |
| `Sheet` | sm 360, md 480, lg 640 | Detail dan edit dari daftar; pada Small menjadi lembar bawah atau layar penuh |
| `Popover` | 180–320 | Filter ringan, pemilih tanggal |
| `DropdownMenu` | 180–320 | Daftar aksi; aksi destruktif dipisah garis |
| `Tooltip` | — | Maksimal dua kalimat pendek; tidak memuat informasi wajib |

Pola bawaan Backoffice: klik baris tabel membuka `Sheet` detail di kanan, bukan pindah halaman. Ini menjaga konteks daftar dan menghindari halaman detail yang mengulang data daftar.

---

## 18. Tampilan data

### 18.1 DataTable

| Kepadatan | Header | Baris | Teks |
|---|---|---|---|
| `compact` | 32px | 36px | 13px |
| `default` | 36px | 44px | 14px |
| `comfortable` | 44px | 52px | 14px |

- Header berat 500 di atas `bg.subtle`; tanpa zebra.
- Angka dan nominal rata kanan; teks dan status rata kiri.
- Aksi baris di kanan dalam menu `…`; kolomnya tanpa judul.
- Sort memakai ikon dan `aria-sort`. Loading, kosong, error, pagination, dan filter adalah bagian komponen.
- Setiap kolom memiliki prioritas: `P0` identitas dan status (selalu tampil), `P1` metrik utama, `P2` metadata sekunder, `P3` audit. Pada Small, tabel menjadi baris ringkas (P0 + P1) dan sisanya pindah ke detail.

### 18.2 Lainnya

| Komponen | Aturan |
|---|---|
| `Panel` | Pengganti kartu: bagian dengan garis, tanpa bayangan, tanpa sarang. Sudah tersedia di `data-display` |
| `DescriptionList` | Detail entitas; horizontal di Large, bertumpuk di Small; pasangan label–nilai tidak dijadikan kartu |
| `MetricCard` | Judul, nilai, perubahan terhadap periode pembanding; tanpa ikon dekoratif |
| `Avatar` | Inisial dua huruf dengan warna token |
| `Timeline` | Riwayat pesanan, pembayaran, langganan, audit |
| `Accordion` | Hanya untuk informasi sekunder |
| `Divider` | Jarak tetap menjadi pemisah utama |

### 18.3 Chart

Semua chart memakai **ApexCharts** melalui wrapper `Chart` di `packages/ui` (sudah ada). Halaman tidak mengimpor `apexcharts` langsung.

- Jenis yang didukung: line, area, bar, donut.
- Warna dari palet bagian 6.4; wrapper membaca tema aktif dan mengganti palet saat tema berubah.
- Toolbar bawaan ApexCharts (zoom, unduh) dimatikan; ekspor dilakukan dari aksi halaman.
- Garis grid `border.subtle`; label `text.secondary` 12px; font mengikuti `Geist Sans`.
- Tooltip menampilkan nilai yang sudah diformat sesuai bahasa aktif.
- Animasi dimatikan bila `prefers-reduced-motion` aktif.
- Wrapper menyediakan state loading, kosong, dan error, serta ringkasan teks untuk pembaca layar.
- Chart finance selalu punya angka ringkasan atau tabel pendamping.
- Dilarang: chart 3D, lebih dari 6 seri, merah/hijau untuk kategori netral, chart yang mengulang angka yang sudah ada di tabel di sebelahnya.

---

## 19. Komponen domain

Komponen domain dibangun dari primitive `packages/ui` dan tidak menggandakan Button, Badge, Dialog, atau Input. Kontrak perilakunya tetap; hanya tampilannya mengikuti token baru.

### 19.1 Bersama

| Komponen | Kontrak |
|---|---|
| `MoneyDisplay` | Variant inline/summary/total/accounting; `Rp0` untuk nol nyata, `—` berlabel aksesibel untuk data tidak tersedia |
| Badge status domain | `OrderStatusBadge`, `PaymentStatusBadge`, `StockStatusBadge`, `SubscriptionStatusBadge`, `DeviceStatusBadge`, `AttendanceStatusBadge`; hanya menerima enum |
| `PageHeader` | **Gap** — judul + aksi; tanpa slot deskripsi |
| `FilterBar` | **Gap** — cari + maksimal 3 filter + chip aktif + reset; state di URL |
| `EntityHeader` | **Gap** — judul entitas + status + aksi di dalam Sheet/halaman detail |
| `NetworkIndicator` | Online, menyambung ulang, offline, data usang, sinkron gagal |
| `ModuleAccessState`, `UsageLimitState` | **Gap** — lihat bagian 16 |

### 19.2 POS

| Komponen | Kontrak ringkas |
|---|---|
| `ProductTile` | Nama (maks. 2 baris), harga, status habis berlabel; gambar opsional; harga tidak tertutup gambar |
| `CategoryRail` | Vertikal pada Large, chip horizontal pada Small |
| `ProductModifierPicker` | Di `apps/web/src/features/pos/product-options-sheet.tsx`, bukan `packages/ui`. Grup wajib dulu; radio untuk satu pilihan, checkbox untuk banyak; batas min/maks terlihat |
| `CartItem`, `CartSummary` | Baris yang tidak berlaku dihilangkan; total paling menonjol |
| `PaymentMethodTile`, `CashKeypad` | Di `apps/web/src/features/pos/payment-view.tsx`, bukan `packages/ui`. Tombol keypad minimal 56px; nominal diterima dan kembalian jelas |
| `PaymentConfirmationPanel` | Di `apps/web/src/features/pos/paid-view.tsx`, bukan `packages/ui`. `Lunas` hanya setelah server menyimpan `PAID` |
| `OpenShiftForm`, `CloseShiftForm`, `ShiftSummary` | Nilai turunan tidak menjadi input; selisih mengikuti izin |
| `OrderCard`, `Receipt`, `HeldOrderList` | **Gap** |

### 19.3 Floor dan meja

`FloorSelector`, `TableTile`, `TableLayoutCanvas`, `TableLayoutToolbar`, `TableLayoutPropertyPanel`, `UnplacedTableTray`, dan `TableQrManager` sudah ada. **Gap:** `AreaSelector`, bentuk meja (persegi, persegi panjang, bundar) dengan kursi turunan, `LiveTableView` dengan daftar pengganti pada Small, `TableSessionPanel`, dan alur pindah meja dengan pemilihan asal–tujuan.

Aturan tetap: canvas memakai grid logis; menggeser tile di mode edit hanya mengubah posisi visual, sedangkan pindah meja adalah aksi domain terpisah; status meja tidak hanya dibedakan warna.

### 19.4 KDS

`KdsTicket` (ukuran sm/md/lg; variant compact/default/touch/history), `KdsNewTicketAlert`, dan `KdsConnectionStatus` sudah ada. Ticket memakai garis status di tepi dan badge, bukan latar berwarna penuh. Timer memakai angka tabular dan tidak berkedip. KDS tidak pernah menerima harga, HPP, pembayaran, atau kontak pelanggan. **Gap:** form ticket manual untuk KDS-only, tampilan riwayat.

### 19.5 Inventory, Finance, HC, Customer, Platform

| Area | Sudah ada | Gap |
|---|---|---|
| Inventory | `StockIndicator`, `StockMovementRow`, `MovementTypeBadge`, `InventoryItemPicker`, `StockOperationForm`, `StocktakeCountRow`, `RecipeBomEditor` | Form penerimaan barang, daftar pemasok, form transfer |
| Finance | `FinanceMetric`, `FinanceBasicSummary`, `FinanceProfitEstimate`, `FinanceReconciliationSummary`, `FinanceValidatedReport` | `LedgerRow`, form pemasukan/pengeluaran/transfer, pemilih akun |
| HC | — | Seluruhnya: `EmployeeRow`, `EmployeeDetailHeader`, `ScheduleBoard`, `AttendanceEventRow`, `AttendanceRecordCard`, `LeaveRequestCard` |
| Customer | `CustomerBasicProfile`, `CustomerOrderSurface`, `CustomerQrContext` | `StickyCartBar`, `OrderProgress`, tombol panggil pelayan/minta bill |
| Platform | `PlatformTenantSubscriptionMaster`, `PlatformEntitlementMatrix`, `PlatformSupportAudit` | Package Builder, panel instalasi dan binding, banner konteks support |

Label wajib: HPP dan laba pada Finance Basic selalu berlabel `Estimasi operasional`.

---

## 20. Tata letak dan responsive

### 20.1 Tiga kelas

| Kelas | Lebar CSS | Sasaran | Baseline QA |
|---|---|---|---|
| Small (S) | 320–767px | Satu kolom, sentuh | 390×844 |
| Medium (M) | 768–1279px | Multi-panel ringkas | 1024×768 |
| Large (L) | ≥1280px | Multi-kolom, padat | 1440×900 |

Batas uji tambahan: 320, 767, 768, 1279, 1280. Pada Tailwind: dasar <768, `md` ≥768, `xl` ≥1280. Responsive adalah baseline kualitas dan tidak pernah menjadi tier, limit, atau add-on.

### 20.2 Transformasi

| Hal | Large | Medium | Small |
|---|---|---|---|
| Navigasi | Sidebar tetap | Sidebar ringkas | Drawer / bottom nav |
| Data padat | Tabel | Tabel ringkas | Baris ringkas + detail |
| Filter | Sebaris | Sebaris ringkas | Cari + sheet filter |
| Form | 1–2 kolom | 1–2 kolom selektif | 1 kolom |
| Detail/edit | Sheet kanan | Sheet | Layar penuh |
| Aksi utama | Header | Header | Bar bawah sticky |

Aturan: tidak ada scroll horizontal tingkat halaman pada Small; aksi kritis tidak hilang saat layar menyempit; perpindahan breakpoint tidak mereset keranjang, draft form, filter, atau konteks.

### 20.3 Lebar konten

| Konteks | Lebar maksimal |
|---|---|
| Daftar Backoffice | 1440px |
| Form Backoffice | 720px |
| Customer | 720px |
| Auth / setup | 400px |
| POS / KDS | Layar penuh |

### 20.4 Tata letak per surface

- **POS:** L rail kategori 180px + produk + keranjang 380px; M produk + keranjang ringkas; S produk sebagai tampilan utama, keranjang dibuka dari bar ringkasan.
- **KDS:** L grid multi-kolom; M 2–3 kolom; S satu kolom berprioritas. Ticket terlama di awal.
- **Floor:** Live Table View dan Edit Layout terpisah. Pada Small, Live menyediakan daftar pengganti; Edit memakai form/sheet sehingga drag presisi tidak wajib.
- **Customer:** S 1–2 kolom dengan keranjang sticky; M 2–3 kolom; L katalog terpusat.

---

## 21. Inventaris komponen

Status terhadap kode per 2 Oktober 2026. "Ada" berarti komponen tersedia di `packages/ui` dan perlu disesuaikan dengan token baru.

### 21.1 Sudah ada (59 ekspor)

`AppIcon`, `Button`, `IconButton`, `FormField`, `Input`, `Textarea`, `Checkbox`, `Radio`, `Switch`, `SegmentedControl`, `QuantityStepper`, `Select`, `Combobox`, `NumericInput`, `MoneyInput`, `DatePicker`, `DateRangePicker`, `MonthPicker`, `TimeInput`, `Badge`, `Alert`, `ToastStack`, `StatusBar`, `Spinner`, `Progress`, `Skeleton`, `EmptyState`, `ErrorState`, `Dialog`, `AlertDialog`, `Sheet`, `Popover`, `DropdownMenu`, `Tooltip`, `Sidebar`, `TopBar`, `Tabs`, `Breadcrumb`, `Pagination`, `Stepper`, `Card`, `DataTable`, `DescriptionList`, `MetricCard`, `Avatar`, `Divider`, `Accordion`, `Timeline`, `Chart`, `MoneyDisplay`, serta komponen domain POS, Floor, KDS, Inventory, Finance, Customer, dan Platform yang disebut di bagian 19.

### 21.2 Gap yang harus dibuat

| Prioritas | Komponen | Dibutuhkan oleh |
|---|---|---|
| P0 | `AppShell`, `ContextSwitcher`, `UserMenu` (bahasa + tema) | Semua halaman Backoffice |
| P0 | `PageHeader`, `FilterBar`, `Chip` | Semua halaman daftar |
| P0 | `ModuleAccessState`, `UsageLimitState` | Gating modul |
| P0 | `LanguageSwitcher` | Dua bahasa |
| P0 | `MultiSelect`, `FileUpload` | Filter, gambar produk, lampiran |
| P1 | `BottomNav`, `OrderCard`, `HeldOrderList`, `PinInput` | POS (`Receipt` selesai 3 Oktober 2026: kertas 58 mm, 80 mm, A4; hanya struk yang tercetak) |
| P1 | `AreaSelector`, `LiveTableView`, `TableSessionPanel`, bentuk meja | Floor |
| P1 | `StickyCartBar`, `OrderProgress` | Customer |
| P1 | Form ticket manual KDS | KDS-only |
| P2 | `LedgerRow`, form transaksi Finance | Finance |
| P2 | Seluruh komponen HC | HC |
| P2 | Package Builder, panel instalasi/binding | Platform Admin |
| P2 | Form penerimaan, transfer, pemasok | Inventory |

### 21.3 Penyesuaian komponen yang sudah ada

1. Nilai token di `tokens.css` dan `primitives.css` sudah diganti ke palet bagian 6 (2 Oktober 2026). Yang tersisa: memeriksa tampilan tiap komponen pada palet baru, satu per satu.
2. Ganti implementasi `AppIcon` ke Tabler dan ganti semua impor Lucide.
3. Keluarkan semua string UI dari komponen menjadi props.
4. `Card` diganti perannya oleh `Panel`; hapus sarang kartu pada komponen domain.
5. Hapus status `special`.
6. Selaraskan tinggi kontrol `md` dari 40px ke 36px.

---

## 22. Aksesibilitas, gerak, dan suara

- Kontras: teks normal ≥4,5:1; teks besar dan komponen penting ≥3:1; diuji pada kedua mode dan semua preset merchant.
- Semua fungsi dapat dicapai tanpa mouse; urutan tab mengikuti urutan visual; skip link pada Backoffice dan Platform Admin.
- Dialog menjebak fokus dan mengembalikannya ke pemicu.
- Drag-and-drop tata letak meja memiliki alternatif keyboard dan form.
- Status memakai teks + ikon + warna.
- Backoffice tetap dapat digunakan pada zoom 200%.
- Durasi gerak: 120ms untuk hover/fokus, 180ms untuk popover/menu, 240ms untuk dialog/sheet. `prefers-reduced-motion` dihormati. Status bahaya tidak berkedip.
- Suara KDS hanya untuk ticket baru dan kegagalan sambung ulang; volume dan bisu disimpan per perangkat; selalu ada padanan visual.

Ditunda: command palette, warna merchant bebas, font merchant, theme builder, editor denah bangunan.

---

## 23. Governance

### 23.1 Aturan kode

- Tidak ada warna mentah, radius, bayangan, atau jarak bebas di komponen fitur.
- Tidak membuat tombol, input, atau dialog versi fitur sendiri.
- Tidak memakai `<select>`, pemilih tanggal, atau dialog bawaan browser sebagai UI akhir.
- Tidak menulis string UI langsung di komponen.
- Menyembunyikan UI bukan otorisasi; backend tetap memvalidasi izin.

### 23.2 Definition of Done komponen

API jelas; variant dan ukuran yang dibutuhkan tersedia; terang dan gelap selesai; semua state interaksi selesai; keyboard dan pembaca layar benar; S/M/L selesai; teks panjang (`id` dan `en`), kosong, error, loading, dan disabled diuji; story tersedia; test lulus.

### 23.3 Checklist review halaman

- [ ] Judul ≤3 kata, tanpa paragraf deskripsi.
- [ ] Satu tombol utama.
- [ ] Tidak ada datum yang tampil dua kali.
- [ ] Tidak ada kartu di dalam kartu.
- [ ] Baris yang tidak berlaku dihilangkan, bukan nol.
- [ ] Semua teks berasal dari kamus `id` dan `en`.
- [ ] Semua ikon melalui `AppIcon`.
- [ ] State loading, kosong, error, izin, entitlement, setup, dan limit tersedia sesuai relevansi.
- [ ] S/M/L dan batas 320/767/768/1279/1280 lulus.
- [ ] Terang dan gelap lulus.
- [ ] Keyboard, fokus, dan target sentuh lulus.

### 23.4 Perubahan design system

Perubahan token atau kontrak komponen harus memperbarui dokumen ini, story terkait, dan lulus pemeriksaan terang/gelap serta aksesibilitas sebelum dipakai halaman.

---

## 24. Ringkasan keputusan

```text
Arah visual     : Calm Neutral
Palet           : monokrom (abu netral + tinta); warna hanya untuk status dan chart
Tema            : Light, Dark, System
Bahasa          : Indonesia (bawaan), Inggris
Font            : Geist Sans; Geist Mono terbatas
Ikon            : Tabler Icons melalui AppIcon
Chart           : ApexCharts melalui wrapper Chart
Grid dasar      : 4px
Radius bawaan   : 6px (token `sm`)
Tinggi kontrol  : 36px Backoffice, 48px sentuh
Responsive      : S 320–767 / M 768–1279 / L ≥1280
Aturan halaman  : judul saja, satu aksi utama, satu fakta satu lokasi
```

## 25. Sumber referensi

- Tabler Icons — https://tabler.io/icons
- ApexCharts — https://apexcharts.com/docs/
- next-intl (App Router) — https://next-intl.dev/docs/getting-started/app-router
- Geist — https://vercel.com/geist/introduction
- WCAG 2.2 — https://www.w3.org/TR/WCAG22/
- Tren UI SaaS 2026 — https://www.saasui.design/blog/7-saas-ui-design-trends-2026
- Contoh dashboard SaaS 2026 — https://www.925studios.co/blog/saas-dashboard-design-examples-2026
- Redesign Square Restaurant POS — https://community.squareup.com/t5/Product-Updates/-Restaurant-POS-redesign-coming-March-5/bc-p/715177
- Shopify POS (Polaris for Retail) — https://www.alekmackie.com/shopify-polaris-for-retail
- Perbandingan pustaka ikon 2026 — https://iconstash.io/articles/best-open-source-icon-libraries-2026/
