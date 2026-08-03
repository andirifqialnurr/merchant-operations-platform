# Design System — Merchant Operations Platform

**Status:** Sumber tunggal (single source of truth) untuk seluruh tampilan aplikasi
**Diturunkan dari:** referensi visual "Tasty Station" (Order Line, Manage Dishes, Manage Tables) + `feature-inventory.md`
**Tujuan dokumen ini:** mengunci token, pola layout, dan komponen agar AI coding agent **tidak mengarang** warna, spacing, radius, atau struktur baru di setiap fitur. Semua fitur di `feature-inventory.md` harus dibangun dari token dan pola di bawah ini — bukan sebaliknya.

> **Aturan dasar untuk agent:** kalau sebuah nilai (warna, radius, spacing, ukuran font, style badge) tidak ada di dokumen ini, JANGAN membuat nilai baru. Pilih token terdekat dari daftar di bawah, atau tanyakan. Ini yang mencegah desain "mengambang" — setiap layar harus bisa ditelusuri ke token yang sama.

---

## 1. Referensi visual

Tiga referensi berikut adalah kebenaran visual (ground truth) untuk gaya UI:

1. **Order Line / POS** — shell 3 kolom: sidebar navigasi, konten utama (filter + grid menu), panel ringkasan order di kanan.
2. **Manage Dishes** — shell 2 kolom: sidebar kategori, konten utama grid produk dengan checkbox seleksi.
3. **Manage Tables** — shell 2 kolom: daftar reservasi/list di kiri, canvas layout meja di kanan dengan legend status.

Karakter visual yang konsisten di ketiganya:

- Frame aplikasi mengambang di atas background teal gelap, dengan sudut sangat membulat (rounded, seperti kartu besar).
- Sidebar putih bersih, item aktif memakai pill/pastel background dengan teks & ikon teal.
- Badge/status selalu berbentuk pill dengan warna pastel lembut + teks warna solid yang senada (bukan warna tajam/neon).
- Foto produk selalu bulat (circle), diletakkan di atas lingkaran pastel berwarna (mint, peach, biru muda, lavender) yang berganti-ganti tanpa pola tetap.
- Ikon bergaya outline/line, tipis, konsisten (setara Lucide icon set).
- Tombol utama (primary) selalu solid teal, rounded-full atau rounded-lg, dengan ikon opsional di kiri teks.
- Tipografi tegas untuk angka (harga, jumlah, waktu) — bold dan mudah dipindai.

---

## 2. Design tokens

### 2.1 Warna — brand & netral

| Token | Hex | Pemakaian |
|---|---|---|
| `color-brand-700` | `#0F766E` | Background frame luar aplikasi (lihat §2.3), header gelap jika ada |
| `color-brand-600` | `#0D9488` | Primary button, active nav icon/text, border aktif pada tab/chip |
| `color-brand-500` | `#14B8A6` | Hover state primary, ikon aksen |
| `color-brand-100` | `#CCFBF1` | Background pill nav aktif, background chip aktif, highlight ringan |
| `color-brand-50` | `#F0FDFA` | Background halus untuk section aktif/hover row |
| `color-surface` | `#FFFFFF` | Card, sidebar, panel, modal |
| `color-page-bg` | `#F7F8FA` | Background konten di dalam frame (di belakang card) |
| `color-border` | `#E5E7EB` | Border card, divider, input border |
| `color-text-primary` | `#1F2937` | Judul, nama item, isi penting |
| `color-text-secondary` | `#6B7280` | Label kecil, kategori, subtitle |
| `color-text-muted` | `#9CA3AF` | Placeholder, timestamp sekunder, disabled |

### 2.2 Warna — status semantic (WAJIB, hanya 5 bucket ini)

Semua status di seluruh aplikasi (order, payment, table, KDS, stock, subscription, tenant, audit — lihat §18.5 `feature-inventory.md`) **harus** dipetakan ke salah satu dari 5 bucket semantic berikut. Jangan membuat warna status baru di luar bucket ini.

