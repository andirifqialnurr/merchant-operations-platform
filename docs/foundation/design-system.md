# Design System — Cafe Companion Pro

**Status:** Source of truth visual/interaksi selaras PRD v2.3  
**Tanggal:** 5 Agustus 2026  
**Tema:** Warm Operational / Cream–Espresso–Amber  
**Mode:** Light, Dark, dan System  
**Font utama:** DM Sans  
**Font display terbatas:** Fraunces  
**Target aksesibilitas:** WCAG 2.2 Level AA

## 1. Tujuan dokumen

Dokumen ini menjadi kontrak visual dan interaksi untuk seluruh Cafe Companion Pro. Semua implementasi UI pada Platform Admin, Merchant Backoffice, POS, KDS, Catalog, Floor/Table, Inventory, Business Finance, Human Capital, Customer/Self-Order, Analytics, dan future client yang memakai component system web harus mengikuti kontrak yang relevan di dokumen ini.

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
- Komponen domain POS, Floor/Table, KDS, inventory, finance, HC, analytics, platform, dan customer ordering.
- Responsive contract Small/Medium/Large, touch target, accessibility, motion, dan content style.
- UX untuk entitlement, tier, module installation, limit/usage, dan integration state.
- Struktur implementasi dan aturan agar UI tidak menyimpang.

## 2. Karakter desain

Nama arah visual adalah **Warm Operational**: pengalaman operasional yang bersih dan tenang dengan karakter Cafe Companion Pro melalui cream, espresso, dan amber yang digunakan terukur.

Karakter yang ingin dicapai:

- Tenang: tidak menggunakan terlalu banyak warna kuat pada satu layar.
- Cepat: tindakan utama dan status mudah ditemukan tanpa membaca panjang.
- Operasional: tabel, angka, pesanan, dan stok lebih penting daripada dekorasi.
- Tepercaya: transaksi dan perubahan status selalu memberikan feedback jelas.
- Hangat tetapi tidak dekoratif: identitas cafe terasa tanpa membuat HC/Finance terasa seperti menu restoran.
- Fleksibel: foundation tetap cocok untuk HC-only, Finance-only, dan use case bisnis berdekatan.
- Custom: komponen memiliki visual milik platform, bukan tampilan bawaan browser atau library.
- Accessible: keyboard, screen reader, touch, dan contrast dipertimbangkan sejak komponen dasar.

Yang harus dihindari:

- Cokelat/espresso yang dipakai sebagai blok dekoratif besar di setiap surface.
- Amber pada setiap card atau metric tanpa makna.
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
| Human Capital | HR/admin/employee web | Medium-high | Mouse, keyboard, touch | Employee, schedule, attendance, leave |
| Reports/Analytics | Owner/manager | Medium-high | Mouse, keyboard, touch | KPI, filter, chart, export |
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

Primitive berisi nilai mentah/palette internal. Primitive tidak boleh digunakan langsung oleh halaman fitur; feature memakai semantic token seperti `background`, `foreground`, `primary`, `accent`, dan status semantic.
Implementasi CSS memakai pola `--primitive-color-<token>` agar primitive tidak terekspos sebagai utility semantic Tailwind.

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

Primitive mendukung karakter cream–espresso–amber. Nilai feature tidak boleh mengambil primitive secara langsung; gunakan semantic token di bagian 6.

### 5.1 Warm brand primitives

| Primitive | Nilai baseline | Peran |
|---|---|---|
| `cream-canvas` | `oklch(0.976 0.011 84)` | Background terang |
| `cream-surface` | `oklch(0.995 0.006 90)` | Surface/card terang |
| `cream-muted` | `oklch(0.941 0.017 86)` | Surface subtle |
| `cream-border` | `oklch(0.897 0.022 82)` | Border/divider |
| `espresso-text` | `oklch(0.243 0.032 52)` | Teks utama terang |
| `espresso-primary` | `oklch(0.402 0.079 48)` | Primary action terang |
| `amber-accent` | `oklch(0.808 0.132 74)` | Accent restrained / primary gelap |
| `dark-canvas` | `oklch(0.191 0.014 60)` | Background gelap |
| `dark-surface` | `oklch(0.232 0.017 60)` | Surface gelap |
| `dark-muted` | `oklch(0.283 0.019 60)` | Surface subtle gelap |
| `dark-foreground` | `oklch(0.941 0.014 84)` | Teks utama gelap |

Accent amber bukan semantic warning. `accent` dipakai untuk highlight brand yang terukur; `warning` memakai token status tersendiri.

### 5.2 Status primitives

Status menjaga makna lintas theme dan tidak mengambil warna brand.

| Fungsi | Baseline |
|---|---|
| `success` | `oklch(0.585 0.113 152)` |
| `warning` | `oklch(0.769 0.147 70)` |
| `info` | `oklch(0.545 0.088 235)` |
| `destructive` | `oklch(0.545 0.192 27)` |

Implementasi boleh menyediakan stop light/dark tambahan selama mapping semantic dan contrast AA dipertahankan. Palet status tidak digunakan sebagai pembeda kategori produk.

## 6. Semantic theme

### 6.1 Light mode baseline

| Semantic token | Nilai baseline | Penggunaan |
|---|---|---|
| `background` / `bg.canvas` | `oklch(0.976 0.011 84)` | App background |
| `foreground` / `text.primary` | `oklch(0.243 0.032 52)` | Teks utama |
| `card` / `bg.surface` | `oklch(0.995 0.006 90)` | Surface/card |
| `bg.surfaceSubtle` | `oklch(0.941 0.017 86)` | Header table/filter |
| `primary` / `action.primary` | `oklch(0.402 0.079 48)` | Main CTA/active nav |
| `accent` | `oklch(0.808 0.132 74)` | Restrained highlight |
| `border.default` | `oklch(0.897 0.022 82)` | Control/card border |
| `text.secondary` | Derived espresso-muted dengan contrast AA | Deskripsi/meta |
| `text.disabled` | Derived muted yang tetap terbaca | Disabled |
| `focus.ring` | Derived primary/accent dengan contrast >=3:1 | Focus |
| `bg.overlay` | Espresso dengan alpha yang tervalidasi | Overlay |

### 6.2 Dark mode baseline

Dark mode menggunakan espresso-charcoal hangat, bukan black murni dan bukan navy sebagai identitas utama.

