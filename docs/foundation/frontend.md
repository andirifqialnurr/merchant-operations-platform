# Frontend — Cafe Companion Pro

**Status:** Kontrak struktur dan aturan kode frontend
**Tanggal:** 2 Oktober 2026
**Cakupan:** `apps/web`, `packages/ui`, `apps/storybook`

Dokumen terkait: [`design-system.md`](./design-system.md), [`flowchart.md`](./flowchart.md), [`architecture.md`](./architecture.md).

---

## 1. Kondisi saat ini

```text
apps/web/src/
  app/
    layout.tsx                 font Geist, ThemeProvider, service worker; lang="id" tetap
    page.tsx                   pemilih mode perangkat
    backoffice/catalog/page.tsx  satu-satunya halaman bisnis yang memakai API
    pos/ kds/ inventory/       placeholder
    design-system/ color-bank/ typography/ foundation/   halaman referensi dev
    globals.css  backoffice-shell.css  catalog.css  device-mode.css
    manifest.ts
  components/
    backoffice-shell.tsx
    catalog-backoffice.tsx     1.114 baris: login, master, komposisi, katalog outlet dalam satu file
    device-mode-selector.tsx
    theme/                     kontrak tema, provider, switcher
    pwa/                       cache keranjang, konfirmasi server, registrasi service worker
  lib/api-client.ts            fetch + validasi Zod
packages/ui/src/
  components/                  41 file komponen (59 ekspor), datar dalam satu folder
  styles/                      satu file CSS per komponen + token
apps/storybook/                40 story + smoke Playwright
```

### 1.1 Yang perlu dibenahi

| Temuan | Perbaikan |
|---|---|
| `catalog-backoffice.tsx` memuat login, tiga tampilan, dan semua form dalam satu file | Pecah per fitur (bagian 2) |
| Login berada di dalam komponen Catalog | Rute `(auth)` tersendiri + guard sesi di layout |
| State server dikelola manual (`useState` + `fetch`) | TanStack Query |
| Form dikelola manual | React Hook Form + skema Zod dari `packages/contracts` |
| String UI ditulis langsung dalam Bahasa Indonesia, termasuk di `packages/ui` | Kamus `id`/`en`; `packages/ui` menerima label lewat props |
| `lang="id"` tetap di `<html>` | Mengikuti bahasa aktif |
| CSS halaman (`catalog.css`, `backoffice-shell.css`) diimpor global di `layout.tsx` | Gaya milik fitur dimuat bersama fiturnya |
| `packages/ui` datar, primitive dan domain tercampur | Kelompokkan (bagian 3) |
| Ikon diimpor langsung dari `lucide-react` di halaman | Semua lewat `AppIcon`; ganti ke Tabler |
| Klien API tidak mengirim header `x-csrf-token`, sedangkan API mewajibkannya untuk mutasi bersesi | Tambahkan di klien API (lihat `security.md` bagian 5) |
| Navigasi statis | Disusun dari manifest + entitlement + izin |
| Halaman referensi dev tercampur dengan rute aplikasi | Pindahkan ke grup `(dev)` yang tidak dibangun di produksi, atau cukup di Storybook |

---

## 2. Struktur target `apps/web`

```text
apps/web/
  messages/
    id.json                    kamus Indonesia
    en.json                    kamus Inggris
  src/
    app/
      layout.tsx               html lang dinamis, provider global
      (auth)/
        login/page.tsx
      (backoffice)/
        layout.tsx             guard sesi + AppShell + konteks workspace
        page.tsx               beranda: ringkasan modul aktif
        catalog/  inventory/  finance/  hc/  customers/  reports/
        floor/                 edit tata letak
        settings/              organisasi, pengguna & peran, perangkat, langganan
        modules/               Explore Modules
      (pos)/
        layout.tsx             shell layar penuh + guard perangkat/shift
        pos/  pos/tables/  pos/orders/  pos/shift/
      (kds)/
        layout.tsx
        kds/  kds/history/
      (customer)/
        layout.tsx             tanpa sesi merchant; tema merchant
        t/[token]/             resolusi QR -> menu -> keranjang -> status
        m/[slug]/              profil dan menu publik
      (platform)/
        layout.tsx             guard sesi platform
        platform/login/  platform/workspaces/  platform/packages/  platform/audit/
    features/
      catalog/
        api/                   query dan mutation (TanStack Query)
        components/            ProductTable, ProductSheet, CategoryList, …
        hooks/
        schemas.ts             re-export skema dari contracts + skema form
        index.ts               ekspor publik fitur
      pos/  kds/  floor/  inventory/  finance/  hc/  customers/  platform/  auth/  workspace/
    shell/
      backoffice-shell.tsx
      pos-shell.tsx
      kds-shell.tsx
      navigation.ts            menyusun navigasi dari manifest + akses
    lib/
      api/                     klien HTTP, error, header konteks, CSRF, idempotency
      query/                   QueryClient, kunci query
      i18n/                    konfigurasi next-intl, format
      access/                  hook akses: useCan, useModuleState
      realtime/                klien Socket.IO + ambil ulang
      pwa/                     cache keranjang, konfirmasi server
    i18n/request.ts            resolusi bahasa dari cookie
    providers/                 Theme, Query, Intl, Toast
```