| Bucket | Background | Text/Icon | Makna umum |
|---|---|---|---|
| `status-neutral` | `#F3F4F6` | `#4B5563` | draft, inactive, belum dimulai, default |
| `status-info` | `#EDE9FE` (lavender) | `#7C3AED` | sedang diproses, ready, on dine, dalam antrian lanjutan |
| `status-success` | `#D1FAE5` (mint) | `#059669` | completed, paid, available, in kitchen/accepted, online |
| `status-warning` | `#FFEDD5` (peach) | `#EA580C` | wait list, reserved, unpaid/verifying, low stock, grace, stale |
| `status-danger` | `#FEE2E2` | `#DC2626` | cancelled, rejected, suspended/terminated, out of stock, expired/failed, offline |

**Tabel pemetaan status → bucket (gunakan persis ini, jangan ubah per-fitur):**

| Domain | Status | Bucket |
|---|---|---|
| Order | draft | neutral |
| Order | submitted / accepted | info |
| Order | preparing | info |
| Order | ready | info |
| Order | served | success |
| Order | completed | success |
| Order | cancelled | danger |
| Payment | unpaid | warning |
| Payment | verifying | warning |
| Payment | paid | success |
| Payment | refund pending | warning |
| Payment | refunded | neutral |
| Payment | expired / failed | danger |
| Table | available | success |
| Table | occupied / on dine | info |
| Table | reserved / closing | warning |
| Table | inactive | neutral |
| KDS | new | warning |
| KDS | accepted / preparing | info |
| KDS | ready | success |
| KDS | served / completed | neutral |
| Stock | ok | success |
| Stock | low | warning |
| Stock | out | danger |
| Stock | adjustment / waste / transfer | neutral |
| Connection | online | success |
| Connection | connecting / reconnecting | warning |
| Connection | offline / stale | danger |
| Subscription | trial | info |
| Subscription | active | success |
| Subscription | grace | warning |
| Subscription | suspended / terminated | danger |
| Audit | pending approval | warning |
| Audit | approved | success |
| Audit | rejected / blocked | danger |

### 2.3 Warna — aksen pastel dekoratif (khusus lingkaran foto produk)

Dipakai bergantian (rotate) hanya di belakang foto bundar produk/menu, tidak untuk status:

`#FDE9E0` (peach), `#DCFCE7` (mint), `#DBEAFE` (biru muda), `#EDE9FE` (lavender), `#FEF3C7` (kuning lembut).

### 2.4 Radius

| Token | Nilai | Pemakaian |
|---|---|---|
| `radius-sm` | 8px | input, chip kecil |
| `radius-md` | 12px | card produk, baris tabel, tombol standar |
| `radius-lg` | 16px | card besar, panel, modal |
| `radius-xl` | 24px | frame aplikasi luar, shell utama |
| `radius-full` | 999px | badge, pill tab, avatar, tombol primary utama, search bar |

### 2.5 Spacing (basis 4px)

`space-1` 4px · `space-2` 8px · `space-3` 12px · `space-4` 16px · `space-5` 20px · `space-6` 24px · `space-8` 32px.

Aturan: padding card = `space-4`–`space-5`. Gap antar card grid = `space-4`. Padding shell utama = `space-6`. Jangan pakai nilai spacing di luar skala ini.

### 2.6 Elevation / shadow

| Token | Deskripsi |
|---|---|
| `shadow-frame` | shadow lembut besar untuk frame aplikasi terhadap background teal (blur besar, opacity rendah) |
| `shadow-card` | shadow tipis untuk card di dalam konten (blur kecil, hampir flat) |
| `shadow-modal` | shadow lebih tegas untuk dialog/drawer di atas overlay gelap |

Card di dalam list/grid pada dasarnya **flat dengan border tipis** (`color-border`), bukan shadow berat. Shadow berat hanya untuk frame terluar dan modal.

### 2.7 Tipografi

| Role | Font family | Pemakaian |
|---|---|---|
| Display/Heading | Geometric rounded sans (mis. Plus Jakarta Sans / Poppins) | Judul halaman, nama brand, angka besar |
| Body/UI | Inter (atau setara) | Label, isi form, teks tabel |
| Numeric/mono-tabular | Inter tabular-nums | Harga, waktu, jumlah stok — supaya rata kanan rapi |

**Skala:**

| Token | Ukuran | Weight | Pemakaian |
|---|---|---|---|
| `text-h1` | 24px | 700 | Judul halaman ("Order Line", "Manage Dishes") |
| `text-h2` | 18px | 600 | Judul section/panel |
| `text-body` | 14px | 500 | Isi utama, nama item |
| `text-label` | 12px | 500 | Label kategori kecil, caption |
| `text-price` | 16px | 700 | Harga, total |
| `text-micro` | 11px | 500 | Timestamp, badge count |