| Semantic token | Nilai baseline | Penggunaan |
|---|---|---|
| `background` / `bg.canvas` | `oklch(0.191 0.014 60)` | App background |
| `foreground` / `text.primary` | `oklch(0.941 0.014 84)` | Teks utama |
| `card` / `bg.surface` | `oklch(0.232 0.017 60)` | Surface/card |
| `bg.surfaceSubtle` | `oklch(0.283 0.019 60)` | Header/filter/subtle |
| `primary` / `action.primary` | `oklch(0.808 0.132 74)` | Main CTA |
| `border.default` | `oklch(0.994 0.01 84 / 12%)` | Divider/default border |
| `text.secondary` | Derived cream-muted dengan contrast AA | Deskripsi/meta |
| `focus.ring` | Derived amber/cream dengan contrast >=3:1 | Focus |
| `bg.overlay` | Near-black warm alpha | Overlay |

Surface dibedakan terutama melalui luminance, border, dan spacing; shadow berat dihindari.

### 6.3 Status light dan dark

Status semantic: `neutral`, `info`, `success`, `warning`, `danger/destructive`, dan `special` bila benar-benar dibutuhkan oleh domain. Setiap theme harus menyediakan pasangan text/background/border yang lolos contrast.

Aturan:

- label teks selalu ada untuk state domain;
- icon dan warna hanya mempercepat pengenalan;
- `accent` brand tidak mengganti `warning`;
- revenue tidak otomatis hijau dan expense tidak otomatis merah;
- domain component menerima enum, bukan raw color.

### 6.4 Theme behavior

Pilihan tema:

- `Light`;
- `Dark`;
- `System` mengikuti `prefers-color-scheme`.

Persistence:

- POS dan KDS: per device;
- Backoffice/HC Admin/Platform Admin: per user;
- Customer ordering: system default dengan override opsional;
- theme bukan setting global workspace.

Perubahan theme tidak boleh refresh halaman, mereset cart/form/filter/context, atau mengubah entitlement state.

## 7. Merchant branding

Brand override hanya berlaku pada public Cafe Profile/Customer Self-Order. Operational surfaces tetap memakai Cafe Companion Pro visual agar status dan controls konsisten.

Public surface dapat menggunakan:

- logo;
- banner/cover;
- nama, deskripsi, alamat, jam buka;
- preset brand color yang sudah diuji contrast.

Aturan:

- merchant primary tidak mengganti success/warning/danger;
- on-primary dipasangkan sistem, bukan dipilih bebas;
- arbitrary hex ditunda sampai contrast validation tersedia;
- custom font merchant bukan baseline R1;
- logo tidak mengganti label action;
- branding tidak boleh mengubah layout contract S/M/L atau accessibility.

## 8. Typography

### 8.1 Font family

```text
UI utama        : DM Sans
Fallback        : ui-sans-serif, system-ui, sans-serif
Display terbatas: Fraunces
```

DM Sans dipakai pada seluruh operational UI, table, form, navigation, POS, KDS, finance, dan HC. Fraunces hanya untuk brand/storefront title atau selected marketing-like heading; tidak dipakai pada dense table, timer, nominal finance, label kecil, atau form controls.

Font harus dibundel/self-hosted melalui mekanisme build yang stabil; tidak bergantung pada runtime font CDN.

### 8.2 Font weight

| Token | Weight | Penggunaan |
|---|---:|---|
| `regular` | 400 | Body |
| `medium` | 500 | Label/button/table header |
| `semibold` | 600 | Section/summary |
| `bold` | 700 | Page title/KPI/display terbatas |

### 8.3 Type scale

| Token | Large/Medium | Small | Weight | Penggunaan |
|---|---:|---:|---:|---|
| `display-lg` | `36/44px` | `30/38px` | 700 | Storefront hero terbatas |
| `heading-1` | `28/36px` | `24/32px` | 700 | Major page title |
| `heading-2` | `22/30px` | `20/28px` | 700 | Section utama |
| `heading-3` | `18/26px` | `18/26px` | 600 | Card/section title |
| `body-lg` | `16/24px` | `16/24px` | 400/500 | Important body/touch |
| `body` | `14/22px` | `14/22px` | 400 | Default UI |
| `body-sm` | `13/20px` | `13/20px` | 400/500 | Dense table/meta |
| `caption` | `12/18px` | `12/18px` | 400/500 | Helper/secondary |
| `micro` | `11/16px` | `11/16px` | 500/600 | Badge/compact metadata |
| `numeric-lg` | `28/34px` | `24/30px` | 700 | KPI/important numeric |

Teks interaktif/body tidak boleh dibuat lebih kecil dari contract hanya untuk mengejar density.

### 8.4 Numeric typography

Gunakan `font-variant-numeric: tabular-nums` untuk money, quantity, timer, nomor antrean, stock balance, dan report.

Format Indonesia baseline:

- backoffice/report: `Rp 125.000`;
- percentage: `12,5%`;
- date: `5 Agu 2026`;
- clock: pilih satu format dan konsisten; rekomendasi `14.35`, sedangkan timer tetap `14:35`.
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
- Semantic `primary` menjadi series utama; `info`, `special`, `warning/accent`, dan neutral menjadi pembanding yang lolos contrast serta tidak mengaburkan makna status.
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

### 19.7 Module Access State

Satu pattern menjelaskan alasan sebuah modul/fitur belum dapat dipakai tanpa mencampur konsep yang berbeda.

State minimum:

- `not-entitled`: modul/capability tidak termasuk subscription; operational nav tidak menampilkan modul, sedangkan Explore Modules boleh menampilkan CTA upgrade;
- `provisioning`: entitlement ada tetapi installation sedang dipersiapkan;
- `setup-required`: installation ada tetapi konfigurasi/binding wajib belum lengkap;
- `active`: feature dapat digunakan sesuai permission;
- `paused/error`: tampilkan safe reason, last-known state, retry/setup action;
- `permission-denied`: user tidak berhak meskipun workspace entitled;
- `feature-unavailable`: feature flag/delivery status belum membuka feature;
- `subscription-suspended`: read/export/corrective action mengikuti policy.

UI dan API error copy harus dapat membedakan `ENTITLEMENT_REQUIRED`, `TIER_UPGRADE_REQUIRED`, `INSTALLATION_SETUP_REQUIRED`, `LIMIT_REACHED`, `RATE_LIMITED`, dan `SUBSCRIPTION_SUSPENDED`. Jangan menggunakan satu generic `Fitur tidak tersedia` untuk seluruh kondisi.

### 19.8 Usage dan Limit State

Pattern limit menampilkan:

- dimension label yang manusiawi;
- current usage dan effective limit;
- percentage/threshold state bila relevan;
- reset/effective date;
- allowed corrective action;
- CTA add-on/upgrade bila user berhak melihat billing.

Threshold UI: normal `<80%`, approaching `80–89,99%`, near-limit `90–99,99%`, dan at/over-limit `>=100%`.

Hard count limit dapat memblokir create/activate resource baru. Soft-metered operational event tidak boleh dipresentasikan sebagai transaksi gagal hanya karena quota; owner/admin menerima usage warning secara terpisah. Cashier/Kitchen/Employee tidak perlu melihat detail billing kecuali action mereka benar-benar tidak dapat dilakukan.

Responsive adalah baseline produk dan **bukan** usage dimension, capability, tier, atau add-on.

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
- Closing / waiting payment.
- Cleaning.
- Inactive/non-service.
- Reserved hanya jika reservation capability aktif.

Tile menampilkan public label meja, capacity, jumlah guest/order aktif, durasi session, dan status label. Status tidak hanya berupa fill warna seluruh tile.

Pada layout, `TableTile` memiliki dua mode:

- `view`: read-only untuk POS, dapat dipilih untuk membuka/membuat order.
- `edit`: dipilih, dipindah, dan diubah ukurannya oleh manager berizin.

Menggeser tile pada mode edit hanya mengubah posisi visual dan tidak memindahkan order/table session. Operasi `Move table` adalah domain action terpisah.

### 20.9 Floor Selector

Memilih lantai aktif pada table layout.

Variant:

- `tabs`: 2-5 lantai pada desktop/tablet.
- `select`: lantai lebih banyak atau ruang sempit.
- `compact`: POS toolbar.

Size mengikuti Tabs/Select `sm`, `md`, atau `lg`. Label lantai harus berupa nama yang dimengerti staff seperti `Lantai 1`, `Mezzanine`, atau `Rooftop`, bukan database ID.

Location yang baru dapat memakai `Main Floor` tanpa user harus membuat lantai secara manual. Floor tidak merepresentasikan `Indoor/Outdoor`; grouping seperti itu berada di Area.

### 20.9A Area Selector

Area adalah grouping user-defined di dalam Floor. Contoh: `Indoor`, `Outdoor`, `Smoking`, `VIP`, `Garden`, `Bar`, `Terrace`.

Variant:

- chips/tabs untuk 2–6 area;
- select/combobox jika area banyak;
- compact filter pada Live Table View.

`Main Area` dibuat sebagai default untuk cafe sederhana. Area tidak boleh di-hardcode menjadi enum Indoor/Outdoor karena workspace bebas memberi nama sesuai kebutuhan.

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
- Basic mendukung shape `SQUARE`, `RECTANGLE`, `ROUND` dan rotasi `0/90` derajat.
- Kapasitas adalah integer bisnis; kursi dirender otomatis sebagai visual dari capacity + shape dan bukan record terpisah.
- Visual size Basic adalah `SMALL`, `MEDIUM`, `LARGE`; user tidak diwajibkan mengisi centimeter.
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

Large menyediakan full canvas + palette + persistent property panel. Medium menyediakan touch canvas + collapsible panel. Small menyediakan pannable/simplified editor dan form/sheet untuk konfigurasi sehingga precision drag bukan satu-satunya cara menyelesaikan setup.

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
- Visual size `SMALL`, `MEDIUM`, `LARGE`.
- Grid width/height yang diturunkan/diatur sesuai capability.
- Rotation `0/90` pada Basic.
- Floor dan area opsional.
- Active state.
- QR ordering flag.
- QR status dan shortcut pengelolaan QR.

Position grid dapat ditampilkan untuk aksesibilitas, tetapi user umum mengatur melalui canvas. Mengganti floor untuk meja yang memiliki session aktif memerlukan policy/validation.

### 20.13 Unplaced Table Tray

Menampilkan meja yang belum mempunyai posisi pada lantai aktif. Meja dapat diseret ke canvas atau dipilih lalu diberi posisi melalui property panel. Empty state: `Semua meja sudah ditempatkan`.

### 20.14 QR Table Card

Menampilkan outlet/location, floor, area, meja, QR image, status/version, print/download, rotate/regenerate, revoke, dan last generated. Raw token/hash/internal table ID tidak dirender sebagai teks. QR selalu memiliki quiet zone serta ukuran minimum cetak yang diuji. Rotate/regenerate memerlukan konfirmasi karena QR lama menjadi tidak berlaku.

QR Table Card juga menampilkan lantai dan memastikan perubahan posisi meja tidak mengganti token. Status minimal: active, revoked, dan not generated.

### 20.14A Live Table View dan Table Session Panel

Live Table View adalah surface operasional terpisah dari Edit Layout.

Minimum behavior:

- filter Floor + Area + status;
- lihat `AVAILABLE`, `OCCUPIED`, `CLOSING`, `CLEANING`, `INACTIVE`;
- pilih meja lalu lihat guest count, session duration, order/bill aktif, dan allowed action;
- open table session dengan guest count;
- add order batch ke session yang sama;
- move session ke meja lain tanpa membuat ulang order/bill;
- request/checkout/close sesuai role dan lifecycle;
- Small menyediakan list fallback selain canvas.

`Move table` pada Small menggunakan source/destination selection yang eksplisit; drag bukan requirement. `Merge/Split table session` adalah capability Pro dan tetap harus dapat digunakan secara responsif bila user ter-entitle. Reservation state/action tidak ditampilkan tanpa capability reservation.

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

## 25. Human Capital components

HC Admin R1 berada di Business Backoffice. Employee self-service web dapat memakai pattern yang sama dengan density/touch yang lebih rendah; native mobile HC adalah future client.

### 25.1 Employee Row/Card

Menampilkan public employee number, nama, employment status, department/job, primary location/branch, dan optional avatar. Data sensitif seperti salary future, attendance evidence mentah, internal ID, atau document secret tidak masuk row default.

Responsive:

- Large: Data Table + detail panel;
- Medium: compact table/card + drawer;
- Small: employee cards/rows + full-screen detail/edit.

### 25.2 Employee Detail Header

Variant active, on-leave, inactive, terminated. Header menampilkan identity bisnis dan allowed action. User account linkage ditampilkan sebagai status terpisah karena Employee tidak sama dengan User.

### 25.3 Schedule Calendar/Board

