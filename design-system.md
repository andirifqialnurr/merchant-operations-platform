# Design System - Merchant Operations Platform

**Status:** Source of truth visual Version 1  
**Tanggal:** 14 Juli 2026  
**Tema:** Calm Commerce / Operational Teal  
**Mode:** Light, Dark, dan System  
**Font utama:** Geist Sans  
**Font teknis:** Geist Mono  
**Target aksesibilitas:** WCAG 2.2 Level AA

## 1. Tujuan dokumen

Dokumen ini menjadi kontrak visual dan interaksi untuk seluruh aplikasi sebelum komponen dan halaman mulai dibuat. Semua implementasi UI pada POS, KDS, backoffice merchant, inventory, finance, customer self-order, dan platform super-admin harus mengikuti dokumen ini.

Urutan sumber keputusan UI adalah:

```text
design-system.md
-> design token
-> komponen packages/ui
-> komponen domain
-> halaman fitur
```

Halaman fitur tidak boleh membuat warna, ukuran, radius, shadow, atau pola kontrol sendiri jika kebutuhan tersebut sudah tercakup di design system.

Dokumen ini mengatur:

- Arah visual dan prinsip desain.
- Light mode, dark mode, dan merchant branding.
- Font, tipografi, angka, ikon, spacing, radius, dan elevation.
- Ukuran, variant, state, serta perilaku komponen UI.
- Komponen domain POS, KDS, inventory, finance, dan customer ordering.
- Responsive layout, touch target, accessibility, motion, dan content style.
- Struktur implementasi dan aturan agar UI tidak menyimpang.

## 2. Karakter desain

Nama arah visual adalah **Calm Commerce** dengan palet **Operational Teal**.

Karakter yang ingin dicapai:

- Tenang: tidak menggunakan terlalu banyak warna kuat pada satu layar.
- Cepat: tindakan utama dan status mudah ditemukan tanpa membaca panjang.
- Operasional: tabel, angka, pesanan, dan stok lebih penting daripada dekorasi.
- Tepercaya: transaksi dan perubahan status selalu memberikan feedback jelas.
- Fleksibel: tidak terlalu identik dengan kafe agar cocok untuk retail dan UMKM lain.
- Custom: komponen memiliki visual milik platform, bukan tampilan bawaan browser atau library.
- Accessible: keyboard, screen reader, touch, dan contrast dipertimbangkan sejak komponen dasar.

Yang harus dihindari:

- Cokelat sebagai warna inti karena terlalu mengikat produk ke kafe.
- Gradient dekoratif pada aplikasi operasional.
- Card di dalam card tanpa kebutuhan hierarki yang nyata.
- Shadow besar pada semua surface.
- Radius pill pada semua elemen.
- Warna sebagai satu-satunya penanda status.
- Kontrol native browser yang tampil berbeda antarperangkat.
- Ukuran teks kecil untuk mengejar kepadatan.

## 3. Surface aplikasi

Design system yang sama digunakan oleh semua surface, tetapi density dan pola interaksinya berbeda.

| Surface | Pengguna | Density | Input utama | Karakter |
|---|---|---:|---|---|
| POS | Kasir/waiter | Medium | Touch, mouse, keyboard | Cepat, produk dan cart dominan |
| KDS | Dapur | Low | Touch | Terbaca dari jarak, sedikit navigasi |
| Backoffice | Owner/manager | Medium-high | Mouse, keyboard, touch | Data, form, dan tabel |
| Inventory | Inventory staff | Medium-high | Mouse, keyboard, scanner | Stok dan perubahan kuantitas |
| Finance | Owner/finance | High | Mouse, keyboard | Angka, filter, dan rekonsiliasi |
| Customer ordering | Guest | Low | Touch | Mobile-first, satu CTA utama |
| Platform admin | Super admin | High | Mouse, keyboard | Tenant, entitlement, audit |

Satu komponen boleh memiliki density berbeda, tetapi nama variant dan perilakunya harus konsisten.

## 4. Arsitektur token

Token dibagi menjadi empat lapisan.

```text
Primitive token
    -> Semantic token light/dark
        -> Component token
            -> Domain component
```

### 4.1 Primitive token

Primitive berisi nilai mentah seperti `teal-700` atau `slate-900`. Primitive tidak boleh digunakan langsung oleh halaman fitur.

### 4.2 Semantic token

Semantic menjelaskan fungsi, misalnya:

```text
--color-bg-canvas
--color-bg-surface
--color-text-primary
--color-border-default
--color-action-primary
--color-status-danger
```

Semantic token memiliki nilai berbeda pada light dan dark mode.

### 4.3 Component token

Component token hanya dibuat jika sebuah komponen membutuhkan kontrak khusus, misalnya:

```text
--button-primary-bg
--input-border-focus
--kds-ticket-ready-accent
--table-header-bg
```

Component token harus merujuk semantic token, bukan mengulang warna mentah.

### 4.4 Merchant brand override

Override merchant hanya berlaku pada Cafe Profile dan customer self-order. POS, KDS, inventory, finance, backoffice, serta platform admin tidak mengikuti warna merchant.

## 5. Primitive color palette

### 5.1 Operational Teal

| Token | Hex |
|---|---:|
| `teal-50` | `#F0FDFA` |
| `teal-100` | `#CCFBF1` |
| `teal-200` | `#99F6E4` |
| `teal-300` | `#5EEAD4` |
| `teal-400` | `#2DD4BF` |
| `teal-500` | `#14B8A6` |
| `teal-600` | `#0D9488` |
| `teal-700` | `#0F766E` |
| `teal-800` | `#115E59` |
| `teal-900` | `#134E4A` |
| `teal-950` | `#042F2E` |

### 5.2 Slate neutral

| Token | Hex |
|---|---:|
| `white` | `#FFFFFF` |
| `slate-50` | `#F8FAFC` |
| `slate-100` | `#F1F5F9` |
| `slate-200` | `#E2E8F0` |
| `slate-300` | `#CBD5E1` |
| `slate-400` | `#94A3B8` |
| `slate-500` | `#64748B` |
| `slate-600` | `#475569` |
| `slate-700` | `#334155` |
| `slate-800` | `#1E293B` |
| `slate-900` | `#0F172A` |
| `slate-950` | `#020617` |

### 5.3 Semantic primitive

| Fungsi | Skala utama |
|---|---|
| Information | Blue |
| Success | Green |
| Warning | Amber |
| Danger | Red |
| Special/refund | Violet |

Palet semantic tidak digunakan sebagai warna dekoratif atau pembeda kategori produk.

## 6. Semantic theme

### 6.1 Light mode

| Semantic token | Nilai | Penggunaan |
|---|---:|---|
| `bg.canvas` | `#F8FAFC` | Latar aplikasi |
| `bg.surface` | `#FFFFFF` | Panel dan card |
| `bg.surfaceSubtle` | `#F1F5F9` | Header tabel, filter, area sekunder |
| `bg.surfaceRaised` | `#FFFFFF` | Dialog, popover, dropdown |
| `bg.surfaceInverse` | `#0F172A` | Tooltip dan inverse surface |
| `bg.overlay` | `rgba(15,23,42,.48)` | Overlay dialog/drawer |
| `text.primary` | `#0F172A` | Judul dan isi utama |
| `text.secondary` | `#475569` | Deskripsi dan metadata |
| `text.muted` | `#64748B` | Helper text |
| `text.disabled` | `#94A3B8` | Kontrol disabled |
| `text.inverse` | `#FFFFFF` | Teks inverse |
| `border.subtle` | `#E2E8F0` | Divider |
| `border.default` | `#CBD5E1` | Input dan card |
| `border.control` | `#64748B` | Batas kontrol interaktif |
| `border.strong` | `#475569` | Hover/selected neutral |
| `action.primary` | `#0F766E` | CTA utama |
| `action.primaryHover` | `#115E59` | Hover CTA |
| `action.primaryPressed` | `#134E4A` | Pressed CTA |
| `action.onPrimary` | `#FFFFFF` | Teks pada CTA |
| `action.primarySubtle` | `#CCFBF1` | Active menu/background |
| `focus.ring` | `#0D9488` | Focus indicator |

### 6.2 Dark mode

Dark mode memakai navy-slate, bukan hitam murni. Surface dibedakan dengan luminance dan border, bukan shadow berat.

| Semantic token | Nilai | Penggunaan |
|---|---:|---|
| `bg.canvas` | `#0B1120` | Latar aplikasi |
| `bg.surface` | `#111827` | Panel dan card |
| `bg.surfaceSubtle` | `#182235` | Header tabel, filter, area sekunder |
| `bg.surfaceRaised` | `#1E293B` | Dialog, popover, dropdown |
| `bg.surfaceInverse` | `#F8FAFC` | Inverse surface |
| `bg.overlay` | `rgba(2,6,23,.72)` | Overlay dialog/drawer |
| `text.primary` | `#F8FAFC` | Judul dan isi utama |
| `text.secondary` | `#CBD5E1` | Deskripsi dan metadata |
| `text.muted` | `#94A3B8` | Helper text |
| `text.disabled` | `#64748B` | Kontrol disabled |
| `text.inverse` | `#0F172A` | Teks inverse |
| `border.subtle` | `#253247` | Divider |
| `border.default` | `#334155` | Input dan card |
| `border.control` | `#64748B` | Batas kontrol interaktif |
| `border.strong` | `#94A3B8` | Hover/selected neutral |
| `action.primary` | `#2DD4BF` | CTA utama |
| `action.primaryHover` | `#5EEAD4` | Hover CTA |
| `action.primaryPressed` | `#14B8A6` | Pressed CTA |
| `action.onPrimary` | `#042F2E` | Teks pada CTA |
| `action.primarySubtle` | `#134E4A` | Active menu/background |
| `focus.ring` | `#5EEAD4` | Focus indicator |

### 6.3 Status light dan dark

| Status | Light text/bg | Dark text/bg |
|---|---|---|
| Info | `#1D4ED8` / `#EFF6FF` | `#93C5FD` / `#172554` |
| Success | `#15803D` / `#F0FDF4` | `#86EFAC` / `#052E16` |
| Warning | `#B45309` / `#FFFBEB` | `#FCD34D` / `#451A03` |
| Danger | `#B91C1C` / `#FEF2F2` | `#FCA5A5` / `#450A0A` |
| Special | `#6D28D9` / `#F5F3FF` | `#C4B5FD` / `#2E1065` |

Setiap status harus memiliki label teks. Icon dan warna hanya mempercepat pengenalan.

### 6.4 Theme behavior