### 2.8 Ikonografi

Ikon outline, stroke 1.5–2px, ukuran 20–24px, satu keluarga ikon konsisten di seluruh aplikasi (setara Lucide). Jangan mencampur gaya filled dan outline dalam satu shell.

---

## 3. Shell / layout pattern per surface

Setiap surface di `feature-inventory.md` **wajib** memakai salah satu shell berikut — tidak membuat struktur baru.

### 3.1 Merchant Backoffice Shell (POS, Manage Dishes, Manage Tables, Customers, Dashboard, Settings)

Referensi: ketiga gambar.

```
┌───────────────────────────────────────────────────────────────┐
│  [teal outer frame, radius-xl, shadow-frame]                  │
│  ┌───────────┬───────────────────────────────┬──────────────┐ │
│  │  Sidebar  │        Main content           │  Context     │ │
│  │  (fixed   │  Topbar (search + notif+user) │  panel       │ │
│  │   ~220px) │  Page title + filter tabs     │  (opsional,  │ │
│  │  Logo     │  Grid / list content           │  fixed ~320px)│ │
│  │  Nav item │                                │              │ │
│  │  (active  │                                │              │ │
│  │  = pill)  │                                │              │ │
│  │  Settings │                                │              │ │
│  │  Help     │                                │              │ │
│  │  Logout   │                                │              │ │
│  └───────────┴───────────────────────────────┴──────────────┘ │
└───────────────────────────────────────────────────────────────┘
```

- Sidebar: logo + nama brand di atas; grup nav utama; grup sekunder (Settings, Help Center, Logout) menempel di bawah, dipisah jarak besar dari nav utama.
- Item nav aktif: background `color-brand-100`, radius-full, teks & ikon `color-brand-600`. Item non-aktif: teks `color-text-secondary`, tanpa background.
- Topbar: search bar full pill (`radius-full`, border tipis, ikon kaca pembesar), notifikasi (ikon lonceng + dot), avatar bulat + nama + role kecil di kanan.
- Context panel kanan **hanya muncul jika surface butuh ringkasan transaksi/objek aktif** (contoh: POS butuh ringkasan order; Manage Dishes tidak butuh, jadi 2 kolom saja).
- Entitlement-aware: item nav untuk module yang tidak aktif di paket tenant tetap tampil tapi locked (ikon gembok kecil, opacity turun, klik → upgrade prompt), **jangan disembunyikan total** kecuali module memang tidak pernah relevan untuk peran user tsb.

### 3.2 POS Shell (device mode: POS)

Turunan dari 3.1 dengan context panel kanan wajib berisi: header objek (meja/nomor order), daftar item, ringkasan pembayaran, metode pembayaran, dan tombol aksi utama menempel di bawah panel (bukan mengambang di tengah). Grid produk di tengah harus tetap terlihat penuh tanpa scroll horizontal tersembunyi — gunakan kategori chip di atas grid untuk filter.

### 3.3 KDS Kiosk Shell (device mode: KDS)

Full-screen, tanpa sidebar navigasi standar (hanya header tipis berisi nama outlet, status koneksi, dan tab riwayat hari berjalan). Konten utama: grid ticket besar, touch-target minimum 44px, tipografi lebih besar dari shell backoffice (`text-h2` naik jadi basis ticket title). Warna status ticket memakai bucket §2.2 (KDS). Alert tiket baru: highlight border kiri tebal warna `status-warning`, bukan mengganti seluruh background card.

### 3.4 Platform Admin Shell (platform-only)

Turunan dari 3.1 tapi **tanpa context panel kanan**, dan sidebar/topbar diberi penanda visual berbeda (mis. brand mark platform, bukan logo tenant) agar tidak tertukar dengan sesi merchant. Konten utama memakai pola data table dense (lihat §4.6), bukan grid kartu besar seperti merchant.

### 3.5 Customer Mobile Self-Order Shell

Single column, mobile-first, tanpa sidebar. Header sticky berisi nama outlet/label meja publik + status buka/tutup. Urutan: header → kategori chip horizontal scroll → list menu (card horizontal: foto bulat kiri, nama+harga kanan) → cart bar sticky di bawah (ringkasan jumlah item + total + tombol lanjut, memakai gaya tombol primary yang sama dengan desktop).