- Large: week/calendar grid + employee/location filter + detail panel;
- Medium: compact week grid atau list + drawer;
- Small: day/week agenda list; tidak memaksa desktop calendar grid mengecil.

Publish schedule adalah mutation terpisah dari save draft dan memerlukan acknowledgement. Timezone location harus terlihat bila user mengelola lebih dari satu zona waktu.

### 25.4 Attendance Event/Record

`AttendanceEventRow` menampilkan employee, event type, occurred time, source, validation status, dan safe evidence summary. `AttendanceRecordCard` menampilkan schedule vs actual, late/early/overtime derived metrics, dan correction state.

Status: `PENDING`, `VALID`, `NEEDS_REVIEW`, `REJECTED`. Correction tidak mengedit event lama; UI membuat correction flow dengan reason + audit.

GPS, photo/selfie, device trust, dan raw validation payload hanya tampil bila capability, permission, privacy policy, dan data minimization mengizinkan. Evidence bukan editable input.

### 25.5 Leave Request

Menampilkan type, range, duration, balance/context, reason, status, approver, dan history. Approve/reject memakai action spesifik dan reason sesuai policy. Small memakai stacked detail + sticky allowed action.

### 25.6 HC tier states

- Basic R1: employee, schedule, web/manual attendance, leave, basic report.
- Pro future: mobile attendance, geofence, selfie evidence, device trust, timesheet/advanced leave policy.
- Advanced future: payroll, recruitment, performance, training, biometric integration, roster optimization.

Locked capability menjelaskan tier/add-on yang diperlukan; jangan merender Pro/Advanced sebagai feature aktif jika delivery status masih Future.

## 26. Platform admin components

### 26.1 Workspace Switch/Context

Super-admin harus selalu melihat apakah sedang berada pada platform context atau support context workspace. Label dapat menampilkan Tenant/Company sesuai business template, tetapi internal identity tetap workspace. Support context menggunakan persistent banner dan reason/expiry.

### 26.2 Entitlement Matrix

Table/matrix menampilkan module, tier, minimum capability, package default, workspace override, add-on, effective state, delivery status, reason, actor, dan effective time. Effective state tidak hanya checkbox; dependency dan source harus terlihat.

### 26.3 Subscription Status

Mapping: trial info, active success, grace warning, suspended danger, terminated neutral/danger. Perubahan status menggunakan confirmation dialog dan audit reason.

### 26.4 Package/Limit/Installation Panel

Platform Admin harus dapat membedakan:

- package version snapshot;
- module tier;
- included capability;
- effective limit dan usage;
- module installation/status/setup;
- integration binding/status;
- feature flag.

Jangan satukan semuanya menjadi toggle `module active`. Package version yang published ditampilkan immutable; perubahan membuat version/override baru sesuai policy.

### 26.5 Audit Event

Compact timeline/table dengan actor, action, target, workspace/location, before/after summary aman, reason, time, dan request ID. Sensitive value dimasking.

## 27. Status language contract

### 27.1 Order dan fulfillment

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

### 27.2 Payment manual

| Enum | Label | Semantic |
|---|---|---|
| `UNPAID` | Belum dibayar | Neutral |
| `VERIFYING` | Menunggu konfirmasi | Warning |
| `PAID` | Lunas | Success |
| `REFUND_PENDING` | Refund diproses | Warning/special |
| `REFUNDED` | Dikembalikan | Special |

Istilah `Pembayaran berhasil` hanya boleh muncul setelah backend menyimpan status `PAID`.

### 27.3 Table dan session

| State | Label | Semantic |
|---|---|---|
| `AVAILABLE` | Tersedia | Success/neutral sesuai density |
| `OCCUPIED` | Terisi | Info |
| `CLOSING` | Menunggu selesai/bayar | Warning |
| `CLEANING` | Dibersihkan | Neutral/info |
| `INACTIVE` | Tidak aktif | Neutral |
| `RESERVED` | Direservasi | Warning; hanya jika capability aktif |

Table status adalah projection lifecycle, bukan editable badge bebas.

### 27.4 Installation dan integration

| Domain | State penting |
|---|---|
| Installation | provisioning, setup required, active, paused/suspended, error |
| Integration binding | draft, setup required, active, paused, error, disabled |

`Setup required` berbeda dari `Error`: setup berarti konfigurasi belum lengkap; error berarti konfigurasi/proses yang seharusnya berjalan mengalami masalah.

### 27.5 Inventory

Stock availability: `OK`, `LOW`, `OUT`, dan bila policy mengizinkan `NEGATIVE`. Movement type bukan success/error; `RECEIPT`, `CONSUMPTION`, `REVERSAL`, `WASTE`, `ADJUSTMENT`, `TRANSFER_IN/OUT` memakai type badge netral/informatif.

### 27.6 Business Finance

Transaction state minimum: `DRAFT`, `POSTED`, `REVERSED`; reconciliation: `PENDING`, `RECONCILED`, `EXCEPTION`. Basic HPP/profit selalu menyertakan label `Estimasi operasional`.

### 27.7 Human Capital

Attendance validation: `PENDING`, `VALID`, `NEEDS_REVIEW`, `REJECTED`. Leave request: `DRAFT`, `SUBMITTED`, `APPROVED`, `REJECTED`, `CANCELLED`. Employment status bukan attendance status dan tidak disatukan dalam enum global.

### 27.8 Connection

`ONLINE`, `CONNECTING`, `RECONNECTING`, `OFFLINE`, `STALE`, `SYNC_FAILED`. Realtime indicator tidak boleh memberi kesan transaksi tersimpan bila server acknowledgement belum diterima.

## 28. Layout system

### 28.1 Breakpoint

Tiga kelas berikut adalah **product acceptance contract**. Breakpoint implementasi tambahan boleh dipakai sebagai refinement, tetapi tidak mengganti tiga state ini.

| Kelas | Width viewport CSS | Sasaran | Baseline QA |
|---|---:|---|---:|
| `S` Small | `320–767px` | Single-column/touch-first | `390×844` |
| `M` Medium | `768–1279px` | Compact multi-pane, touch/mouse hybrid | `1024×768` |
| `L` Large | `>=1280px` | Multi-column/dense management | `1440×900` |

Aturan:

- class ditentukan oleh width CSS, bukan user-agent atau nama device;
- minimum supported R1 adalah `320px`;
- boundary QA wajib `320`, `767`, `768`, `1279`, `1280`;
- orientasi tidak mengganti class bila width aktual tetap sama;
- container query boleh dipakai untuk reusable component;
- pada Tailwind, acceptance state dapat dipetakan ke base `<768`, `md >=768`, `xl >=1280`; breakpoint lain hanya refinement;
- resize/breakpoint transition tidak boleh mereset cart, form draft, selected workspace/location, active filter, atau domain state.