Pilihan tema:

- `Light`.
- `Dark`.
- `System` mengikuti `prefers-color-scheme`.

Penyimpanan tema:

- POS dan KDS: per perangkat.
- Backoffice dan platform admin: per user.
- Customer ordering: mengikuti system, dengan toggle opsional jika diperlukan.
- Theme tidak ditentukan tenant secara global.

Perubahan tema tidak boleh me-refresh halaman atau menghilangkan draft cart/form.

## 7. Merchant branding

Version 1 mengizinkan pada public storefront:

- Logo merchant.
- Banner/cover.
- Nama, deskripsi, alamat, dan jam buka.
- Pilihan warna brand dari preset yang sudah lolos contrast.

Preset awal:

| Preset | Light primary/on-primary | Dark primary/on-primary |
|---|---|---|
| Teal | `#0F766E` / `#FFFFFF` | `#2DD4BF` / `#0F172A` |
| Blue | `#1D4ED8` / `#FFFFFF` | `#60A5FA` / `#0F172A` |
| Indigo | `#4338CA` / `#FFFFFF` | `#818CF8` / `#0F172A` |
| Violet | `#6D28D9` / `#FFFFFF` | `#A78BFA` / `#0F172A` |
| Rose | `#BE123C` / `#FFFFFF` | `#FB7185` / `#0F172A` |
| Orange | `#C2410C` / `#FFFFFF` | `#FB923C` / `#0F172A` |

Seluruh pasangan preset di atas memiliki contrast teks di atas `4.5:1`. Nilai on-primary merupakan bagian token preset dan tidak dipilih bebas oleh halaman.

Aturan:

- Merchant primary tidak mengganti success, warning, atau danger.
- Sistem menentukan warna teks aman di atas brand color.
- Arbitrary hex ditunda sampai contrast validation tersedia.
- Font custom merchant tidak termasuk Version 1.
- Logo tidak boleh mengganti nama atau label tombol.

## 8. Typography

### 8.1 Font family

```text
UI utama       : Geist Sans
Fallback       : Inter, system sans-serif
Teknis terbatas: Geist Mono
```

Font diambil dari package resmi `geist` dan dibundel bersama aplikasi. Tidak memakai runtime font CDN.

```css
font-family: var(--font-geist-sans), Inter, ui-sans-serif, system-ui, sans-serif;
```

Geist Mono hanya untuk API key, device identifier, request ID, dan teks teknis. Nominal, nomor pesanan, nomor meja, serta timer tetap menggunakan Geist Sans dengan tabular numbers.

### 8.2 Font weight

| Token | Weight | Penggunaan |
|---|---:|---|
| `regular` | 400 | Body |
| `medium` | 500 | Label, button, table header |
| `semibold` | 600 | Heading dan total penting |
| `bold` | 700 | Display dan penekanan terbatas |

Weight 300 tidak digunakan karena terlalu tipis pada dark mode. Weight 800-900 tidak digunakan pada aplikasi operasional.

### 8.3 Type scale

| Token | Size/line-height | Weight default | Penggunaan |
|---|---:|---:|---|
| `caption-xs` | `11/16px` | 500 | Label sangat terbatas, bukan body |
| `caption` | `12/16px` | 400 | Metadata, helper, timestamp |
| `body-sm` | `13/18px` | 400 | Dense table opsional |
| `body` | `14/20px` | 400 | Default backoffice |
| `body-lg` | `16/24px` | 400 | Customer, form touch, detail |
| `label` | `14/20px` | 500 | Form label dan button |
| `heading-sm` | `16/24px` | 600 | Card/section kecil |
| `heading` | `18/26px` | 600 | Section utama |
| `heading-lg` | `20/28px` | 600 | Halaman compact |
| `title` | `24/32px` | 600 | Judul halaman |
| `display-sm` | `28/36px` | 650 | Total POS, timer KDS |
| `display` | `32/40px` | 700 | Hero/angka sangat penting |

Teks `11px` hanya untuk metadata nonkritis. Teks interaktif dan body tidak boleh lebih kecil dari `13px`.

### 8.4 Numeric typography

Gunakan `font-variant-numeric: tabular-nums` untuk:

- Harga dan total.
- Quantity dan saldo stok.
- Timer KDS.
- Nomor antrean.
- Cash variance.
- Seluruh kolom laporan keuangan.

Nominal selalu rata kanan di tabel. Gunakan format Indonesia, misalnya `Rp50.000`, bukan `Rp 50,000.00`.

### 8.5 Tracking

| Style | Letter spacing |
|---|---:|
| Display/title | `-0.02em` |
| Heading | `-0.01em` |
| Body/label/button | `0` |
| Caption | `0.01em` |

Uppercase penuh hanya untuk kode teknis atau label sangat pendek. Judul dan tombol memakai sentence case.

## 9. Spacing, sizing, radius, dan shadow

### 9.1 Spacing scale

Base grid adalah `4px`.

| Token | Nilai |
|---|---:|
| `0` | `0` |
| `0.5` | `2px` |
| `1` | `4px` |
| `1.5` | `6px` |
| `2` | `8px` |
| `3` | `12px` |
| `4` | `16px` |
| `5` | `20px` |
| `6` | `24px` |
| `8` | `32px` |
| `10` | `40px` |
| `12` | `48px` |
| `16` | `64px` |
| `20` | `80px` |

Default gap kontrol adalah `8px`; gap field `16px`; gap section `24-32px`.

### 9.2 Control height

| Size | Tinggi | Penggunaan |
|---|---:|---|
| `xs` | `28px` | Badge control/dense table action |
| `sm` | `32px` | Toolbar desktop compact |
| `md` | `40px` | Default backoffice |
| `lg` | `48px` | POS, customer, touch form |
| `xl` | `56px` | CTA mobile utama/kiosk |

`xs` dan `sm` tidak digunakan untuk CTA pada touchscreen. Area klik icon kecil tetap harus memenuhi target minimum melalui padding wrapper.

### 9.3 Radius

| Token | Nilai | Penggunaan |
|---|---:|---|
| `none` | `0` | Table edge tertentu |
| `xs` | `4px` | Badge kecil |
| `sm` | `6px` | Dense control |
| `md` | `8px` | Input, button, card default |
| `lg` | `12px` | Product card, ticket, panel |
| `xl` | `16px` | Dialog, drawer, customer hero |
| `full` | `9999px` | Status badge, avatar |

### 9.4 Shadow

| Token | Nilai/penggunaan |
|---|---|
| `none` | Default panel dan table |
| `xs` | Hover card interaktif |
| `sm` | Sticky cart/topbar |
| `md` | Dropdown/popover |
| `lg` | Dialog/drawer |

Dark mode lebih mengandalkan border daripada shadow. Shadow tidak boleh menjadi satu-satunya batas surface.

## 10. Iconography

Gunakan satu keluarga ikon: **Lucide Icons**.

| Size | Nilai | Penggunaan |
|---|---:|---|
| `xs` | `14px` | Badge/caption |
| `sm` | `16px` | Dense control |
| `md` | `20px` | Default UI |
| `lg` | `24px` | Touch/POS/customer |
| `xl` | `32px` | Empty state atau status besar |

Aturan:

- Stroke default `1.75-2px`.
- Ikon mengikuti current color, bukan raw hex.
- Critical action selalu memiliki label teks.
- Icon-only button harus memiliki accessible name dan tooltip.
- Emoji tidak dipakai sebagai ikon UI.
- Logo provider pembayaran adalah asset brand, bukan pengganti ikon sistem.

## 11. Kontrak umum komponen

Semua komponen interaktif minimal memiliki state berikut:

```text
default
hover
focus-visible
active/pressed
disabled
loading bila menjalankan proses
error/invalid bila menerima input
```

Aturan state:

- Hover tidak boleh menjadi satu-satunya cara menemukan fungsi.
- Focus memakai ring `2px` dan offset `2px` yang terlihat pada light serta dark mode.
- Disabled mengurangi emphasis, tetapi label tetap terbaca. Disabled bukan pengganti permission check.
- Loading mempertahankan lebar komponen agar layout tidak bergeser.
- Tombol loading tidak dapat diklik ulang dan tetap menampilkan label konteks.
- Error menjelaskan tindakan perbaikan, bukan hanya memberi border merah.
- Permission yang tidak dimiliki biasanya menyembunyikan tindakan; tindakan yang tersedia tetapi belum memenuhi syarat ditampilkan disabled dengan alasan.

Semantic token memastikan komponen otomatis mengikuti tema:

| Bagian | Light | Dark |
|---|---|---|
| Surface | `bg.surface` | `bg.surface` |
| Default text | `text.primary` | `text.primary` |
| Secondary text | `text.secondary` | `text.secondary` |
| Border | `border.default` | `border.default` |
| Hover neutral | `bg.surfaceSubtle` | `bg.surfaceSubtle` |
| Primary CTA | `action.primary` | `action.primary` |
| Focus | `focus.ring` | `focus.ring` |

Feature code tidak membuat `dark:` color pair sendiri. Pair tersebut hanya didefinisikan pada token atau komponen di `packages/ui`.

## 12. Button

### 12.1 Variant

| Variant | Fungsi | Visual |
|---|---|---|
| `primary` | Satu tindakan utama dalam area | Filled primary |
| `secondary` | Tindakan sekunder yang tetap penting | Neutral filled/subtle |
| `outline` | Tindakan alternatif | Surface + border |
| `ghost` | Toolbar, row action, tindakan rendah | Transparan, hover surface |
| `destructive` | Hapus, batalkan, suspend | Filled danger |
| `link` | Navigasi inline | Teks primary dengan underline saat hover |

Tidak membuat variant berdasarkan nama fitur seperti `paymentButton` atau `stockButton`. Warna success tidak digunakan untuk semua tindakan selesai; gunakan primary kecuali status semantic benar-benar harus ditekankan.

### 12.2 Size

| Size | Height | Padding X | Text | Icon | Gap |
|---|---:|---:|---:|---:|---:|
| `xs` | `28px` | `8px` | `12px` | `14px` | `4px` |
| `sm` | `32px` | `10px` | `13px` | `16px` | `6px` |
| `md` | `40px` | `14px` | `14px` | `18-20px` | `8px` |
| `lg` | `48px` | `18px` | `16px` | `20-24px` | `8px` |
| `xl` | `56px` | `22px` | `16px` | `24px` | `10px` |

Default backoffice adalah `md`. POS dan customer CTA menggunakan `lg`; kiosk dapat menggunakan `xl`.

### 12.3 Button rules