---

## 4. Komponen inti

### 4.1 Sidebar nav item

- Height ~44px, padding horizontal `space-4`, radius-full saat aktif.
- Ikon 20px + label `text-body`.
- Badge angka kecil (jika ada notifikasi) di ujung kanan item, pill kecil `status-info` atau `status-danger` sesuai konteks.

### 4.2 Topbar search

- Pill penuh (`radius-full`), background `color-page-bg` atau putih dengan border tipis, ikon search di kiri, placeholder `color-text-muted`.

### 4.3 Filter tab / pill tab (contoh: All, Dine in, Wait List, Take Away, Served)

- Bentuk pill, border tipis saat non-aktif; saat aktif: border/fill `color-brand-600`, teks putih atau `color-brand-600` di atas `color-brand-100`.
- Count di dalam tab ditampilkan sebagai angka kecil dalam badge bulat kontras di ujung label.

### 4.4 Kategori chip (contoh: All Menu, Special, Soups, Desserts)

- Card kecil rounded (`radius-md`), ikon bulat di atas nama kategori, jumlah item di bawah nama sebagai `text-micro` abu-abu.
- State aktif: border 2px `color-brand-600`.

### 4.5 Product / dish card

- Foto bulat di atas lingkaran pastel (§2.3), rasio konsisten.
- Label kategori kecil (`text-label`, `color-text-secondary`) di atas nama produk.
- Nama produk `text-body` bold.
- Harga `text-price` kiri bawah, quantity stepper (`− angka +`) kanan bawah dalam pill kecil.
- Saat sold-out: overlay abu-abu pada foto + badge `status-danger` "Habis", stepper disabled.
- Checkbox seleksi (mode manage) muncul di pojok kiri atas card, tidak menimpa foto.

### 4.6 Data table dense (admin/backoffice)

- Header sticky, teks `text-label` uppercase tipis, row height ~48px, zebra opsional halus (`color-page-bg` selang-seling).
- Status ditampilkan sebagai badge pill (§2.2), bukan teks polos berwarna.
- Aksi row (edit/hapus) sebagai ikon outline di ujung kanan, muncul jelas (bukan hover-only) untuk konsistensi touch.

### 4.7 Order/reservation card (list ringkas, lihat Order Line & Manage Tables)

- Background pastel sesuai bucket status (§2.2), radius-md, padding `space-4`.
- Baris atas: identifier + badge status pill di kanan.
- Baris tengah: ringkasan item/tamu.
- Baris bawah: metadata waktu (`text-micro`, `color-text-secondary`).

### 4.8 Context/summary panel (kanan, POS)

- Header objek (contoh "Table No #04") dengan ikon edit & hapus outline di kanan judul.
- List item: nama kiri, harga kanan, rata dengan `text-price`.
- Divider tipis sebelum ringkasan pembayaran (subtotal/tax/lainnya/total). Total selalu bold, ukuran lebih besar dari baris lain.
- Payment method selector: chip horizontal, satu aktif dengan border `color-brand-600`.
- Tombol aksi utama menempel di bagian paling bawah panel: tombol sekunder outline (mis. "Print") + tombol primary solid teal (mis. "Place Order") berdampingan, primary selalu di kanan dan lebih lebar.

### 4.9 Table layout canvas (Manage Tables)

- Legend warna di atas canvas memakai bucket §2.2 (available=success, reserved=warning, on dine=info) — konsisten dengan status vocabulary global, bukan warna custom per halaman.
- Table tile: rounded-md, warna fill sesuai bucket status, nomor meja bold + kapasitas kecil di bawahnya, ikon kursi di sekeliling tile merepresentasikan jumlah kapasitas.
- Interaksi drag hanya mengubah posisi grid (lihat data guard §5), tile tidak menampilkan ID internal apa pun — hanya label meja publik dan status.

### 4.10 Button

| Varian | Style |
|---|---|
| Primary | Solid `color-brand-600`, teks putih, radius-full atau radius-md, ikon opsional kiri |
| Secondary/outline | Border `color-border`, teks `color-text-primary`, background putih |
| Destructive | Solid/outline `status-danger`, dipakai hanya untuk aksi void/cancel/hapus, selalu didahului dialog konfirmasi |
| Ghost/icon-only | Tanpa border/background, dipakai untuk aksi sekunder di dalam card (edit, delete kecil) |