### 28.2 Page container

| Context | Max width | Padding |
|---|---:|---:|
| Backoffice list | `1440px` | `16/24/32px` responsive |
| Backoffice form | `960px` | `16/24px` |
| Detail page | `1200px` | `16/24/32px` |
| Customer ordering | `720px` | `16px` |
| Auth/setup | `480px` | `16-24px` |
| POS/KDS | Full viewport | Surface-specific |

### 28.3 Grid

- Small: 4-column layout grid bila grid dibutuhkan.
- Medium: 8-column layout grid.
- Large: 12-column layout grid.
- Gap `16px` Small/Medium, `24px` Large sebagai baseline.
- Dashboard metrics menggunakan minimum card width, bukan jumlah kolom tetap.

### 28.4 Page anatomy

```text
Breadcrumb/context
Page title + primary action
Optional summary/alert
Filter/action bar
Main content
Pagination/secondary information
```

Tidak semua halaman membutuhkan semua bagian. Single-purpose POS/KDS tidak memakai page anatomy backoffice.

### 28.5 Section

- Section gap default `24px`, major section `32px`.
- Section heading dan action berada satu row pada desktop, stacked mobile.
- Divider digunakan jika dua section berada pada surface yang sama.
- Jangan membungkus setiap section dengan card jika page surface sudah cukup.

## 29. Surface-specific layout

### 29.1 POS

```text
Category rail 160-200px
Product area flexible
Cart 360-420px
```

- Large: catalog/product area + persistent cart side-by-side.
- Medium: catalog + compact cart pada landscape; cart boleh collapsible/drawer bila ruang efektif sempit.
- Small: catalog menjadi primary view; cart dibuka via sticky summary, bottom sheet, atau page/step checkout yang jelas.
- Product grid memakai minimum readable tile width.
- Dine-in dapat membuka table-layout view per lantai sebelum masuk product/cart flow.
- Table-layout view mempertahankan posisi meja dan menampilkan status realtime tanpa mengizinkan drag.
- Payment flow dapat mengganti cart panel atau membuka dedicated panel.
- Cart/checkout state tidak hilang saat viewport berubah.

### 29.2 KDS

- Full viewport tanpa sidebar utama.
- Top bar minimal `56px`.
- Large: adaptive multi-column grid dengan minimum readable ticket width.
- Medium: 2–3 kolom tipikal; jangan memaksa jika content membutuhkan lebih lebar.
- Small: 1-column prioritized queue; status/timer/action selalu terlihat tanpa page-level horizontal scroll.
- History/filter berada pada drawer atau secondary screen.
- Dark mode dapat menjadi default device setting, tetapi tetap dapat diubah.

### 29.3 Backoffice

- Large: sidebar persistent `240px` atau collapsed `72px`.
- Medium: collapsible sidebar/rail + 1–2 column content selektif.
- Small: drawer navigation, single-column, table kompleks menjadi summary row/card + detail.
- Content tidak otomatis full-width untuk form.
- Table list dapat memakai lebar penuh.
- Sticky filter/action hanya jika list panjang dan tidak mengurangi viewport secara berlebihan.

HC Admin mengikuti Backoffice shell: Large table/calendar + detail panel, Medium compact table/calendar + drawer, Small employee/attendance cards + agenda/detail full-screen.

### 29.4 Customer ordering

- Small: mobile-first 1–2 column sesuai minimum card width, sticky cart, modifier/order flow one-handed.
- Medium: 2–3 column catalog bila content memungkinkan.
- Large: centered responsive catalog; jangan meregangkan content tanpa batas.
- Merchant/category header dapat sticky secara bertahap.
- Sticky cart menggunakan safe-area inset.

### 29.5 Platform admin

- Density default/compact.
- Workspace/Tenant context selalu terlihat.
- Table dan audit dapat full-width.
- Support impersonation/access banner tidak boleh dapat ditutup selama session aktif.

Large memakai dense table + detail drawer, Medium compact table/drawer, Small summary rows/cards + filter sheet + full-screen detail.

### 29.6 Floor/Table

`Live Table View` dan `Edit Layout` memiliki responsive behavior berbeda:

| Mode | Large | Medium | Small |
|---|---|---|---|
| Live Table View | Full floor canvas + docked operational context | Pan/zoom touch canvas + collapsible detail | Pannable view + **list fallback**; open/add/move/close tetap tersedia |
| Edit Layout | Full canvas + palette + persistent property panel | Touch canvas + collapsible palette/property | Simplified editor; pilih meja lalu edit via sheet/form; precision drag tidak wajib |

Zoom/recenter control pada Medium/Small minimum `44×44px`. Move table pada Small menggunakan source/destination selection. Capability merge/split Pro tetap dapat diakses secara responsive setelah ter-entitle.

### 29.7 Inventory, Finance, dan Analytics

- Inventory: Large table/list; Medium compact table/cards; Small item/movement cards + single-column mutation form.
- Business Finance: Large KPI/report multi-column + transaction table; Medium 2-column KPI + compact transaction list; Small KPI stack + transaction cards + single-column form.
- Analytics: Large multi-card/chart grid; Medium 2-column/stack; Small single-column. Chart boleh scroll **di dalam chart container** bila semantik memerlukan, bukan membuat page overflow.

## 30. Responsive dan touch behavior

Responsive adalah kontrak produk lintas tier dan package, bukan best-effort CSS. Capability yang dimiliki user harus memiliki primary read/mutation flow pada S/M/L kecuali hardware/surface requirement dinyatakan eksplisit.

### 30.1 Global transformation contract

| Concern | Large | Medium | Small |
|---|---|---|---|
| Navigation | Persistent sidebar + header/context | Collapsible sidebar/rail | Drawer atau compact primary navigation |
| Page grid | Multi-column | 1–2 column | Single-column |
| Dense data | Full table/list | Compact table | Summary row/card + detail screen/sheet |
| Filter | Inline + advanced | Compact + drawer | Search + filter sheet; active count terlihat |
| Form | 1–2 column | 1–2 selective | 1 column |
| Detail/edit | Page/panel/dialog | Drawer/sheet | Full-screen detail atau bottom sheet |
| Primary action | Header/toolbar | Toolbar/sticky | Sticky bottom action boleh dipakai dengan safe-area |
| KPI/chart | Multi-card grid | 2-column/stack | Single-column |