### 2.1 Aturan impor

| Dari | Boleh mengimpor |
|---|---|
| `app/**` (rute) | `features/*` (hanya `index.ts`), `shell/*`, `lib/*`, `@merchant/ui` |
| `features/x` | `lib/*`, `@merchant/ui`, `@merchant/contracts` |
| `features/x` → `features/y` | **Dilarang**, kecuali melalui `index.ts` dan hanya untuk komponen tampilan (misalnya pemilih produk) |
| `lib/*` | `@merchant/contracts`; tidak mengimpor `features/*` |
| `@merchant/ui` | Tidak mengimpor apa pun dari `apps/web` atau `@merchant/contracts` |

File rute (`page.tsx`) tipis: mengambil parameter, memeriksa akses, dan merender komponen fitur. Tidak ada logika bisnis di file rute.

---

## 3. Struktur target `packages/ui`

```text
packages/ui/src/
  styles/
    primitives.css  tokens.css  tailwind-theme.css  typography.css  foundation.css
  primitives/        Button, IconButton, Input, Textarea, Select, Combobox, MultiSelect,
                     Checkbox, Radio, Switch, SegmentedControl, QuantityStepper,
                     NumberInput, MoneyInput, DatePicker, TimeInput, FileUpload, PinInput,
                     Badge, Chip, Alert, Toast, Spinner, Progress, Skeleton,
                     Dialog, AlertDialog, Sheet, Popover, DropdownMenu, Tooltip,
                     Tabs, Breadcrumb, Pagination, Stepper, Avatar, Divider, Accordion,
                     AppIcon
  patterns/          AppShell, Sidebar, TopBar, ContextSwitcher, UserMenu, BottomNav,
                     PageHeader, FilterBar, DataTable, DescriptionList, Panel,
                     MetricCard, Timeline, Chart, EmptyState, ErrorState, StatusBar,
                     ModuleAccessState, UsageLimitState, MoneyDisplay
  domain/
    pos/  floor/  kds/  inventory/  finance/  hc/  customer/  platform/
```

Aturan `packages/ui`:

- **Tanpa data dan tanpa jaringan.** Komponen menerima props dan memanggil callback. Tidak ada `fetch`, tidak ada TanStack Query, tidak ada akses router.
- **Tanpa string UI bawaan.** Semua label, placeholder, dan teks aksesibel masuk lewat props (`labels={{ … }}`), sehingga `apps/web` yang menerjemahkan.
- **Tanpa warna mentah.** Hanya semantic token.
- **Status domain lewat enum**, bukan warna.
- Setiap komponen punya story (semua variant, ukuran, state; terang dan gelap; S/M/L; label panjang `id` dan `en`) dan test (interaksi + axe).
- Ekspor per komponen melalui `exports` di `package.json` agar tree-shaking tetap bekerja.

---

## 4. Data dan state

### 4.1 Pembagian state

| Jenis state | Tempat | Contoh |
|---|---|---|
| Server | TanStack Query | Daftar produk, pesanan, ticket |
| URL | `searchParams` | Filter, tab, halaman, ID baris yang dibuka |
| Form | React Hook Form | Isian sebelum disimpan |
| UI lokal | `useState` | Dialog terbuka |
| Lintas komponen yang benar-benar perlu | Zustand | Keranjang POS, draft editor tata letak |
| Preferensi perangkat | `localStorage` | Tema POS/KDS, volume KDS |

Tidak ada salinan data server di state global. Filter Backoffice hidup di URL agar dapat dibagikan dan bertahan saat muat ulang.

### 4.2 Klien API

```ts
// lib/api/client.ts
apiRequest(path, {
  method, body,
  responseSchema,          // wajib: semua response divalidasi Zod
  context: { workspaceId, locationId },   // menjadi header konteks
  idempotent: true,        // menambahkan Idempotency-Key untuk mutasi kritis
});
```