### 4.11 Dialog konfirmasi & approval

- Modal ringkas: judul aksi, deskripsi singkat, field alasan (jika void/refund/adjustment), tombol batal (outline) + tombol konfirmasi (primary/destructive sesuai konteks).
- Wajib untuk: void/cancel, refund, stock adjustment, deaktivasi tenant/brand/outlet, approval manager.

### 4.12 Empty / loading / error / stale state

- Empty: ikon outline besar pastel + judul singkat + CTA jika relevan (mis. "+ Add New Dishes").
- Loading: skeleton dengan bentuk radius yang sama seperti komponen asli (bukan spinner generik penuh layar, kecuali initial app load).
- Error/stale: banner tipis di atas konten, bucket `status-warning`/`status-danger`, dengan aksi retry.

---

## 5. Data guard yang tampak di UI

Terapkan pada setiap komponen di atas (turunan langsung dari `feature-inventory.md` §18.6):

- ID internal (tenant/outlet/order/table/session/actor/audit) **tidak pernah** menjadi teks yang terlihat user — hanya dipakai sebagai `data-id`/callback.
- Token/QR mentah, session, payment provider payload, dan audit payload tidak dirender sebagai teks di komponen manapun.
- Harga/HPP/margin hanya muncul di surface Finance/Inventory yang berhak; tidak bocor ke POS customer-facing, KDS, atau storefront publik.
- Status, timestamp, actor, total, dan calculated value (HPP, saldo, elapsed time) selalu **read-only display** atau **derived display** — tidak dijadikan input form kecuali workflow memang berupa mutasi eksplisit (lihat kolom aksi di §4.11).
- Field estimasi (Finance Basic) wajib diberi label kecil "estimasi" di dekat angka, memakai `text-label` + `color-text-secondary`.

---

## 6. Aturan anti-drift untuk AI agent

1. **Jangan membuat warna hex baru.** Kalau butuh warna yang "mirip tapi beda", cek ulang §2.1–2.3 dulu — hampir pasti sudah ada token yang cocok.
2. **Jangan membuat radius/spacing baru.** Bulatkan ke skala terdekat di §2.4–2.5.
3. **Satu status = satu bucket.** Kalau status baru muncul di fitur baru, petakan dulu ke salah satu dari 5 bucket §2.2, jangan buat warna status ke-6.
4. **Satu shell per jenis surface.** Sebelum membuat halaman baru, tentukan dulu ini termasuk shell 3.1/3.2/3.3/3.4/3.5 yang mana — jangan merancang struktur kolom baru dari nol.
5. **Komponen dulu, JSX fitur kemudian.** Cek §4 apakah komponen yang dibutuhkan sudah ada polanya sebelum menulis markup baru.
6. **Data guard bukan opsional.** Setiap kali menampilkan field baru, klasifikasikan dulu: user input / read-only display / derived display / hidden — sesuai §5.
7. **Konsistensi ikon dan foto.** Satu keluarga ikon (§2.8), satu pola lingkaran pastel untuk foto produk (§2.3) — jangan campur gaya foto persegi dan bulat dalam satu shell.
8. **Kalau ragu, pilih pola dari 3 referensi gambar**, bukan pola generik dashboard admin kebanyakan.

---

## 7. Checklist sebelum membangun layar baru

- [ ] Sudah tentukan shell (§3) yang dipakai.
- [ ] Sudah tentukan komponen dari §4 yang relevan, bukan komponen baru.
- [ ] Semua warna, radius, spacing memakai token §2.
- [ ] Semua status sudah dipetakan ke salah satu bucket §2.2 (tambahkan ke tabel pemetaan jika status benar-benar baru).
- [ ] Semua field sudah diklasifikasi sesuai §5 (data guard).
- [ ] Empty/loading/error/stale state sudah disiapkan (§4.12).
- [ ] Untuk aksi sensitif (void, refund, adjustment, deaktivasi): dialog konfirmasi §4.11 terpasang.
- [ ] Untuk module locked/paket tidak aktif: state locked sesuai §3.1, bukan disembunyikan diam-diam.