Aturan umum:

- responsive bukan desktop UI yang sekadar diperkecil;
- tidak ada page-level horizontal scroll pada Small kecuali data table/canvas khusus dengan affordance jelas;
- primary action tetap reachable tanpa menutup field aktif;
- hover tidak dibutuhkan untuk menyelesaikan tugas;
- internal standard target `40px` desktop dan `44–48px` untuk touch; Floor/POS/KDS/Customer touch action minimum `44×44px`;
- safe-area inset wajib untuk sticky mobile bar;
- virtual keyboard tidak menutup active field/checkout CTA;
- modal panjang berubah menjadi sheet/full-screen pada Small;
- loading, empty, error, permission, locked, setup-required, and over-limit state harus responsif sama seperti happy path;
- light dan dark harus lulus S/M/L.

### 30.2 Data priority dan table transformation

Kolom/data management memakai priority metadata:

- `P0`: identity + status, selalu ada;
- `P1`: primary metric/context, tampil bila ruang cukup;
- `P2`: secondary metadata, boleh dipindah ke detail;
- `P3`: tertiary/audit metadata, detail-only pada Small.

Transformasi table -> card/row pada Small tidak mengubah API, permission, audit, limit, atau domain semantics. Bulk action dapat masuk selection mode khusus, bukan dihapus.

Responsive component priority:

```text
Pertahankan fungsi kritis
-> pindahkan secondary action ke overflow
-> stack layout
-> ubah panel menjadi drawer
-> sembunyikan metadata nonkritis
```

Data kritis, status, total, dan primary action tidak boleh disembunyikan hanya untuk membuat layout muat.

### 30.3 Responsive QA contract

Setiap page R1 diuji sekurangnya pada `390×844`, `1024×768`, `1440×900`, dan width boundary `320/767/768/1279/1280`.

Minimum pass:

- tidak ada content/action utama terpotong;
- navigation/context/filter/form/detail/primary mutation dapat diselesaikan;
- tidak ada accidental page-level horizontal overflow;
- keyboard/focus tetap benar pada management surface;
- touch target kritis memenuhi ukuran internal;
- zoom/text 200% tidak menghilangkan task utama;
- breakpoint switch tidak mereset draft/domain state.

## 31. Accessibility

Target adalah WCAG 2.2 Level AA.

### 31.1 Contrast

- Teks normal minimal `4.5:1`.
- Teks besar minimal `3:1`.
- Komponen, border penting, dan focus indicator minimal `3:1` terhadap warna sekitar.
- Contrast diuji untuk light, dark, dan seluruh merchant preset.
- Disabled content dikecualikan dari sebagian requirement tetapi tetap harus dapat dikenali.

### 31.2 Keyboard

- Semua fungsi dapat dicapai tanpa mouse.
- Urutan tab mengikuti urutan visual/logis.
- Skip link tersedia pada backoffice/platform admin.
- Dialog melakukan focus trap dan mengembalikan focus ke trigger.
- Dropdown, select, combobox, tabs, radio, dan date picker mengikuti pola keyboard WAI-ARIA.
- Shortcut POS tidak boleh bertabrakan dengan browser/screen reader dan harus terdokumentasi.

### 31.3 Focus

- Gunakan `:focus-visible`, bukan menghapus outline.
- Focus ring `2px` dengan offset `2px`.
- Focus tidak tertutup sticky header/footer.
- Selected dan focused adalah state berbeda.
- Dark mode memiliki focus ring lebih terang.

### 31.4 Screen reader

- Icon-only button memiliki accessible name.
- Status update kritis memakai live region secukupnya.
- Table memiliki header/association yang benar.
- Error summary menghubungkan user ke field bermasalah.
- Price, quantity, timer, dan order number memiliki pembacaan yang bermakna.
- Decorative icon/image disembunyikan dari accessibility tree.

### 31.5 Color dan sensory information

- Status memakai text + icon + color.
- Required/error tidak hanya ditandai warna.
- Instruksi tidak boleh hanya mengatakan `tekan tombol hijau di kanan`.
- Chart menyediakan label, tooltip, atau summary nonvisual.

### 31.6 Zoom dan reflow

- Backoffice tetap dapat digunakan pada zoom 200%.
- Text tidak terpotong jika ukuran font sistem membesar.
- KDS menyediakan density setting, bukan mengunci ukuran terlalu kecil.
- Customer page mengikuti user font scaling sejauh platform browser memungkinkan.

## 32. Motion dan sound

### 32.1 Duration

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

### 32.2 KDS sound

- Audio hanya untuk event penting seperti ticket baru atau reconnect failure.
- Volume dan mute disimpan per device.
- Sound memiliki visual equivalent.
- Event berulang dibatasi agar tidak menimbulkan spam.

## 33. Content design dan locale

### 33.1 Bahasa

- Bahasa UI Version 1: Bahasa Indonesia.
- Istilah menggunakan bahasa operasional yang umum: `Pesanan`, `Meja`, `Kasir`, `Dapur`, `Stok`, `Pengeluaran`.
- Nama module teknis tidak ditampilkan kepada customer.
- Gunakan sentence case, bukan Title Case berlebihan.

### 33.2 Action label

Gunakan kata kerja spesifik:

| Hindari | Gunakan |
|---|---|
| OK | Konfirmasi pembayaran |
| Submit | Kirim pesanan |
| Yes | Batalkan pesanan |
| Process | Mulai siapkan |
| Save changes | Simpan perubahan |
| Delete | Hapus produk |

### 33.3 Error copy

Pola:

```text
Apa yang gagal
Mengapa jika aman untuk dijelaskan
Apa yang dapat dilakukan user
```

Contoh: `Pesanan belum dapat dikirim karena koneksi terputus. Periksa jaringan lalu coba lagi.`

Hindari: `Something went wrong`, `Error 500`, atau pesan provider/database.

### 33.4 Format lokal

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

## 34. Image, logo, dan media

- Product image ratio default `1:1`.
- Customer hero/banner ratio `16:6` sampai `16:9` sesuai viewport.
- Logo merchant ditempatkan pada safe container dan tidak dipaksa stretch.
- Gunakan object-fit cover untuk product/banner, contain untuk logo/QR/provider logo.
- Sediakan placeholder dan broken-image state.
- Upload menghasilkan preview dan crop guidance.
- Informasi kritis tidak ditanam hanya di dalam gambar.
- Dark mode tidak mengubah foto; logo yang tidak terbaca memerlukan neutral backing surface.