- Maksimal satu primary button per dialog, card action group, atau page title action group.
- Label memakai kata kerja spesifik: `Simpan`, `Konfirmasi Pembayaran`, `Tandai Siap`.
- Jangan memakai `OK`, `Submit`, atau `Yes` tanpa konteks.
- Tombol destructive membuka `AlertDialog` jika konsekuensinya tidak mudah dibalik.
- Icon berada di kiri, kecuali icon arah seperti `Lanjut` atau external link.
- Full-width hanya pada mobile CTA, auth, dan customer checkout.
- Loading label: `Menyimpan...`, bukan hanya spinner kosong.

### 12.4 Icon Button

| Size | Box | Icon | Radius |
|---|---:|---:|---:|
| `xs` | `28px` | `14px` | `6px` |
| `sm` | `32px` | `16px` | `6px` |
| `md` | `40px` | `20px` | `8px` |
| `lg` | `48px` | `24px` | `8px` |

Icon button kritis tidak boleh berdiri tanpa label pada POS/KDS. Pada table action, icon button wajib memiliki tooltip dan `aria-label`.

### 12.5 Button Group dan Split Button

- `ButtonGroup` mengelompokkan pilihan setara, bukan navigation tab.
- Segment memiliki tinggi sama dengan button terkait.
- `SplitButton` hanya dipakai jika satu default action dan beberapa variasi benar-benar diperlukan.
- Version 1 menghindari split button pada pembayaran dan destructive action.

## 13. Form field

### 13.1 Struktur field

```text
Label
Control
Helper atau error message
```

Aturan:

- Label selalu terlihat; placeholder bukan label.
- Placeholder berisi contoh, misalnya `Contoh: Kopi Susu Aren`.
- Required ditulis `Wajib` pada helper atau indikator yang dijelaskan pada awal form.
- Error muncul di bawah control dan terhubung melalui `aria-describedby`.
- Form mempertahankan input ketika server validation gagal.
- Save button tidak disabled hanya karena form belum disentuh; validasi tetap menjelaskan masalah saat submit.

### 13.2 Input, Select, dan Combobox size

| Size | Height | Padding X | Text | Icon |
|---|---:|---:|---:|---:|
| `sm` | `32px` | `10px` | `13px` | `16px` |
| `md` | `40px` | `12px` | `14px` | `18-20px` |
| `lg` | `48px` | `14px` | `16px` | `20px` |

Default backoffice `md`; POS/customer `lg`; filter toolbar desktop boleh `sm`.

### 13.3 Text Input

Variant:

- `default`.
- `search` dengan search icon dan clear action.
- `password` dengan show/hide action.
- `prefix` atau `suffix` untuk satuan dan kode.

State:

- Default: surface + control border.
- Hover: strong border.
- Focus: primary border + focus ring.
- Invalid: danger border + message.
- Disabled: subtle surface + disabled text.
- Read-only: surface subtle, dapat difokuskan dan disalin.

Read-only berbeda dari disabled. Data seperti invoice number yang dapat disalin harus read-only, bukan disabled.

### 13.4 Textarea

| Size | Minimum height | Penggunaan |
|---|---:|---|
| `sm` | `72px` | Catatan singkat |
| `md` | `96px` | Default form |
| `lg` | `128px` | Deskripsi panjang |

- Resize vertikal diperbolehkan pada backoffice.
- Customer/POS note memakai auto-grow sampai batas tertentu.
- Character count hanya tampil jika ada batas nyata.

### 13.5 Select

Dipakai untuk pilihan sederhana dan pendek, umumnya maksimal 7-10 opsi.

- Visual custom; tidak memakai tampilan native `<select>`.
- Keyboard: Arrow, Home, End, Enter, Escape.
- Selected option memiliki check icon dan text, bukan warna saja.
- Mobile dapat memakai bottom sheet jika opsi panjang.

### 13.6 Combobox/Searchable Select

Dipakai untuk product, customer, supplier, account, user, outlet, dan data panjang.

Variant:

- Single select.
- Multi select terbatas.
- Async/server search.
- Creatable hanya jika use case mengizinkan pembuatan data dari form tersebut.

State wajib:

- Loading.
- No result.
- Error retry.
- Selected.
- Disabled option dengan alasan.

### 13.7 Number Input

Variant:

- Integer quantity.
- Decimal quantity.
- Percentage.
- Money.
- Unit measurement.

Aturan:

- Nilai internal tidak memakai formatted string sebagai source of truth.
- Format ditampilkan sesuai locale Indonesia.
- Minus hanya diizinkan untuk use case tertentu.
- Stepper `+/-` digunakan pada quantity touch, bukan pada nominal besar.
- Scroll wheel tidak boleh mengubah nilai tanpa sengaja ketika field fokus.

### 13.8 Money Input

- Prefix `Rp` berada dalam control tetapi bukan bagian nilai yang disimpan.
- Saat fokus, pemisah ribuan tetap tidak membingungkan posisi caret.
- Nilai final disimpan sebagai integer minor unit sesuai keputusan arsitektur.
- Nominal rata kanan untuk table/ledger; form boleh kiri setelah prefix.
- Zero, empty, dan null memiliki arti berbeda dan tidak boleh disamakan otomatis.

### 13.9 Date Picker dan Date Range Picker

Size mengikuti input. Variant:

- Single date.
- Date range.
- Month picker untuk periode laporan.
- Date-time untuk platform operation tertentu.

Aturan:

- Format display: `14 Jul 2026`.
- Input manual tetap didukung bila memungkinkan.
- Hari ini memiliki outline; selected memiliki fill primary.
- Range memiliki start/end yang jelas pada light dan dark mode.
- Preset laporan: `Hari ini`, `7 hari terakhir`, `Bulan ini`, `Bulan lalu`.
- Date picker harus dapat digunakan dengan keyboard.

### 13.10 Time Input

- Format 24 jam, misalnya `21:30`.
- Interval default 15 menit untuk jam operasional.
- Input bebas tetap divalidasi.
- Timezone outlet ditampilkan pada operasi platform yang lintas zona.

### 13.11 File Upload

Variant:

- Button upload.
- Dropzone.
- Image upload dengan preview.
- Attachment list.

Size dropzone:

| Size | Minimum height |
|---|---:|
| `sm` | `96px` |
| `md` | `144px` |
| `lg` | `200px` |

Selalu tampilkan tipe, ukuran maksimum, upload progress, error, retry, dan remove. Drag-and-drop bukan satu-satunya cara memilih file.

## 14. Selection control

### 14.1 Checkbox

| Size | Box | Label |
|---|---:|---:|
| `sm` | `16px` | `13px` |
| `md` | `20px` | `14px` |
| `lg` | `24px` | `16px` |

State: unchecked, checked, indeterminate, disabled, invalid. Seluruh label dapat diklik. `lg` digunakan pada touch/customer.

### 14.2 Radio

Ukuran sama dengan checkbox. Radio dipakai jika hanya satu pilihan dan semua opsi perlu terlihat. Jika opsi lebih dari 5 atau membutuhkan search, gunakan Select/Combobox.

### 14.3 Switch

| Size | Track | Thumb | Penggunaan |
|---|---|---|---|
| `sm` | `32x18px` | `14px` | Dense settings |
| `md` | `40x22px` | `18px` | Default |
| `lg` | `48x28px` | `24px` | Touch/kiosk |

Switch hanya untuk perubahan boolean yang dapat berlaku langsung. Jika perubahan membutuhkan validasi atau konfirmasi, gunakan checkbox/form lalu tombol Simpan.

### 14.4 Segmented Control

Size `sm`, `md`, dan `lg` mengikuti control height. Digunakan untuk 2-4 pilihan tampilan, misalnya `Grid/List` atau `Dine-in/Takeaway`. Tidak digunakan sebagai pengganti tab halaman yang kompleks.

### 14.5 Quantity Stepper

| Size | Height | Button width | Text |
|---|---:|---:|---:|
| `sm` | `32px` | `32px` | `13px` |
| `md` | `40px` | `40px` | `14px` |
| `lg` | `48px` | `48px` | `16px` |

- Minus pada quantity `1` mengikuti policy: menjadi `0/remove` dengan affordance jelas atau disabled.
- Long press tidak diperlukan pada Version 1.
- Nilai memiliki accessible announcement.

## 15. Navigation

### 15.1 App Sidebar

| Mode | Width |
|---|---:|
| Expanded | `240px` |
| Collapsed | `72px` |
| Mobile | Drawer `280px` maksimum |

Item size:

| Density | Height | Icon | Text |
|---|---:|---:|---:|
| Compact | `36px` | `18px` | `13px` |
| Default | `40px` | `20px` | `14px` |
| Touch | `48px` | `24px` | `16px` |

Active item memakai primary subtle background, primary text, icon, dan optional indicator bar. Active state tidak hanya dibedakan oleh warna teks.

### 15.2 Top Bar

- Desktop height `56px` atau `64px` pada touch surface.
- Menampilkan outlet context, network/device status, theme switch, notification, dan user menu sesuai surface.
- POS tidak menampilkan navigasi yang mengurangi ruang produk.
- KDS menggunakan bar minimal dan tidak menampilkan menu backoffice.

### 15.3 Tabs

Variant:

- `line`: default page tabs.
- `contained`: subview dengan 2-4 opsi.
- `vertical`: settings kompleks.

| Size | Height | Text |
|---|---:|---:|
| `sm` | `32px` | `13px` |
| `md` | `40px` | `14px` |
| `lg` | `48px` | `16px` |

Tab hanya untuk konten setara dalam satu konteks. Tab tidak digunakan untuk menyembunyikan langkah workflow wajib.

### 15.4 Breadcrumb

| Size | Height | Text/icon |
|---|---:|---:|
| `sm` | `28px` | `12/14px` |
| `md` | `32px` | `14/16px` |

- Maksimal 4 level terlihat.
- Level tengah dapat dipadatkan dalam overflow.
- Level terakhir bukan link.
- Mobile hanya menampilkan back action dan current context jika ruang sempit.

### 15.5 Pagination

Variant:

- Numbered pagination untuk backoffice.
- Previous/next compact untuk mobile.
- Load more untuk customer catalog.
- Cursor pagination pada transaction list besar.

Size control `sm` atau `md`. Selalu tampilkan range, misalnya `1-25 dari 240`, jika total tersedia.

### 15.6 Stepper

Dipakai untuk onboarding, checkout bertahap, atau setup outlet. Variant horizontal desktop dan vertical mobile. State: upcoming, current, complete, error. Bukan untuk order lifecycle; lifecycle memakai timeline/status.