Klien API bertanggung jawab atas: `credentials: "include"`; header konteks; header `x-request-id`; header `x-csrf-token` untuk metode tidak aman; `Idempotency-Key`; validasi response; dan pemetaan error menjadi `ApiClientError { code, status, details, requestId }`.

Halaman dan komponen tidak pernah memanggil `fetch` langsung.

### 4.3 Query dan mutation

```ts
// features/catalog/api/products.ts
export const productKeys = {
  all: (ws: string) => ["catalog", ws, "products"] as const,
};

export function useProducts(ws: string) {
  return useQuery({ queryKey: productKeys.all(ws), queryFn: () => catalogApi.list(ws) });
}

export function useCreateProduct(ws: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateCatalogProduct) => catalogApi.createProduct(ws, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: productKeys.all(ws) }),
  });
}
```

Aturan:

- Kunci query **selalu** menyertakan `workspaceId` (dan `locationId` bila relevan). Berganti workspace membersihkan cache.
- Mutasi final (kirim pesanan, bayar, refund, mutasi stok, posting keuangan, persetujuan) **tidak** memakai pembaruan optimistis. UI menunggu konfirmasi server.
- Pembaruan optimistis hanya untuk perubahan yang mudah dibatalkan (urutan tampilan, toggle preferensi).
- Tombol yang memicu mutasi menampilkan loading dan mencegah klik ganda; kunci idempotency dibuat sekali per niat pengguna, bukan per percobaan.
- Error ditangani berdasarkan `code`, bukan teks pesan.

### 4.4 Form

- Skema validasi berasal dari `packages/contracts`; form tidak menulis ulang aturan yang sama.
- Nilai uang di form disimpan sebagai string integer satuan terkecil; format hanya di tampilan.
- Error validasi server (`VALIDATION_ERROR` + `details.issues`) dipetakan kembali ke field.
- Isian dipertahankan ketika penyimpanan gagal.
- Nilai turunan (total, selisih, saldo) tidak pernah menjadi field form dan tidak dikirim sebagai payload.

### 4.5 Realtime

POS dan KDS berlangganan melalui Socket.IO dengan cakupan workspace, lokasi, dan station. Event realtime hanya memicu `invalidateQueries`; isi layar selalu berasal dari REST. Setelah tersambung ulang, klien mengambil ulang dan menampilkan status data usang sampai selesai.

---

## 5. Akses dan navigasi

```ts
const { state } = useModuleState("kds");          // not-entitled | provisioning | setup-required | active | paused | suspended
const canRefund = useCan("pos.sale.refund");      // izin + capability + cakupan lokasi
```

- Navigasi disusun dari: jenis workspace + template + instalasi aktif + entitlement + izin + konteks lokasi + feature flag.
- Modul yang tidak aktif tidak muncul di navigasi dan diarahkan ke state akses bila dibuka lewat URL langsung.
- Layout tiap grup rute memeriksa sesi; halaman memeriksa state modul sebelum merender.
- Aksi yang tidak diizinkan disembunyikan; aksi yang diizinkan tetapi belum memenuhi syarat ditampilkan nonaktif dengan alasan.
- Semua pemeriksaan di frontend adalah tampilan. Backend tetap menjadi batas otorisasi.
- Berganti workspace: bersihkan cache query, putuskan dan sambung ulang realtime, muat ulang navigasi. Berganti lokasi: perbarui cakupan query dan aksi.

---

## 6. Bahasa (i18n)

**Pustaka:** `next-intl`, mode tanpa prefix URL (bahasa dari cookie).

```text
apps/web/messages/id.json, en.json
apps/web/src/i18n/request.ts     membaca cookie "locale" -> memuat kamus
apps/web/next.config.ts          plugin next-intl
app/layout.tsx                   <html lang={locale}> + NextIntlClientProvider
```

### 6.1 Penentuan bahasa

```text
1. Pilihan tersimpan pengguna (users.locale) — setelah login
2. Cookie "locale" — pilihan manual pada perangkat ini
3. Bahasa browser (header Accept-Language): "en*" -> en, selain itu -> id
4. "id"
```

Bawaan mengikuti bahasa browser (keputusan D-09). Tidak ada bahasa bawaan per workspace: dua pengguna pada workspace yang sama dapat melihat bahasa berbeda.

Pengguna mengganti bahasa dari menu akun: klien menulis cookie, menyimpan pilihan ke profil, lalu `router.refresh()`. Halaman tidak berpindah rute dan state form tidak hilang. Customer mengganti bahasa dari header; pilihannya hanya disimpan di cookie.

### 6.2 Struktur kamus