## 35. Light-dark component mapping

Komponen tidak boleh sekadar membalik `white` menjadi `black`. Mapping berikut menjadi acuan.

| Komponen | Light | Dark |
|---|---|---|
| App canvas | Cream canvas semantic | Warm espresso-charcoal canvas |
| Card/panel | Cream/near-white surface + subtle border | Warm dark surface + default border |
| Raised overlay | Raised cream + light shadow | Raised warm-dark + strong border |
| Input | Surface + control border | Dark surface + control border |
| Neutral hover | Warm muted surface | Dark muted surface |
| Primary button | Espresso primary + safe on-primary | Amber primary + safe dark on-primary |
| Secondary button | Warm muted + foreground | Dark muted + foreground |
| Outline button | Surface + border | Transparent/dark surface + border |
| Ghost button | Transparent | Transparent |
| Tooltip | Espresso inverse + cream text | Cream inverse + espresso text |
| Table header | Warm muted surface | Dark muted surface |
| Selected row | Primary-subtle warm | Primary-subtle dark |
| Skeleton | Warm neutral muted | Dark neutral muted |
| Overlay | Espresso alpha | Near-black warm alpha |

Visual regression harus memotret kedua mode. Perubahan komponen dianggap belum selesai jika hanya diverifikasi pada satu theme.

## 36. Struktur implementasi

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

### 36.1 Styling

- Tailwind CSS digunakan sebagai utility layer.
- Theme token didefinisikan sebagai CSS variables dan diekspos melalui Tailwind theme variables.
- Variant class dikelola terpusat, direkomendasikan memakai `class-variance-authority` atau pola setara.
- Class conflict ditangani melalui helper terkontrol seperti `tailwind-merge`.
- Radix/headless primitive boleh dipakai untuk behavior dan accessibility, tetapi seluruh visual berasal dari design system ini.
- Tidak mengambil theme bawaan komponen pihak ketiga.

### 36.2 Theme selector

Root document menggunakan attribute/class yang stabil:

```html
<html data-theme=light>
<html data-theme=dark>
```

`System` menghitung preference pengguna lalu menerapkan theme sebelum paint untuk mencegah flash. CSS juga menetapkan `color-scheme: light` atau `dark` agar browser chrome/form fallback selaras.

### 36.3 Token example

```css
:root,
[data-theme=light] {
  --color-bg-canvas: oklch(0.976 0.011 84);
  --color-bg-surface: oklch(0.995 0.006 90);
  --color-text-primary: oklch(0.243 0.032 52);
  --color-border-default: oklch(0.897 0.022 82);
  --color-action-primary: oklch(0.402 0.079 48);
  --color-accent: oklch(0.808 0.132 74);
}

[data-theme=dark] {
  color-scheme: dark;
  --color-bg-canvas: oklch(0.191 0.014 60);
  --color-bg-surface: oklch(0.232 0.017 60);
  --color-text-primary: oklch(0.941 0.014 84);
  --color-border-default: oklch(0.994 0.01 84 / 12%);
  --color-action-primary: oklch(0.808 0.132 74);
}
```

Nama token final harus konsisten dan tidak dicampur antara format `color.primary` di dokumentasi dan CSS variable tanpa mapping yang jelas.

### 36.4 Font loading

DM Sans dan Fraunces harus dibundel/self-hosted melalui mekanisme font build yang stabil, bukan runtime CDN. DM Sans menjadi root UI font. Fraunces dimuat hanya untuk display/brand usage yang ditentukan agar tidak menyusup ke dense operational UI. Gunakan `font-display: swap` atau behavior setara dan verifikasi layout shift.

### 36.5 Component API

Setiap component API minimal mempertimbangkan:

- `variant`.
- `size`.
- `disabled`.
- `loading` jika relevan.
- `className` untuk layout adjustment, bukan menimpa visual contract.
- `aria-*` dan ref forwarding.
- Controlled/uncontrolled behavior jika relevan.

Feature tidak boleh mengirim props seperti `backgroundColor=#...`. Domain status menerima enum dan component menentukan visual mapping.

## 37. Component bank

Sebelum halaman fitur dibangun, buat catalog visual melalui Storybook atau internal `/ui-lab`. Storybook direkomendasikan karena dapat mendokumentasikan props, state, viewport, dan theme tanpa masuk ke business route.

Setiap story wajib menampilkan:

- Seluruh size.
- Seluruh variant.
- Default, hover reference, focus, disabled, loading, dan error.
- Light dan dark mode.
- Long Indonesian label.
- Empty/zero/large numeric value.
- Small, Medium, dan Large viewport sesuai contract `320–767`, `768–1279`, `>=1280`.

### 37.1 Priority P0 - sebelum halaman

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

### 37.2 Priority P1 - flow operasional

- Page/Entity Header, Filter Bar, Action Bar.
- Module Access State dan Usage/Limit State.
- Money Display dan Metric Card.
- Product Tile, Category Rail, Modifier Picker.
- Cart Item, Cart Summary, Sticky Cart Bar.
- Order Card, Order Status, Payment Status.
- Table Tile dan QR Table Card.
- Floor Selector, Area Selector, Table Layout Canvas/Toolbar, Table Property Panel, Unplaced Table Tray, Live Table View, dan Table Session Panel.
- Payment Method Tile, Cash Keypad, Confirmation Panel.
- Kitchen Ticket dan KDS Timer.
- Network/Sync Indicator.

### 37.3 Priority P2 - inventory, finance, HC, platform

- Stock Indicator, Movement Row, Movement Type Badge.
- Inventory Item Picker, Stock Adjustment, Stocktake Table.
- Recipe/BOM Editor.
- Finance Metric, Ledger Row, Reconciliation, Shift Summary.
- Financial Report Table dan Chart wrapper.
- Workspace Context, Entitlement Matrix, Package/Limit/Installation State, Subscription Status.
- Employee Row/Card, Schedule view, Attendance Record/Event, Leave Request.
- Audit Event dan Timeline.

Component bank bukan halaman showcase sekali pakai. Ia menjadi tempat verifikasi sebelum component digunakan atau diubah.

## 38. Testing design system

### 38.1 Unit/component test

- Variant dan size menghasilkan semantics yang tepat.
- Keyboard interaction.
- Focus management.
- Controlled/uncontrolled state.
- Loading mencegah duplicate action.
- Domain enum selalu memiliki mapping visual/label.