## 16. Feedback dan status

### 16.1 Badge

Variant:

- `neutral`, `info`, `success`, `warning`, `danger`, `special`.
- `solid` hanya untuk emphasis tinggi; default memakai soft background.

| Size | Height | Padding X | Text/icon |
|---|---:|---:|---:|
| `xs` | `20px` | `6px` | `11/12px` |
| `sm` | `24px` | `8px` | `12/14px` |
| `md` | `28px` | `10px` | `13/16px` |

Badge status tidak clickable. Untuk filter gunakan chip/toggle button dengan semantics button.

### 16.2 Alert

Variant: info, success, warning, danger. Size compact dan default.

- Compact: padding `12px`, icon `18px`.
- Default: padding `16px`, icon `20px`, optional title/action.
- Critical alert tidak dapat ditutup jika kondisi masih aktif.
- Tindakan harus spesifik, misalnya `Coba Lagi` atau `Buka Pengaturan`.

### 16.3 Toast

Position:

- Backoffice: kanan atas.
- POS/KDS: atas tengah agar tidak menutup cart/action bawah.
- Customer mobile: atas atau di atas sticky cart.

Variant: success, info, warning, error, loading. Maksimal 3 toast terlihat. Error penting tidak hilang otomatis sebelum dapat dibaca. Toast tidak menjadi satu-satunya bukti transaksi finansial.

### 16.4 Progress

- Linear progress untuk upload, setup, dan proses dengan kemajuan terukur.
- Spinner untuk proses singkat tanpa persentase.
- Progress ring hanya untuk metrik visual tertentu.
- Skeleton untuk load layout, bukan spinner seluruh halaman.
- Durasi di atas beberapa detik perlu label proses dan kemungkinan retry/cancel bila aman.

### 16.5 Skeleton

Variant: text, avatar, product card, table row, metric card, ticket. Skeleton mengikuti radius komponen dan menggunakan surface subtle yang aman pada light/dark mode. Hindari animasi berlebihan; hormati reduced motion.

### 16.6 Empty State

Size:

- `compact` untuk table/filter result.
- `default` untuk page section.
- `full` untuk module pertama kali.

Struktur: icon/illustration opsional, title, description, primary action opsional. Empty karena belum ada data dibedakan dari no search result dan permission denied.

### 16.7 Error State

Variant:

- Inline field error.
- Section error dengan retry.
- Full page error.
- Offline state.
- Permission denied.
- Subscription/entitlement unavailable.

Jangan menampilkan stack trace atau error provider kepada merchant/customer.

## 17. Overlay

### 17.1 Dialog

| Size | Max width | Penggunaan |
|---|---:|---|
| `xs` | `360px` | Konfirmasi pendek |
| `sm` | `440px` | Form sederhana |
| `md` | `560px` | Default |
| `lg` | `720px` | Form kompleks |
| `xl` | `960px` | Preview/detail besar |
| `full` | Viewport - margin | Kiosk/mobile khusus |

Aturan:

- Header, body, dan footer terpisah secara visual.
- Footer sticky jika body scroll.
- Primary action di kanan pada desktop, full-width/stacked pada mobile jika perlu.
- Escape menutup dialog nonkritis.
- Focus kembali ke trigger saat ditutup.
- Dialog tidak ditumpuk di atas dialog lain; gunakan flow atau drawer jika kebutuhan panjang.

### 17.2 Alert Dialog

Untuk destructive atau keputusan berisiko. Wajib memiliki consequence copy, action spesifik, cancel, dan optional reason field. Untuk suspend tenant, refund, stock adjustment besar, atau cancel order produksi, reason wajib.

### 17.3 Drawer/Sheet

| Size | Desktop width | Penggunaan |
|---|---:|---|
| `sm` | `360px` | Filter/quick view |
| `md` | `480px` | Form/detail |
| `lg` | `640px` | Workflow lebih kompleks |

- Mobile memakai bottom/full-height sheet sesuai isi.
- POS cart dapat menjadi right sheet pada tablet sempit.
- Drawer bukan tempat untuk seluruh halaman administrasi yang kompleks.

### 17.4 Popover dan Dropdown Menu

- Popover untuk konten interaktif ringan seperti filter atau date picker.
- Dropdown menu untuk daftar action.
- Min width `180px`, max width `320px` kecuali combobox.
- Item height `32px` compact atau `40px` default.
- Destructive menu item dipisahkan divider jika bercampur dengan action biasa.
- Menu tidak memuat form panjang.

### 17.5 Tooltip

- Delay `400-600ms` pada pointer, langsung pada keyboard focus.
- Maksimal dua kalimat pendek.
- Tidak menyimpan informasi wajib.
- Tidak tampil pada disabled element tanpa wrapper yang focusable.
- Touch tidak bergantung pada hover tooltip.

## 18. Data display

### 18.1 Card/Panel

Variant:

- `plain`: section dengan divider, pilihan utama untuk backoffice.
- `outlined`: border + surface.
- `interactive`: outlined dengan hover/focus.
- `elevated`: hanya floating/important panel.
- `selected`: primary border/subtle background.

Size padding:

| Size | Padding |
|---|---:|
| `sm` | `12px` |
| `md` | `16px` |
| `lg` | `24px` |

Hindari nested card. Di dalam card gunakan section heading, divider, atau background subtle.

### 18.2 Data Table

Density:

| Density | Header height | Row height | Text |
|---|---:|---:|---:|
| `compact` | `36px` | `36px` | `13px` |
| `default` | `40px` | `44px` | `14px` |
| `comfortable` | `48px` | `52px` | `14-16px` |

Aturan:

- Header memakai medium weight dan surface subtle.
- Angka/nominal rata kanan; status dan teks rata kiri.
- Checkbox selection memiliki kolom tetap.
- Sticky header untuk list panjang.
- Horizontal scroll lebih baik daripada memotong kolom kritis.
- Mobile menggunakan responsive row/card hanya jika makna tabel tetap terjaga.
- Row action berada di kanan dan tidak memiliki header `Aksi` jika hanya overflow menu.
- Sort state memiliki icon dan `aria-sort`.
- Loading, empty, error, pagination, dan filter state merupakan bagian komponen.
- Zebra stripe tidak dipakai default; hover dan divider sudah cukup.

### 18.3 Description List

Untuk detail record seperti outlet, order, payment, atau supplier. Variant horizontal desktop dan stacked mobile. Label secondary, value primary. Jangan membuat setiap pasangan label-value menjadi card.

### 18.4 Metric Card

Size:

- `sm`: title, value, optional delta.
- `md`: title, value, helper, trend.
- `lg`: hanya untuk dashboard utama.

Angka utama memakai tabular numbers. Trend menggunakan icon, tanda plus/minus, label, dan warna. Merah/hijau saja tidak cukup.

### 18.5 Avatar

| Size | Diameter |
|---|---:|
| `xs` | `24px` |
| `sm` | `32px` |
| `md` | `40px` |
| `lg` | `48px` |
| `xl` | `64px` |

Fallback memakai initial maksimal dua karakter dan warna token yang konsisten, bukan random raw color.

### 18.6 Divider

Variant horizontal/vertical, subtle/default. Divider tidak digunakan sebagai dekorasi berulang; spacing tetap menjadi pemisah utama.

### 18.7 Accordion

Size `sm`, `md`, `lg` mengikuti tinggi header `36`, `44`, `52px`. Digunakan untuk informasi sekunder yang boleh disembunyikan, bukan field wajib atau data transaksi inti.

### 18.8 Timeline

Variant compact dan default. Digunakan untuk order event, payment event, subscription event, dan audit history. Setiap event menampilkan label, actor, waktu, serta reason bila ada. Warna mengikuti status semantic.

### 18.9 Chart

Version 1 mengutamakan bar, line, area, dan donut sederhana.

- Maksimal 5-6 series pada satu chart.
- Teal menjadi series utama; blue, violet, amber, dan slate menjadi pembanding.
- Grid line subtle dan label mengikuti text secondary.
- Tooltip menampilkan nilai terformat dan dapat dicapai melalui alternatif tabel/summary.
- Jangan memakai 3D chart.
- Jangan memakai merah/hijau untuk kategori netral.
- Chart finance harus memiliki summary angka atau tabel pendamping.

## 19. Komponen domain bersama

Komponen domain dibangun dari primitive `packages/ui`. Komponen domain tidak menggandakan Button, Badge, Dialog, atau Input secara lokal.

### 19.1 Money Display

Variant:

- `inline`: harga dalam row/product.
- `summary`: subtotal dan biaya.
- `total`: total pembayaran.
- `accounting`: tabel finance dengan alignment dan negative format.

| Size | Text style | Penggunaan |
|---|---|---|
| `sm` | `body-sm/medium` | Dense table |
| `md` | `body/medium` | Default |
| `lg` | `heading/semibold` | Summary |
| `xl` | `display-sm/semibold` | Total POS/checkout |

Aturan:

- Mata uang default `IDR` dan format `Rp50.000`.
- Nilai negatif memakai minus dan optional parentheses sesuai laporan, tetapi satu pola harus konsisten.
- Nilai nol ditampilkan `Rp0`, bukan dash jika memang nilai nyata.
- Data unavailable ditampilkan `-` dengan accessible label, bukan `Rp0`.
- Discount dan refund tidak dibedakan dengan warna saja.

### 19.2 Status Badge

Komponen khusus:

- `OrderStatusBadge`.
- `PaymentStatusBadge`.
- `FulfillmentStatusBadge`.
- `StockStatusBadge`.
- `SubscriptionStatusBadge`.
- `DeviceStatusBadge`.

Seluruhnya membungkus primitive Badge dan hanya menerima enum domain. Feature tidak mengirim warna secara bebas.

### 19.3 Entity Header

Dipakai pada order detail, product detail, outlet, supplier, tenant, dan subscription.

Size:

- `compact`: title + status + metadata satu baris.
- `default`: title, status, metadata, primary/overflow action.
- `hero`: hanya customer profile/public surface.

Entity header tidak membuat card baru jika sudah berada dalam page surface.

### 19.4 Filter Bar

Variant:

- `inline`: search dan 1-3 filter terlihat.
- `advanced`: filter utama + tombol semua filter.
- `mobile`: search + filter drawer.

Aturan:

- Filter aktif terlihat sebagai chip dan dapat dihapus.
- `Reset` hanya muncul jika ada perubahan.
- Filter state disimpan di URL untuk halaman backoffice jika aman.
- Search menggunakan debounce dan tetap dapat disubmit manual.
- Date range, outlet, status, dan source memakai komponen standar.