```json
{
  "common": { "save": "Simpan", "cancel": "Batal", "search": "Cari" },
  "nav": { "catalog": "Katalog", "inventory": "Stok" },
  "catalog": {
    "products": {
      "title": "Produk",
      "create": "Tambah produk",
      "empty": "Belum ada produk."
    }
  },
  "status": { "order": { "SUBMITTED": "Pesanan masuk" } },
  "errors": {
    "PERMISSION_DENIED": "Anda tidak punya akses untuk tindakan ini.",
    "LIMIT_REACHED": "Batas {dimension} tercapai ({usage} dari {limit})."
  }
}
```

Aturan:

- Kunci: `fitur.bagian.elemen`, bahasa Inggris, `camelCase`.
- Enum domain diterjemahkan lewat `status.<domain>.<ENUM>`; enum tidak pernah ditampilkan mentah.
- Kode error API diterjemahkan lewat `errors.<CODE>`; bila kunci tidak ada, tampilkan `errors.UNKNOWN` beserta `requestId`.
- Tidak merangkai kalimat dari potongan; pakai parameter dan bentuk jamak ICU.
- Kedua kamus harus punya kunci yang sama; test membandingkannya di CI.
- Lint melarang literal string JSX di `apps/web/src` (kecuali simbol dan angka).
- Data merchant tidak diterjemahkan.

### 6.3 Format

Uang, angka, tanggal, dan waktu diformat dengan `Intl` melalui pembantu di `lib/i18n/format.ts` (`formatMoney`, `formatDate`, `formatNumber`). Bahasa menentukan format; zona waktu selalu milik lokasi. `MoneyDisplay` di `packages/ui` menerima `locale` sebagai props.

---

## 7. Tema

- `next-themes` dengan atribut `data-theme`; pilihan `light`, `dark`, `system`.
- Preferensi: per perangkat (`localStorage`) untuk POS/KDS; per pengguna (`users.theme`) untuk Backoffice dan Platform; mengikuti sistem untuk Customer.
- Token didefinisikan sekali di `packages/ui/src/styles/tokens.css`; kode fitur tidak menulis `dark:`.
- `Chart` membaca tema aktif dan mengganti palet tanpa memuat ulang halaman.
- `themeColor` pada viewport PWA mengikuti `bg.canvas` kedua mode.

---

## 8. Ikon dan chart

**Ikon.** `AppIcon` menjadi satu-satunya pintu:

```tsx
import { IconReceipt } from "@tabler/icons-react";
<AppIcon icon={IconReceipt} size="md" />
<AppIcon icon={IconAlertTriangle} size="sm" label={t("common.warning")} />
```

Migrasi: ganti tipe ikon di `app-icon.tsx`, ganti impor `lucide-react` di `apps/web`, `packages/ui`, dan `apps/storybook`, lalu hapus dependensi `lucide-react`. Lint melarang impor pustaka ikon di luar `packages/ui` dan pemanggilnya lewat `AppIcon`.

**Chart.** Wrapper `Chart` di `packages/ui` membungkus `react-apexcharts`:

- dimuat dinamis tanpa SSR (`next/dynamic`, `ssr: false`) karena ApexCharts membutuhkan `window`;
- menerima `series`, `categories`, `type`, `locale`, dan pemformat nilai;
- menerapkan palet, font, grid, dan tooltip dari design system;
- menyediakan state loading, kosong, error, dan ringkasan teks.

Halaman tidak mengimpor `apexcharts` atau `react-apexcharts` langsung.

---

## 9. SOLID dalam praktik

| Prinsip | Aturan di repo ini |
|---|---|
| **S** — satu tanggung jawab | Komponen tampilan tidak mengambil data. Hook data tidak merender. File rute tidak berisi logika. Komponen di atas ±250 baris dipecah |
| **O** — terbuka untuk perluasan | Variasi lewat `variant`/`size`/slot, bukan menyalin komponen. Modul baru menambah folder `features/x` dan entri manifest, tanpa mengubah shell |
| **L** — dapat disubstitusi | Komponen yang membungkus elemen native meneruskan props, `ref`, dan `aria-*` elemen tersebut |
| **I** — antarmuka kecil | Props seperlunya; komponen domain menerima DTO tampilan yang sempit, bukan objek API utuh. Ini juga mencegah data sensitif ikut terbawa |
| **D** — bergantung pada abstraksi | Fitur bergantung pada hook data dan klien API bertipe, bukan pada `fetch`. `packages/ui` bergantung pada props, bukan pada router, kamus, atau query |

Aturan tambahan:

- Server Component secara bawaan; `"use client"` hanya pada komponen yang butuh interaksi, dan diletakkan serendah mungkin.
- Pemetaan DTO API → props tampilan dilakukan di `features/x`, dengan fungsi pemeta yang diuji. Field yang dilarang untuk suatu surface dibuang di pemeta (pola yang sudah dipakai untuk KDS dan QR pelanggan).
- Tidak ada `any`; tidak ada `as` untuk membungkam tipe response.
- Komponen yang sama tidak dibuat dua kali untuk HP dan desktop; satu komponen, tata letak responsif.

---

## 10. Pola halaman

Halaman daftar Backoffice mengikuti satu pola:

```tsx
export default function ProductsPage() {
  return (
    <ModuleGate module="catalog">
      <PageHeader title={t("catalog.products.title")} primaryAction={<CreateProductButton />} />
      <ProductFilterBar />
      <ProductTable />          {/* loading, kosong, error ditangani di dalam */}
      <ProductSheet />          {/* terbuka dari ?id= di URL */}
    </ModuleGate>
  );
}
```

- Detail dan edit dibuka sebagai `Sheet` dari baris tabel; ID baris ada di URL.
- Halaman tidak mengulang konteks workspace/lokasi; itu milik shell.
- Setiap halaman menyediakan state: loading (skeleton), kosong, error dengan coba lagi, tanpa izin, dan state modul.
- Aturan isi halaman mengikuti `design-system.md` bagian 4.

---

## 11. PWA dan offline

- Service worker menyimpan shell aplikasi dan aset statis.
- Cache lokal: katalog terakhir untuk tampilan dan draft keranjang.
- Operasi finansial dan stok selalu menunggu konfirmasi server (`lib/pwa/server-acknowledgement`).
- Saat offline: tampilkan `StatusBar`, nonaktifkan aksi yang butuh server, dan pertahankan draft.
- Perubahan breakpoint dan tema tidak mereset keranjang, draft form, atau konteks.

---

## 12. Kinerja

- Gambar produk lewat `next/image` dengan ukuran yang ditentukan.
- ApexCharts, editor tata letak, dan pemilih tanggal dimuat dinamis.
- Daftar panjang (produk POS, ticket, transaksi) memakai pagination atau virtualisasi.
- Impor ikon per nama.
- Tidak ada pustaka yang dipasang sebelum tahap yang membutuhkannya.

---

## 13. Test

| Jenis | Alat | Lokasi |
|---|---|---|
| Komponen + aksesibilitas | Vitest, Testing Library, axe | `packages/ui/src/**/*.test.tsx` |
| Story smoke | Playwright | `apps/storybook/tests` |
| Unit fitur (pemeta, hook, util) | Vitest | `apps/web/src/features/**` |
| Kesamaan kunci kamus | Vitest | `apps/web/messages` |
| E2E alur kritis | Playwright | (belum ada) login, katalog, POS, KDS |

Gerbang tiap halaman: lint, typecheck, test terkait, smoke rute HTTP, smoke klik di browser, S/M/L + batas 320/767/768/1279/1280, terang dan gelap, `id` dan `en`, keyboard dan fokus, serta data guard.

---

## 14. Urutan pengerjaan fondasi UI

Setiap butir adalah checkpoint yang dapat di-push sendiri.

1. Token Calm Neutral di `tokens.css`/`primitives.css` — **selesai**; pratinjau di `/color-bank`.
2. `AppIcon` ke Tabler; ganti semua impor ikon; hapus `lucide-react`.
3. `next-intl`: plugin, `i18n/request.ts`, kamus awal, `LanguageSwitcher`; keluarkan string dari `packages/ui`.
4. Klien API: header CSRF, idempotency, error bertipe; pasang TanStack Query.
5. `AppShell`, `ContextSwitcher`, `UserMenu`, `PageHeader`, `FilterBar`, `Chip`, `ModuleAccessState`, `UsageLimitState`.
6. Grup rute dan guard: `(auth)`, `(backoffice)`, `(pos)`, `(kds)`, `(customer)`, `(platform)`.
7. Pecah `catalog-backoffice.tsx` menjadi `features/catalog` dengan pola halaman bagian 10 — halaman pertama yang sepenuhnya mengikuti aturan baru.
8. Benahi komponen lama **satu per satu** (satu komponen = satu checkpoint): tampilan pada palet baru, tinggi kontrol, `Panel` menggantikan kartu bersarang, hapus status `special`. Urutan: Button → Input/FormField → Select/Combobox → kontrol pilihan → Badge/Alert/Toast → overlay → navigasi → DataTable dan tampilan data → komponen domain.

Setelah butir 7 lulus gerbang, pola yang sama dipakai untuk POS, KDS, dan modul berikutnya.