### 38.2 Accessibility test

- Automated axe pada story/page kritis.
- Keyboard-only manual pass.
- Screen reader smoke test untuk dialog, form, table, status, dan KDS update.
- Contrast check seluruh semantic token light/dark dan merchant preset.
- Zoom/reflow 200% pada backoffice dan customer flow.

### 38.3 Visual regression

Snapshot minimal untuk:

- Button dan form states.
- Dialog/drawer/dropdown.
- Data table.
- POS product/cart/payment.
- Table layout view/edit pada light dan dark mode, termasuk selected, overlap, unsaved, dan revoked QR state.
- Live Table View S/M/L termasuk occupied/closing/cleaning, list fallback Small, dan move-table selection.
- KDS ticket states.
- Customer product/cart/manual payment.
- Inventory adjustment.
- Finance summary/report.
- HC employee/schedule/attendance/leave.
- Module access state: not-entitled, setup-required, paused/error, permission denied, over-limit.
- Platform Package/Entitlement/Limit state.

Setiap snapshot kritis dibuat untuk light dan dark mode serta baseline S/M/L `390×844`, `1024×768`, `1440×900` menurut relevansi surface.

### 38.4 End-to-end visual behavior

- Theme tetap setelah reload/login.
- Theme switch tidak menghapus draft.
- Customer mengikuti system preference.
- POS/KDS menyimpan theme per device.
- Overlay dan sticky action tidak menutup content pada Small.
- Resize `767 -> 768` dan `1279 -> 1280` tidak mereset cart, form draft, context, atau selected resource.
- Boundary `320/767/768/1279/1280` tidak menghasilkan page overflow/action hilang.
- Capability yang ter-entitle tidak menghasilkan upgrade CTA hanya karena viewport Small/Medium.
- Floor Basic tetap dapat create/edit table, QR, session, dan move pada Small tanpa precision drag.

## 39. Governance

### 39.1 Aturan coding

- Tidak ada raw hex pada feature component.
- Tidak ada arbitrary radius/shadow/spacing tanpa alasan dan pembaruan dokumen.
- Tidak membuat button/input/modal versi fitur sendiri.
- Tidak memakai native select/date/dialog dengan visual browser sebagai final UI.
- Tidak menyalin class panjang antarhalaman; ekstrak pattern/component jika berulang.
- Domain component tidak mengakses data workspace lain dan hanya menerima data yang dibutuhkan.
- Visual hidden bukan authorization; backend tetap memvalidasi permission.

### 39.2 Perubahan design system

Perubahan token atau component contract harus:

1. Menjelaskan alasan dan surface terdampak.
2. Memperbarui `design-system.md`.
3. Memperbarui component bank/story.
4. Memverifikasi light dan dark.
5. Menjalankan accessibility dan visual regression terkait.
6. Menghindari breaking change diam-diam pada feature.

### 39.3 Definition of Done komponen

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

## 40. Batas Version 1

Termasuk:

- Light, dark, dan system theme.
- Warm cream–espresso–amber foundation dan merchant preset storefront yang tervalidasi.
- DM Sans untuk operational UI dan Fraunces terbatas untuk display/brand.
- Custom component dasar dan domain utama.
- Responsive merchant/customer/platform web.
- Responsive Backoffice/POS/KDS/Customer/Inventory/Finance/HC/Platform pada tiga class S/M/L.
- Touch-first POS/KDS/customer/Floor pada action kritis.
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

## 41. Checklist sebelum coding halaman

- [ ] Token primitive dan semantic light/dark sudah dibuat.
- [ ] DM Sans dan Fraunces sudah dibundel; fallback benar; Fraunces tidak dipakai pada dense operational UI.
- [ ] Theme tanpa flash dan persistence bekerja.
- [ ] P0 component bank tersedia.
- [ ] Contrast light/dark dan brand preset lulus.
- [ ] Button/input/select/dialog/table tidak memakai visual default browser.
- [ ] Focus dan keyboard pattern diuji.
- [ ] POS touch controls memakai size `lg`.
- [ ] KDS ticket dapat dibaca pada target perangkat.
- [ ] Table layout per lantai menggunakan logical grid dan editor menolak overlap/out-of-bounds.
- [ ] Floor -> Area -> Table memakai `Main Floor/Main Area` default; Indoor/Outdoor adalah user-defined Area.
- [ ] Basic menyediakan SQUARE/RECTANGLE/ROUND, capacity + derived chairs, visual size, dan rotation 0/90.
- [ ] POS table-layout view read-only menampilkan posisi serta status realtime.
- [ ] Table layout dapat dioperasikan tanpa drag melalui keyboard/property panel.
- [ ] Live Table View dan Edit Layout dipisahkan; Small mempunyai list fallback dan move-table selection.
- [ ] Merge/split tidak tampil aktif tanpa Floor Pro; reservation tidak tampil aktif tanpa capability terkait.
- [ ] Tidak ada tool atau asset denah bangunan pada Version 1.
- [ ] Customer sticky cart aman terhadap viewport/safe area.
- [ ] Module state membedakan entitlement, permission, installation/setup, feature flag, dan limit.
- [ ] Limit state tidak memblokir corrective operation yang dijamin PRD.
- [ ] HC Basic components menjaga Employee != User dan attendance correction append-only secara UX.
- [ ] Money dan numeric display memakai tabular numbers.
- [ ] Domain status memakai enum-to-token mapping.
- [ ] Visual regression light/dark untuk komponen utama tersedia.
- [ ] S/M/L baseline `390×844`, `1024×768`, `1440×900` dan boundary `320/767/768/1279/1280` lulus.

## 42. Referensi

Referensi ini digunakan untuk prinsip dan pola interaksi, bukan untuk menyalin visual produknya.

### Typography dan tooling

- DM Sans dan Fraunces: implementasi memakai font bundle/self-hosted yang tervalidasi pada codebase.
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

## 43. Keputusan final Version 1

```text
Visual direction : Warm Operational
Primary palette  : Cream / Espresso / Amber
Neutral palette  : Warm neutral / espresso-charcoal
Themes           : Light, Dark, System
UI font          : DM Sans
Display font     : Fraunces terbatas
Icon family      : Lucide
Base spacing     : 4px
Default radius   : 8px
Default control  : 40px backoffice, 48px touch
Component model  : Custom visual + accessible headless behavior
Responsive       : S 320-767 / M 768-1279 / L >=1280
Source of truth  : design-system.md -> token -> packages/ui -> feature
```