### 19.5 Action Bar

- Page action bar: primary action dan secondary/overflow.
- Selection action bar: muncul saat row dipilih dan menunjukkan jumlah pilihan.
- Sticky mobile action bar: untuk form panjang/customer checkout.
- Destructive bulk action dipisahkan dan memerlukan konfirmasi.

### 19.6 Network dan Sync Indicator

State:

- Online.
- Reconnecting.
- Offline/read-only.
- Syncing draft.
- Sync failed.

Indicator menampilkan label atau tooltip. POS/KDS menampilkan status persistently ketika koneksi tidak sehat. Status online normal boleh dipadatkan menjadi icon setelah beberapa detik.

## 20. Komponen POS dan order

### 20.1 Product Tile

Variant:

- `compact`: produk tanpa gambar untuk POS padat.
- `default`: thumbnail, nama, harga, availability.
- `touch`: tombol besar untuk tablet/kiosk.
- `customer`: foto lebih dominan dan deskripsi singkat.

| Size | Minimum | Padding | Product name |
|---|---:|---:|---:|
| `sm` | `120x72px` | `8px` | `13px/2 lines` |
| `md` | `144x96px` | `12px` | `14px/2 lines` |
| `lg` | `168x120px` | `16px` | `16px/2 lines` |
| `customer` | Full column | `12-16px` | `16px/2 lines` |

State:

- Available.
- Selected/just added.
- Low stock optional untuk internal.
- Sold out dengan label jelas.
- Scheduled/unavailable.
- Loading image.
- Image error fallback.

Harga dan status tidak boleh tertutup image. Sold out tidak hanya mengurangi opacity.

### 20.2 Category Rail

Variant horizontal chips untuk customer/mobile dan vertical list untuk POS desktop. Active category memiliki background, text, dan indicator yang jelas. Category rail dapat sticky tetapi tidak menutup content.

### 20.3 Product Modifier Picker

Struktur:

```text
Product summary
Required modifier groups
Optional modifier groups
Item note
Quantity
Add/update cart CTA
```

- Radio untuk single selection.
- Checkbox untuk multiple selection.
- Menampilkan minimum/maksimum pilihan.
- Required group memiliki status incomplete.
- Harga tambahan tampil di kanan.
- Mobile memakai bottom/full-height sheet; desktop dialog `md/lg`.

### 20.4 Cart Item

Variant:

- `compact`: POS sidebar.
- `default`: cart page.
- `receipt`: read-only summary.

Menampilkan nama, modifier, note, quantity stepper, unit price, line total, dan remove. Modifier panjang dapat collapse setelah beberapa baris dengan action `Lihat detail`.

### 20.5 Cart Summary

Urutan default:

```text
Subtotal
Diskon
Pajak
Service charge
Pembulatan bila ada
Total
Pembayaran tercatat
Sisa tagihan
```

Total memiliki visual paling kuat. Baris yang tidak berlaku tidak perlu ditampilkan sebagai nol kecuali dibutuhkan untuk audit.

### 20.6 Order Source Badge

Source: `Kasir`, `QR Meja`, `Waiter`, `Takeaway`, dan future source. Source memakai neutral/info style dan icon, bukan warna status produksi.

### 20.7 Order Card

Variant:

- `queue`: list POS/order management.
- `compact`: sidebar/recent orders.
- `detail`: summary sebelum membuka halaman.

Size mengikuti Card `sm/md/lg`. Menampilkan nomor, source/table, elapsed time, item summary, payment status, fulfillment status, dan amount sesuai permission.

### 20.8 Table Tile

| Size | Minimum | Penggunaan |
|---|---:|---|
| `sm` | `96x72px` | Dense floor list |
| `md` | `120x88px` | Default |
| `lg` | `144x104px` | Touch table layout |

State:

- Available.
- Occupied.
- Waiting order confirmation.
- Waiting payment.
- Ready/needs service.
- Reserved future.
- Disabled/non-service.

Tile menampilkan nomor meja, jumlah guest/order, durasi, dan status label. Status tidak hanya berupa fill warna seluruh tile.

Pada layout, `TableTile` memiliki dua mode:

- `view`: read-only untuk POS, dapat dipilih untuk membuka/membuat order.
- `edit`: dipilih, dipindah, dan diubah ukurannya oleh manager berizin.

Menggeser tile pada mode edit hanya mengubah posisi visual dan tidak memindahkan order/table session.

### 20.9 Floor Selector

Memilih lantai aktif pada table layout.

Variant:

- `tabs`: 2-5 lantai pada desktop/tablet.
- `select`: lantai lebih banyak atau ruang sempit.
- `compact`: POS toolbar.

Size mengikuti Tabs/Select `sm`, `md`, atau `lg`. Label lantai harus berupa nama yang dimengerti staff seperti `Lantai 1`, `Mezzanine`, atau `Rooftop`, bukan database ID.

### 20.10 Table Layout Canvas

Canvas hanya memetakan meja. Tidak menyediakan objek dinding, pintu, jendela, bar, kasir, tanaman, dekorasi, fasilitas, background image, atau gambar denah bangunan.

Canvas hanya tersedia untuk staff berizin. Customer yang scan QR hanya melihat nama outlet, lantai, dan meja terkait; customer tidak menerima data posisi meja lain atau layout internal outlet.

Mode:

- `view`: POS menampilkan posisi dan status meja realtime.
- `edit`: backoffice menyusun posisi meja per lantai.
- `preview`: melihat hasil sebelum menyimpan/print summary.

Ukuran canvas:

| Variant | Minimum viewport | Penggunaan |
|---|---:|---|
| `compact` | `640x400px` | Preview/tablet terbatas |
| `default` | `960x600px` | Editor backoffice |
| `wide` | Available desktop | Outlet dengan banyak meja |

Canvas menggunakan logical grid, bukan koordinat pixel absolut. Rendering boleh melakukan zoom/pan, tetapi source of truth tetap `grid_x`, `grid_y`, `grid_w`, dan `grid_h`.

Visual light/dark:

| Elemen | Light | Dark |
|---|---|---|
| Canvas | `bg.surface` | `bg.surface` |
| Grid dot/line | `border.subtle` | `border.subtle` |
| Canvas boundary | `border.default` | `border.default` |
| Selected table | Primary border/ring | Bright primary border/ring |
| Invalid overlap | Danger border + pattern | Danger border + pattern |
| Drop target | Primary subtle | Primary subtle |

Behavior edit:

- Drag-and-drop selalu snap-to-grid.
- Meja tidak boleh keluar batas canvas.
- Overlap ditolak dan dijelaskan, bukan hanya ditandai merah.
- Save menyimpan seluruh perubahan sebagai satu revision/action yang diaudit.
- Unsaved changes menampilkan dirty-state dan konfirmasi saat keluar.
- Undo/redo lokal untuk perubahan sebelum save direkomendasikan.
- Zoom controls: `Fit`, `-`, persentase, `+`.
- Pan hanya aktif ketika canvas lebih besar dari viewport.
- Add table dapat berasal dari toolbar atau unplaced-table tray.

Keyboard alternative:

- Table dapat dipilih melalui Tab atau table list.
- Arrow memindahkan satu grid step; Shift+Arrow dapat memindahkan beberapa step jika ditetapkan konsisten.
- Property panel dapat mengubah posisi/ukuran tanpa drag.
- Screen reader menerima nama meja, lantai, posisi grid, dan status invalid.

Editor minimum didukung pada tablet landscape dan desktop. Mobile phone menyediakan view/list dan basic property edit, bukan drag canvas penuh.

### 20.11 Table Layout Toolbar

Isi Version 1:

- Floor selector.
- Tambah/ubah/nonaktifkan lantai.
- Tambah meja.
- Toggle edit/view.
- Zoom fit/in/out.
- Save dan cancel changes.
- Optional undo/redo.

Toolbar tidak menyediakan objek bangunan atau drawing tool. Destructive action lantai/meja mengikuti Alert Dialog dan menolak penghapusan jika masih memiliki session aktif tanpa resolution flow.

### 20.12 Table Property Panel

Field:

- Label/kode meja.
- Capacity.
- Bentuk `ROUND`, `SQUARE`, atau `RECTANGLE`.
- Grid width/height.
- Floor dan area opsional.
- Active state.
- QR status dan shortcut pengelolaan QR.

Position grid dapat ditampilkan untuk aksesibilitas, tetapi user umum mengatur melalui canvas. Mengganti floor untuk meja yang memiliki session aktif memerlukan policy/validation.

### 20.13 Unplaced Table Tray

Menampilkan meja yang belum mempunyai posisi pada lantai aktif. Meja dapat diseret ke canvas atau dipilih lalu diberi posisi melalui property panel. Empty state: `Semua meja sudah ditempatkan`.

### 20.14 QR Table Card

Menampilkan outlet, area/meja, QR, short code/token status, print/download, regenerate, dan last generated. QR selalu memiliki quiet zone serta ukuran minimum cetak yang diuji. Regenerate memerlukan konfirmasi karena QR lama menjadi tidak berlaku.

QR Table Card juga menampilkan lantai dan memastikan perubahan posisi meja tidak mengganti token. Status minimal: active, revoked, dan not generated.

### 20.15 Payment Method Tile

Variant: cash, merchant QRIS, transfer, EDC, mixed. Size `md` (`120x88px`) dan `lg` (`144x104px`). Menampilkan icon/logo, label, availability, dan optional instruction. Selected state memiliki border, check icon, dan background subtle.

### 20.16 Cash Keypad

- Tombol minimum `48px`, direkomendasikan `56px`.
- Preset nominal mengikuti total transaksi.
- Menampilkan amount received dan change secara jelas.
- Clear/backspace memiliki label aksesibel.
- Tidak digunakan untuk transfer/QRIS manual.

### 20.17 Payment Confirmation Panel

Untuk pembayaran manual:

- Menampilkan metode, nominal, waktu order, reference optional, dan instruktor verifikasi.
- Customer action `Saya Sudah Bayar` hanya mengubah status menjadi `VERIFYING`.
- Kasir memiliki `Konfirmasi Pembayaran` setelah memeriksa rekening/notifikasi merchant.
- UI tidak menampilkan `Berhasil` sebelum server mencatat `PAID`.
- Duplicate confirmation harus aman dan memberikan current state.

### 20.18 Receipt

Variant screen dan print. Screen mengikuti light/dark; print selalu high-contrast putih/hitam. Receipt menampilkan identitas outlet, order/bill, item, modifier, tax/service, payment, cashier, waktu, serta reprint marker bila relevan.

## 21. Kitchen Display System

### 21.1 Kitchen Ticket

Variant:

- `compact`: banyak ticket pada layar besar.
- `default`: satu station normal.
- `touch`: tombol dan item lebih besar.
- `history`: read-only selesai/batal.

| Size | Width | Header | Item text | Action height |
|---|---:|---:|---:|---:|
| `sm` | `240-280px` | `40px` | `14px` | `40px` |
| `md` | `280-320px` | `48px` | `16px` | `48px` |
| `lg` | `320-360px` | `56px` | `18px` | `56px` |

Isi ticket:

- Nomor order/table dan source.
- Elapsed timer.
- Item quantity dan nama.
- Modifier dan note yang sangat jelas.
- Allergy/special note jika fitur tersedia.
- Current status dan primary state action.

Status visual menggunakan accent strip, badge, label, dan action. Seluruh ticket tidak dicat warna kuat karena akan melelahkan dan merusak keterbacaan dark mode.

### 21.2 KDS status

| Status | Label | Semantic |
|---|---|---|
| `NEW` | Pesanan baru | Info |
| `ACCEPTED` | Diterima | Info/special |
| `PREPARING` | Sedang disiapkan | Warning |
| `READY` | Siap disajikan | Success |
| `SERVED` | Sudah disajikan | Neutral |
| `COMPLETED` | Selesai | Neutral |
| `CANCELLED` | Dibatalkan | Danger |

### 21.3 Timer behavior

- Normal: neutral.
- Mendekati SLA: warning.
- Melewati SLA: danger.
- Threshold dapat dikonfigurasi outlet pada pengembangan berikutnya.
- Timer memakai tabular numbers dan tidak berkedip.
- Update warna tidak disertai animasi terus-menerus.

### 21.4 KDS layout

- Oldest ticket berada paling kiri/awal urutan.
- Grid/column dapat horizontal scroll pada touch.
- New ticket memberi audio dan visual announcement yang tidak menggeser ticket aktif secara membingungkan.
- Reconnect selalu refetch ticket dari server.
- Offline/reconnecting banner selalu terlihat.
- KDS tidak menampilkan harga, HPP, nomor telepon, atau informasi pembayaran.

## 22. Inventory components

### 22.1 Stock Indicator

Variant:

- `quantity`: nilai dan unit.
- `status`: normal, low, out, negative, unavailable.
- `delta`: perubahan `+/-`.

Size `sm/md/lg` mengikuti type scale. Negative stock selalu menampilkan tanda minus, label, serta danger semantic.

### 22.2 Stock Movement Row

Menampilkan waktu, item, movement type, reference, quantity delta, unit, actor, dan resulting balance jika tersedia. `+` dan `-` wajib ditampilkan; warna menjadi bantuan tambahan.

### 22.3 Movement Type Badge

Mapping tetap untuk receipt, consumption, reversal, waste, adjustment, transfer in/out. Type badge berbeda dari success/error karena movement bukan selalu kondisi baik/buruk.

### 22.4 Inventory Item Picker

Combobox async dengan nama, SKU, unit utama, stok outlet, dan status. Hasil tidak menampilkan harga jual jika tidak diperlukan.

### 22.5 Stock Adjustment Form

- Current stock read-only.
- Adjustment direction/type.
- Quantity dan unit.
- Resulting stock preview.
- Reason wajib.
- Warning jika menghasilkan negative stock.
- Manager approval jika policy membutuhkan.

### 22.6 Stocktake Table

Kolom: item, system quantity, counted quantity, difference, unit, reason/status. Counted input memiliki navigasi keyboard yang efisien. Save draft dan finalize merupakan tindakan berbeda; finalize memerlukan konfirmasi.

### 22.7 Recipe/BOM Editor

Product header + ingredient table. Setiap row memiliki ingredient picker, quantity, unit, estimated cost, dan remove. Total estimated cost tampil sebagai summary, bukan accounting final.

## 23. Finance components

### 23.1 Finance Metric

Variant: revenue, HPP estimate, gross profit, expense, operating profit, cash variance. Warna semantic hanya untuk kondisi; revenue tidak selalu hijau dan expense tidak selalu merah. Delta selalu memiliki periode pembanding.

### 23.2 Ledger Row

Menampilkan date/time, description, category, reference, payment method, debit/credit atau in/out, amount, dan status. Money rata kanan, description dapat wrap maksimal dua baris pada list.

### 23.3 Reconciliation Summary

Menampilkan expected, recorded/statement, difference, status, actor, dan notes. Difference nol memakai neutral/success label; difference nonzero memakai warning/danger berdasarkan policy, bukan warna saja.

### 23.4 Shift Summary

Bagian:

- Opening cash.
- Cash sales.
- Cash in/out.
- Expected cash.
- Counted cash.
- Variance.
- Noncash breakdown.
- Open/close actor dan time.

Close shift CTA tidak aktif jika required count/reason belum lengkap, dengan alasan terlihat.

### 23.5 Financial Report Table

- Period dan outlet context selalu terlihat.
- Group header dapat collapse jika tidak menyembunyikan total utama.
- Subtotal/total memakai border dan semibold, bukan card baru.
- Angka unavailable tidak diubah menjadi nol.
- Report diberi label `Estimasi operasional` untuk HPP/laba basic.

## 24. Customer ordering components

### 24.1 Merchant Header

Variant compact dan hero. Menampilkan logo, nama, outlet, open/closed status, table context, dan optional banner. Merchant brand digunakan di area ini tanpa mengubah semantic status.

### 24.2 Customer Product Card

Variant list dan grid. Mobile default list jika deskripsi/modifier penting; grid jika katalog visual. Image ratio konsisten, lazy-loaded, dan memiliki fallback. Add action minimal `40px`, direkomendasikan `48px`.

### 24.3 Sticky Cart Bar

Height minimum `64px` ditambah safe-area inset. Menampilkan item count, total, dan CTA `Lihat Keranjang`. Tidak menutup content terakhir; page memiliki bottom padding yang sesuai.

### 24.4 Order Progress

Menampilkan status dengan label yang dimengerti customer:

```text
Pesanan dikirim
-> Diterima kafe
-> Sedang disiapkan
-> Siap/disajikan
```

Status internal yang tidak berguna untuk customer tidak ditampilkan.

### 24.5 Manual Payment Instruction

- QRIS merchant atau rekening ditampilkan jelas.
- Nominal dapat disalin.
- Instruksi menyebut bahwa verifikasi dilakukan kasir.
- CTA customer menghasilkan `Menunggu konfirmasi`, bukan `Lunas`.
- Screenshot/upload bukti tidak diwajibkan kecuali merchant memang memerlukannya.

## 25. Platform admin components

### 25.1 Tenant Switch/Context

Super-admin harus selalu melihat apakah sedang berada pada platform context atau support context tenant. Support context menggunakan persistent banner dan reason/expiry.

### 25.2 Entitlement Matrix

Table/matrix menampilkan module, plan default, tenant override, effective state, reason, actor, dan effective time. Effective state tidak hanya checkbox; dependency dan source harus terlihat.

### 25.3 Subscription Status

Mapping: trial info, active success, grace warning, suspended danger, terminated neutral/danger. Perubahan status menggunakan confirmation dialog dan audit reason.

### 25.4 Audit Event

Compact timeline/table dengan actor, action, target, tenant/outlet, before/after summary, reason, time, dan request ID. Sensitive value dimasking.

## 26. Status language contract

### 26.1 Order dan fulfillment

| Enum | Label internal | Label customer bila berbeda |
|---|---|---|
| `DRAFT` | Draft | - |
| `SUBMITTED` | Pesanan masuk | Pesanan dikirim |
| `ACCEPTED` | Diterima | Diterima kafe |
| `PREPARING` | Sedang disiapkan | Sedang disiapkan |
| `READY` | Siap disajikan | Pesanan siap |
| `SERVED` | Sudah disajikan | Sudah disajikan |
| `COMPLETED` | Selesai | Selesai |
| `CANCELLED` | Dibatalkan | Dibatalkan |

### 26.2 Payment manual

| Enum | Label | Semantic |
|---|---|---|
| `UNPAID` | Belum dibayar | Neutral |
| `VERIFYING` | Menunggu konfirmasi | Warning |
| `PAID` | Lunas | Success |
| `REFUND_PENDING` | Refund diproses | Warning/special |
| `REFUNDED` | Dikembalikan | Special |

Istilah `Pembayaran berhasil` hanya boleh muncul setelah backend menyimpan status `PAID`.

## 27. Layout system

### 27.1 Breakpoint

| Token | Minimum width | Target |
|---|---:|---|
| `sm` | `640px` | Large phone/small tablet |
| `md` | `768px` | Tablet portrait |
| `lg` | `1024px` | Tablet landscape/small desktop |
| `xl` | `1280px` | Desktop |
| `2xl` | `1536px` | Large desktop/KDS |

Desain tidak bergantung pada nama perangkat; gunakan available space dan container query untuk komponen reusable jika diperlukan.

### 27.2 Page container

| Context | Max width | Padding |
|---|---:|---:|
| Backoffice list | `1440px` | `16/24/32px` responsive |
| Backoffice form | `960px` | `16/24px` |
| Detail page | `1200px` | `16/24/32px` |
| Customer ordering | `720px` | `16px` |
| Auth/setup | `480px` | `16-24px` |
| POS/KDS | Full viewport | Surface-specific |

### 27.3 Grid

- 4-column mobile.
- 8-column tablet.
- 12-column desktop.
- Gap `16px` mobile/tablet, `24px` desktop.
- Dashboard metrics menggunakan minimum card width, bukan jumlah kolom tetap.

### 27.4 Page anatomy

```text
Breadcrumb/context
Page title + primary action
Optional summary/alert
Filter/action bar
Main content
Pagination/secondary information
```

Tidak semua halaman membutuhkan semua bagian. Single-purpose POS/KDS tidak memakai page anatomy backoffice.

### 27.5 Section

- Section gap default `24px`, major section `32px`.
- Section heading dan action berada satu row pada desktop, stacked mobile.
- Divider digunakan jika dua section berada pada surface yang sama.
- Jangan membungkus setiap section dengan card jika page surface sudah cukup.

## 28. Surface-specific layout

### 28.1 POS desktop/tablet landscape

```text
Category rail 160-200px
Product area flexible
Cart 360-420px
```

- Cart sticky/full height.
- Product grid memakai minimum tile width.
- Dine-in dapat membuka table-layout view per lantai sebelum masuk product/cart flow.
- Table-layout view mempertahankan posisi meja dan menampilkan status realtime tanpa mengizinkan drag.
- Payment flow dapat mengganti cart panel atau membuka dedicated panel.
- Pada tablet portrait, cart menjadi drawer atau lower panel.

### 28.2 KDS

- Full viewport tanpa sidebar utama.
- Top bar minimal `56px`.
- Ticket grid horizontal atau responsive columns.
- History/filter berada pada drawer atau secondary screen.
- Dark mode dapat menjadi default device setting, tetapi tetap dapat diubah.

### 28.3 Backoffice

- Sidebar `240px`, collapsed `72px`.
- Content tidak otomatis full-width untuk form.
- Table list dapat memakai lebar penuh.
- Sticky filter/action hanya jika list panjang dan tidak mengurangi viewport secara berlebihan.

### 28.4 Customer ordering

- Mobile-first single column.
- Merchant/category header dapat sticky secara bertahap.
- Sticky cart menggunakan safe-area inset.
- Desktop customer page tetap dibatasi agar tidak menjadi katalog terlalu lebar.

### 28.5 Platform admin

- Density default/compact.
- Tenant context selalu terlihat.
- Table dan audit dapat full-width.
- Support impersonation/access banner tidak boleh dapat ditutup selama session aktif.

## 29. Responsive dan touch behavior

Aturan umum:

- Tidak ada horizontal page scroll kecuali table, KDS rail, atau canvas yang memang membutuhkannya.
- Primary action tetap dapat dijangkau pada mobile tanpa menutup field aktif.
- Hover enhancement tidak boleh diperlukan untuk menyelesaikan tugas.
- Minimum target WCAG adalah `24x24px`; standar internal kita `40px` desktop dan `44-48px` untuk touch.
- Jarak antar-target touch minimal `8px` bila target kecil.
- Gunakan safe-area inset untuk sticky mobile bar.
- Virtual keyboard tidak boleh menutup active field atau checkout CTA.
- Modal desktop berubah menjadi sheet/full-screen pada mobile jika konten panjang.
- Table dengan lebih dari 4 kolom tidak dipaksa mengecil; tentukan kolom prioritas, horizontal scroll, atau alternate mobile view.

Responsive component priority:

```text
Pertahankan fungsi kritis
-> pindahkan secondary action ke overflow
-> stack layout
-> ubah panel menjadi drawer
-> sembunyikan metadata nonkritis
```

Data kritis, status, total, dan primary action tidak boleh disembunyikan hanya untuk membuat layout muat.

## 30. Accessibility

Target adalah WCAG 2.2 Level AA.

### 30.1 Contrast

- Teks normal minimal `4.5:1`.
- Teks besar minimal `3:1`.
- Komponen, border penting, dan focus indicator minimal `3:1` terhadap warna sekitar.
- Contrast diuji untuk light, dark, dan seluruh merchant preset.
- Disabled content dikecualikan dari sebagian requirement tetapi tetap harus dapat dikenali.

### 30.2 Keyboard

- Semua fungsi dapat dicapai tanpa mouse.
- Urutan tab mengikuti urutan visual/logis.
- Skip link tersedia pada backoffice/platform admin.
- Dialog melakukan focus trap dan mengembalikan focus ke trigger.
- Dropdown, select, combobox, tabs, radio, dan date picker mengikuti pola keyboard WAI-ARIA.
- Shortcut POS tidak boleh bertabrakan dengan browser/screen reader dan harus terdokumentasi.

### 30.3 Focus

- Gunakan `:focus-visible`, bukan menghapus outline.
- Focus ring `2px` dengan offset `2px`.
- Focus tidak tertutup sticky header/footer.
- Selected dan focused adalah state berbeda.
- Dark mode memiliki focus ring lebih terang.

### 30.4 Screen reader

- Icon-only button memiliki accessible name.
- Status update kritis memakai live region secukupnya.
- Table memiliki header/association yang benar.
- Error summary menghubungkan user ke field bermasalah.
- Price, quantity, timer, dan order number memiliki pembacaan yang bermakna.
- Decorative icon/image disembunyikan dari accessibility tree.

### 30.5 Color dan sensory information

- Status memakai text + icon + color.
- Required/error tidak hanya ditandai warna.
- Instruksi tidak boleh hanya mengatakan `tekan tombol hijau di kanan`.
- Chart menyediakan label, tooltip, atau summary nonvisual.

### 30.6 Zoom dan reflow

- Backoffice tetap dapat digunakan pada zoom 200%.
- Text tidak terpotong jika ukuran font sistem membesar.
- KDS menyediakan density setting, bukan mengunci ukuran terlalu kecil.
- Customer page mengikuti user font scaling sejauh platform browser memungkinkan.

## 31. Motion dan sound

### 31.1 Duration

| Token | Durasi | Penggunaan |
|---|---:|---|
| `instant` | `0-75ms` | Press feedback |
| `fast` | `120ms` | Hover/focus color |
| `normal` | `180ms` | Popover/menu |
| `slow` | `240ms` | Dialog/drawer |

- Easing default `ease-out` untuk masuk dan `ease-in` untuk keluar.
- Layout transaction besar tidak dianimasikan.
- Loading tidak menggunakan bouncing yang mengganggu.
- Hormati `prefers-reduced-motion`; transform nonessential dimatikan.
- Status danger tidak berkedip.

### 31.2 KDS sound

- Audio hanya untuk event penting seperti ticket baru atau reconnect failure.
- Volume dan mute disimpan per device.
- Sound memiliki visual equivalent.
- Event berulang dibatasi agar tidak menimbulkan spam.

## 32. Content design dan locale

### 32.1 Bahasa

- Bahasa UI Version 1: Bahasa Indonesia.
- Istilah menggunakan bahasa operasional yang umum: `Pesanan`, `Meja`, `Kasir`, `Dapur`, `Stok`, `Pengeluaran`.
- Nama module teknis tidak ditampilkan kepada customer.
- Gunakan sentence case, bukan Title Case berlebihan.

### 32.2 Action label

Gunakan kata kerja spesifik:

| Hindari | Gunakan |
|---|---|
| OK | Konfirmasi pembayaran |
| Submit | Kirim pesanan |
| Yes | Batalkan pesanan |
| Process | Mulai siapkan |
| Save changes | Simpan perubahan |
| Delete | Hapus produk |

### 32.3 Error copy

Pola:

```text
Apa yang gagal
Mengapa jika aman untuk dijelaskan
Apa yang dapat dilakukan user
```

Contoh: `Pesanan belum dapat dikirim karena koneksi terputus. Periksa jaringan lalu coba lagi.`

Hindari: `Something went wrong`, `Error 500`, atau pesan provider/database.

### 32.4 Format lokal

| Data | Format |
|---|---|
| Currency | `Rp50.000` |
| Decimal | `1,5` untuk display lokal |
| Date | `14 Jul 2026` |
| Date-time | `14 Jul 2026, 21:30` |
| Time | `21:30` |
| Percentage | `10%` |
| Phone | Format Indonesia yang mudah dibaca |

Database/API tetap memakai format canonical; lokalisasi hanya pada presentation layer.

## 33. Image, logo, dan media

- Product image ratio default `1:1`.
- Customer hero/banner ratio `16:6` sampai `16:9` sesuai viewport.
- Logo merchant ditempatkan pada safe container dan tidak dipaksa stretch.
- Gunakan object-fit cover untuk product/banner, contain untuk logo/QR/provider logo.
- Sediakan placeholder dan broken-image state.
- Upload menghasilkan preview dan crop guidance.
- Informasi kritis tidak ditanam hanya di dalam gambar.
- Dark mode tidak mengubah foto; logo yang tidak terbaca memerlukan neutral backing surface.

## 34. Light-dark component mapping

Komponen tidak boleh sekadar membalik `white` menjadi `black`. Mapping berikut menjadi acuan.

| Komponen | Light | Dark |
|---|---|---|
| App canvas | Slate 50 | Navy-slate canvas |
| Card/panel | White + subtle border | Slate surface + default border |
| Raised overlay | White + shadow | Slate 800 + strong border |
| Input | White + slate border | Slate surface + slate border |
| Neutral hover | Slate 100 | Slate surface subtle |
| Primary button | Teal 700 + white | Teal 400 + teal 950 |
| Secondary button | Slate 100 + slate 900 | Slate 800 + slate 50 |
| Outline button | White + slate 300 | Transparent + slate 600 |
| Ghost button | Transparent | Transparent |
| Tooltip | Slate 900 + white | Slate 50 + slate 900 |
| Table header | Slate 100 | Surface subtle |
| Selected row | Teal 50/100 | Teal 900 with safe text |
| Skeleton | Slate 200 | Slate 700/800 |
| Overlay | Slate 900 alpha 48% | Slate 950 alpha 72% |

Visual regression harus memotret kedua mode. Perubahan komponen dianggap belum selesai jika hanya diverifikasi pada satu theme.

## 35. Struktur implementasi

Rekomendasi struktur:

```text
packages/ui/
  src/
    styles/
      primitives.css
      tokens.css
      typography.css
      globals.css
    primitives/
      button/
      input/
      dialog/
      ...
    components/
      data-table/
      date-picker/
      empty-state/
      ...
    patterns/
      page-header/
      filter-bar/
      action-bar/
      ...
    index.ts

apps/web/
  components/
    domain/
      pos/
      kds/
      inventory/
      finance/
      customer/
      platform/
```

### 35.1 Styling

- Tailwind CSS digunakan sebagai utility layer.
- Theme token didefinisikan sebagai CSS variables dan diekspos melalui Tailwind theme variables.
- Variant class dikelola terpusat, direkomendasikan memakai `class-variance-authority` atau pola setara.
- Class conflict ditangani melalui helper terkontrol seperti `tailwind-merge`.
- Radix/headless primitive boleh dipakai untuk behavior dan accessibility, tetapi seluruh visual berasal dari design system ini.
- Tidak mengambil theme bawaan komponen pihak ketiga.

### 35.2 Theme selector

Root document menggunakan attribute/class yang stabil:

```html
<html data-theme=light>
<html data-theme=dark>
```

`System` menghitung preference pengguna lalu menerapkan theme sebelum paint untuk mencegah flash. CSS juga menetapkan `color-scheme: light` atau `dark` agar browser chrome/form fallback selaras.

### 35.3 Token example

```css
:root,
[data-theme=light] {
  --color-bg-canvas: #f8fafc;
  --color-bg-surface: #ffffff;
  --color-text-primary: #0f172a;
  --color-border-default: #cbd5e1;
  --color-action-primary: #0f766e;
  --color-action-on-primary: #ffffff;
}

[data-theme=dark] {
  color-scheme: dark;
  --color-bg-canvas: #0b1120;
  --color-bg-surface: #111827;
  --color-text-primary: #f8fafc;
  --color-border-default: #334155;
  --color-action-primary: #2dd4bf;
  --color-action-on-primary: #042f2e;
}
```

Nama token final harus konsisten dan tidak dicampur antara format `color.primary` di dokumentasi dan CSS variable tanpa mapping yang jelas.

### 35.4 Font loading

Gunakan package resmi:

```bash
pnpm add geist
```

Font dibundel, bukan di-load dari external CDN. Apply variable Geist Sans pada root, Geist Mono hanya pada utility teknis. Gunakan `font-display: swap` sesuai implementasi package.

### 35.5 Component API

Setiap component API minimal mempertimbangkan:

- `variant`.
- `size`.
- `disabled`.
- `loading` jika relevan.
- `className` untuk layout adjustment, bukan menimpa visual contract.
- `aria-*` dan ref forwarding.
- Controlled/uncontrolled behavior jika relevan.

Feature tidak boleh mengirim props seperti `backgroundColor=#...`. Domain status menerima enum dan component menentukan visual mapping.

## 36. Component bank

Sebelum halaman fitur dibangun, buat catalog visual melalui Storybook atau internal `/ui-lab`. Storybook direkomendasikan karena dapat mendokumentasikan props, state, viewport, dan theme tanpa masuk ke business route.

Setiap story wajib menampilkan:

- Seluruh size.
- Seluruh variant.
- Default, hover reference, focus, disabled, loading, dan error.
- Light dan dark mode.
- Long Indonesian label.
- Empty/zero/large numeric value.
- Mobile, tablet, dan desktop viewport jika responsive.

### 36.1 Priority P0 - sebelum halaman

- Theme provider dan theme switcher.
- Typography dan icon wrapper.
- Button, Icon Button, Button Group.
- Form Field, Input, Textarea, Number/Money Input.
- Checkbox, Radio, Switch, Quantity Stepper.
- Select, Combobox, Date/Time Picker.
- Badge dan seluruh status wrapper.
- Alert, Toast, Dialog, Alert Dialog, Drawer.
- Popover, Dropdown Menu, Tooltip.
- Card/Panel, Divider, Skeleton, Empty/Error State.
- Tabs, Breadcrumb, Pagination.
- Data Table dan Description List.

### 36.2 Priority P1 - flow operasional

- Page/Entity Header, Filter Bar, Action Bar.
- Money Display dan Metric Card.
- Product Tile, Category Rail, Modifier Picker.
- Cart Item, Cart Summary, Sticky Cart Bar.
- Order Card, Order Status, Payment Status.
- Table Tile dan QR Table Card.
- Floor Selector, Table Layout Canvas/Toolbar, Table Property Panel, dan Unplaced Table Tray.
- Payment Method Tile, Cash Keypad, Confirmation Panel.
- Kitchen Ticket dan KDS Timer.
- Network/Sync Indicator.

### 36.3 Priority P2 - inventory, finance, platform

- Stock Indicator, Movement Row, Movement Type Badge.
- Inventory Item Picker, Stock Adjustment, Stocktake Table.
- Recipe/BOM Editor.
- Finance Metric, Ledger Row, Reconciliation, Shift Summary.
- Financial Report Table dan Chart wrapper.
- Tenant Context, Entitlement Matrix, Subscription Status.
- Audit Event dan Timeline.

Component bank bukan halaman showcase sekali pakai. Ia menjadi tempat verifikasi sebelum component digunakan atau diubah.

## 37. Testing design system

### 37.1 Unit/component test

- Variant dan size menghasilkan semantics yang tepat.
- Keyboard interaction.
- Focus management.
- Controlled/uncontrolled state.
- Loading mencegah duplicate action.
- Domain enum selalu memiliki mapping visual/label.

### 37.2 Accessibility test

- Automated axe pada story/page kritis.
- Keyboard-only manual pass.
- Screen reader smoke test untuk dialog, form, table, status, dan KDS update.
- Contrast check seluruh semantic token light/dark dan merchant preset.
- Zoom/reflow 200% pada backoffice dan customer flow.

### 37.3 Visual regression

Snapshot minimal untuk:

- Button dan form states.
- Dialog/drawer/dropdown.
- Data table.
- POS product/cart/payment.
- Table layout view/edit pada light dan dark mode, termasuk selected, overlap, unsaved, dan revoked QR state.
- KDS ticket states.
- Customer product/cart/manual payment.
- Inventory adjustment.
- Finance summary/report.

Setiap snapshot dibuat untuk light dan dark mode serta viewport utama.

### 37.4 End-to-end visual behavior

- Theme tetap setelah reload/login.
- Theme switch tidak menghapus draft.
- Customer mengikuti system preference.
- POS/KDS menyimpan theme per device.
- Overlay dan sticky action tidak menutup content pada mobile.

## 38. Governance

### 38.1 Aturan coding

- Tidak ada raw hex pada feature component.
- Tidak ada arbitrary radius/shadow/spacing tanpa alasan dan pembaruan dokumen.
- Tidak membuat button/input/modal versi fitur sendiri.
- Tidak memakai native select/date/dialog dengan visual browser sebagai final UI.
- Tidak menyalin class panjang antarhalaman; ekstrak pattern/component jika berulang.
- Domain component tidak mengakses data tenant lain dan hanya menerima data yang dibutuhkan.
- Visual hidden bukan authorization; backend tetap memvalidasi permission.

### 38.2 Perubahan design system

Perubahan token atau component contract harus:

1. Menjelaskan alasan dan surface terdampak.
2. Memperbarui `design-system.md`.
3. Memperbarui component bank/story.
4. Memverifikasi light dan dark.
5. Menjalankan accessibility dan visual regression terkait.
6. Menghindari breaking change diam-diam pada feature.

### 38.3 Definition of Done komponen

Sebuah komponen dianggap selesai jika:

- API dan use case jelas.
- Size dan variant yang diperlukan tersedia.
- Light dan dark mode selesai.
- Semua state interaksi selesai.
- Keyboard dan screen reader semantics benar.
- Responsive/touch behavior selesai.
- Long text, empty, error, loading, dan disabled diuji.
- Story/component bank tersedia.
- Test relevan lulus.
- Tidak menggunakan raw color di feature.

## 39. Batas Version 1

Termasuk:

- Light, dark, dan system theme.
- Operational Teal dan merchant preset storefront.
- Geist Sans dan Geist Mono terbatas.
- Custom component dasar dan domain utama.
- Responsive merchant/customer/platform web.
- Touch-first POS/KDS/customer.
- Accessibility baseline WCAG 2.2 AA.
- Component bank dan visual verification.

Ditunda:

- Merchant arbitrary theme color.
- Merchant custom font.
- Full white-label theme builder.
- Advanced charting/dashboard builder.
- Custom animation themes.
- Native mobile-specific component system.
- Theme per module yang berbeda-beda.
- KDS high-contrast mode khusus di luar light/dark standar.
- Full building floor-plan editor dengan dinding, pintu, fasilitas, dekorasi, background image, dan drawing tools.

## 40. Checklist sebelum coding halaman

- [ ] Token primitive dan semantic light/dark sudah dibuat.
- [ ] Geist Sans/Mono sudah dibundel dan fallback benar.
- [ ] Theme tanpa flash dan persistence bekerja.
- [ ] P0 component bank tersedia.
- [ ] Contrast light/dark dan brand preset lulus.
- [ ] Button/input/select/dialog/table tidak memakai visual default browser.
- [ ] Focus dan keyboard pattern diuji.
- [ ] POS touch controls memakai size `lg`.
- [ ] KDS ticket dapat dibaca pada target perangkat.
- [ ] Table layout per lantai menggunakan logical grid dan editor menolak overlap/out-of-bounds.
- [ ] POS table-layout view read-only menampilkan posisi serta status realtime.
- [ ] Table layout dapat dioperasikan tanpa drag melalui keyboard/property panel.
- [ ] Tidak ada tool atau asset denah bangunan pada Version 1.
- [ ] Customer sticky cart aman terhadap viewport/safe area.
- [ ] Money dan numeric display memakai tabular numbers.
- [ ] Domain status memakai enum-to-token mapping.
- [ ] Visual regression light/dark untuk komponen utama tersedia.

## 41. Referensi

Referensi ini digunakan untuk prinsip dan pola interaksi, bukan untuk menyalin visual produknya.

### Typography dan tooling

- Geist Font: https://examples.vercel.com/font
- Geist Design System: https://vercel.com/geist/introduction
- Tailwind theme variables: https://tailwindcss.com/docs/theme
- Radix Primitives: https://www.radix-ui.com/primitives/docs/overview/introduction
- Lucide Icons: https://lucide.dev/

### Accessibility

- WCAG 2.2: https://www.w3.org/TR/WCAG22/
- Target Size Minimum: https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum
- Focus Appearance: https://www.w3.org/WAI/WCAG22/Understanding/focus-appearance.html

### Product interaction references

- Square Restaurant POS demo: https://squareup.com/us/en/point-of-sale/restaurants/full-service-demo
- Square Restaurant POS: https://squareup.com/us/en/point-of-sale/restaurants
- Square Kiosk: https://squareup.com/us/en/point-of-sale/restaurants/kiosk-software
- Toast KDS: https://pos.toasttab.com/hardware/kitchen-display-system
- Lightspeed POS navigation: https://resto-support.lightspeedhq.com/hc/en-us/articles/360005777873-About-navigation-in-Restaurant-POS
- Lightspeed dark mode/layout: https://o-series-support.lightspeedhq.com/hc/en-us/articles/31329442916891-Design-your-POS-look-and-layout
- Shopify POS: https://www.shopify.com/pos

## 42. Keputusan final Version 1

```text
Visual direction : Calm Commerce
Primary palette  : Operational Teal
Neutral palette  : Slate/Navy
Themes           : Light, Dark, System
UI font          : Geist Sans
Technical font   : Geist Mono terbatas
Icon family      : Lucide
Base spacing     : 4px
Default radius   : 8px
Default control  : 40px backoffice, 48px touch
Component model  : Custom visual + accessible headless behavior
Source of truth  : design-system.md -> token -> packages/ui -> feature
```
