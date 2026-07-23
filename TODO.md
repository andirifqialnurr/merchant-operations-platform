# TODO - Merchant Operations Platform

**Status:** Implementation roadmap  
**Tanggal:** 14 Juli 2026  
**Acuan:** `architecture.md`, `design-system.md`, dan PRD MVP Release 1  
**Strategi:** Satu tahap -> verifikasi -> commit/push -> lanjut tahap berikutnya

## 1. Cara menggunakan TODO ini

Status checkbox:

- `[x]` selesai dan sudah diverifikasi.
- `[ ]` belum dikerjakan.

Aturan pengerjaan:

1. Kerjakan hanya satu tahap aktif.
2. Jangan memulai tahap berikutnya sebelum acceptance gate tahap aktif terpenuhi.
3. Setiap tahap harus dapat dipush sebagai commit yang berdiri sendiri.
4. Update checkbox TODO pada commit yang sama dengan implementasinya.
5. Jangan memasang package yang baru dibutuhkan beberapa tahap kemudian.
6. Jangan membuat halaman fitur sebelum token, theme, typography, dan primitive component stabil.
7. Light dan dark mode harus diselesaikan bersamaan, bukan dark mode menyusul.
8. Komponen menggunakan visual custom; Radix/headless hanya menjadi behavior layer.
9. Tidak mengambil theme atau tampilan default shadcn/component library sebagai hasil final.
10. Jika keputusan implementasi berbeda dari dokumen, perbarui dokumen terkait sebelum melanjutkan.
11. Patuhi `UI slicing data guard` di `AGENTS.md`: setiap datum wajib memiliki sumber, tujuan, klasifikasi input/display/derived/hidden, serta satu lokasi utama tanpa duplikasi.

## 2. Status saat ini

### Fondasi produk yang sudah tersedia

- [x] Architecture Version 1.
- [x] Global Product Scope.
- [x] PRD MVP Release 1.
- [x] Paket dan pricelist awal.
- [x] Design system light/dark/system.
- [x] Geist Sans dipilih sebagai UI font.
- [x] Operational Teal dan Slate/Navy dipilih sebagai palet dasar.
- [x] Table layout per lantai ditetapkan sebagai scope Version 1.

### Tahap implementasi berikutnya

> **NEXT: Review, commit, dan push Shift component; lalu lanjutkan POS order/payment manual flow sebagai checkpoint terpisah.**

Typography Bank Tahap 5 dan Layout/Icon Foundation Tahap 6 sudah diimplementasikan serta lolos verifikasi statis, production build, HTTP smoke test, review visual light/dark, reflow setara zoom 200%, dan reduced-motion render.

## 3. Keputusan stack yang dikunci

| Area            | Pilihan                                                       |
| --------------- | ------------------------------------------------------------- |
| Bahasa          | TypeScript strict                                             |
| Runtime         | Node.js 24 LTS                                                |
| Package manager | pnpm                                                          |
| Monorepo        | pnpm workspace + Turborepo                                    |
| Web             | Next.js App Router + React                                    |
| API             | NestJS modular monolith                                       |
| Worker          | Node.js worker process                                        |
| Styling         | Tailwind CSS + CSS design tokens                              |
| UI behavior     | Radix/headless primitives                                     |
| Font            | Geist Sans + Geist Mono terbatas                              |
| Icon            | Lucide                                                        |
| Server state    | TanStack Query                                                |
| Local state     | Zustand secukupnya                                            |
| Form            | React Hook Form + Zod                                         |
| Database        | PostgreSQL + Prisma                                           |
| Queue           | Redis + BullMQ                                                |
| Component bank  | Storybook                                                     |
| Component test  | Vitest + Testing Library + axe                                |
| E2E             | Playwright                                                    |
| Chart           | ApexCharts + `react-apexcharts` melalui wrapper `packages/ui` |

Versi package tidak ditulis longgar sebagai asumsi di TODO. Saat tahap instalasi dimulai, cek kompatibilitas resmi, pilih versi stabil, lalu kunci melalui `pnpm-lock.yaml`.

---

## 4. PRIORITAS P0 - Fondasi Project dan Design System

### Tahap 1 - Inisialisasi workspace dan struktur project

**Tujuan:** Membuat kerangka repository tanpa business feature dan tanpa custom UI.

#### 1.1 Root workspace

- [x] Buat root `package.json` dengan `packageManager` pnpm yang dipin.
- [x] Buat `pnpm-workspace.yaml`.
- [x] Buat `turbo.json`.
- [x] Buat `.nvmrc` atau `.node-version` untuk Node.js 24 LTS.
- [x] Buat `.editorconfig`.
- [x] Lengkapi `.gitignore` untuk Node, Next.js, NestJS, Prisma, Storybook, coverage, dan environment file.
- [x] Buat `.env.example` tanpa secret.
- [x] Tentukan script root minimum: `dev`, `build`, `lint`, `typecheck`, `test`, dan `format:check`.

#### 1.2 Struktur monorepo

- [x] Buat `apps/web` untuk Next.js.
- [x] Buat `apps/api` untuk NestJS.
- [x] Buat `apps/worker` untuk background worker.
- [x] Buat `packages/ui` untuk token dan primitive component.
- [x] Buat `packages/contracts` untuk shared schema/API contract.
- [x] Buat `packages/database` untuk Prisma schema dan migration.
- [x] Buat `packages/typescript-config`.
- [x] Buat `packages/eslint-config`.
- [x] Buat folder `infrastructure/docker` dan `infrastructure/deployment` tanpa deployment production dahulu.

#### 1.3 Boundary awal

- [x] `apps/web` tidak menyimpan business rule backend.
- [x] `packages/ui` tidak bergantung pada domain POS/inventory/finance.
- [x] `packages/contracts` tidak mengimpor kode dari `apps/*`.
- [x] Belum membuat route fitur, database table, atau screen bisnis.

#### Acceptance gate Tahap 1

- [x] Seluruh struktur sesuai `architecture.md`.
- [x] Semua manifest/config dapat dibaca tanpa syntax error.
- [x] Tidak ada secret atau `.env` aktual yang ikut repository.
- [x] `git status` hanya menunjukkan file yang memang bagian Tahap 1.
- [x] TODO Tahap 1 diperbarui.

**Commit yang disarankan:**

```text
chore: initialize pnpm turborepo workspace
```

**STOP:** Push dan review Tahap 1 sebelum instalasi dependency.

---

### Tahap 2 - Instalasi dependency fondasi

**Tujuan:** Memasang hanya dependency yang diperlukan untuk menjalankan skeleton dan membangun design system.

#### 2.1 Root tooling

- [x] Install dan pin Turborepo.
- [x] Install TypeScript.
- [x] Install ESLint dan config yang dipilih.
- [x] Install Prettier serta plugin yang benar-benar diperlukan.
- [x] Buat shared TypeScript strict config.
- [x] Buat shared lint config.

#### 2.2 Web foundation

- [x] Install Next.js, React, dan React DOM.
- [x] Install Tailwind CSS dan integration package resminya.
- [x] Install `geist`.
- [x] Install `next-themes` atau implementasi theme provider setara yang disepakati.
- [x] Install `lucide-react`.
- [x] Install `radix-ui` atau primitive Radix individual yang benar-benar digunakan.
- [x] Install `class-variance-authority`.
- [x] Install `clsx` dan `tailwind-merge`.

#### 2.3 API dan worker skeleton

- [x] Install NestJS core, platform HTTP, `reflect-metadata`, dan RxJS.
- [x] Install package minimal worker runtime.
- [x] Jangan install payment, chart, drag-and-drop, printer, atau notification package pada tahap ini.

#### 2.4 Skeleton verification

- [x] `apps/web` menampilkan halaman placeholder tanpa feature UI.
- [x] `apps/api` menyediakan health endpoint sederhana.
- [x] `apps/worker` dapat boot dan shutdown secara bersih.
- [x] Root `build`, `lint`, dan `typecheck` berjalan melalui Turborepo.
- [x] `pnpm-lock.yaml` terbentuk dan masuk repository.

#### Acceptance gate Tahap 2

- [x] Fresh `pnpm install --frozen-lockfile` berhasil.
- [x] `pnpm build` berhasil.
- [x] `pnpm lint` berhasil.
- [x] `pnpm typecheck` berhasil.
- [x] Tidak ada dependency yang belum dipakai oleh fondasi.
- [x] TODO Tahap 2 diperbarui.

**Commit yang disarankan:**

```text
chore: install workspace foundation dependencies
```

**STOP:** Push dan review dependency/lockfile sebelum membuat token warna.

---

### Tahap 3 - Color bank dan design token

**Tujuan:** Membuat source of truth warna tanpa membuat komponen bisnis.

#### 3.1 Primitive color token

- [x] Implementasikan Operational Teal `50-950` sesuai `design-system.md`.
- [x] Implementasikan Slate `50-950` dan white.
- [x] Implementasikan primitive Blue, Green, Amber, Red, dan Violet untuk status.
- [x] Jangan menggunakan raw hex di luar file token.

#### 3.2 Semantic token light

- [x] Canvas, surface, surface subtle, raised, inverse, dan overlay.
- [x] Text primary, secondary, muted, disabled, dan inverse.
- [x] Border subtle, default, control, dan strong.
- [x] Action primary, hover, pressed, on-primary, dan primary subtle.
- [x] Focus ring.
- [x] Info, success, warning, danger, dan special.

#### 3.3 Semantic token dark

- [x] Buat pasangan semantic token dark untuk seluruh token light.
- [x] Gunakan navy-slate, bukan black murni.
- [x] Pastikan surface dibedakan oleh luminance dan border.
- [x] Pastikan primary dark memakai teal terang dengan foreground aman.

#### 3.4 Merchant storefront preset

- [x] Teal.
- [x] Blue.
- [x] Indigo.
- [x] Violet.
- [x] Rose.
- [x] Orange.
- [x] Simpan `primary` dan `on-primary` sebagai satu preset contract.
- [x] Batasi override hanya untuk customer storefront.

#### 3.5 Tailwind mapping

- [x] Hubungkan CSS variables ke Tailwind theme variables.
- [x] Nama utility harus semantic, bukan berdasarkan feature.
- [x] Tambahkan guard/lint convention untuk melarang raw arbitrary color pada feature.

#### 3.6 Color bank preview

- [x] Buat preview development khusus seluruh primitive palette.
- [x] Tampilkan semantic token light dan dark berdampingan.
- [x] Tampilkan merchant preset dan pasangan foreground.
- [x] Tampilkan status color dengan label, bukan swatch saja.

#### Acceptance gate Tahap 3

- [x] Semua token di `design-system.md` mempunyai implementasi.
- [x] Contrast teks normal minimal `4.5:1`.
- [x] Contrast control/focus penting minimal `3:1`.
- [x] Tidak ada raw color pada feature/skeleton app.
- [ ] Screenshot color bank light/dark diperiksa.
- [x] Build, lint, dan typecheck lulus.

**Commit yang disarankan:**

```text
feat(ui): add light and dark color token bank
```

**STOP:** Push dan review bank warna sebelum theme switching.

---

### Tahap 4 - Theme engine Light, Dark, dan System

**Tujuan:** Menerapkan theme runtime yang stabil sebelum typography dan component.

- [x] Implementasikan `ThemeProvider` pada root web.
- [x] Mendukung `light`, `dark`, dan `system`.
- [x] Gunakan `data-theme` atau class root yang konsisten.
- [x] Set `color-scheme` sesuai theme aktif.
- [x] Cegah flash theme yang salah saat initial render/hydration.
- [x] Simpan preference sementara secara lokal; integrasi user/device dilakukan setelah identity tersedia.
- [x] Buat temporary development theme switcher.
- [x] Theme switch tidak me-refresh halaman.
- [x] Theme switch tidak menghapus state/draft lokal.
- [x] Siapkan contract persistence per user untuk backoffice dan per device untuk POS/KDS.

#### Acceptance gate Tahap 4

- [ ] Light, dark, dan system dapat dipilih.
- [ ] Reload mempertahankan pilihan lokal.
- [ ] Tidak ada hydration warning atau visible theme flash.
- [ ] Seluruh color bank berubah melalui semantic token.
- [ ] Keyboard dapat menggunakan theme switcher.
- [x] Build, lint, typecheck, dan smoke test lulus.

**Commit yang disarankan:**

```text
feat(ui): add light dark and system theme engine
```

**STOP:** Push dan review theme engine sebelum typography.

---

### Tahap 5 - Geist typography dan text-style bank

**Tujuan:** Mengunci font dan seluruh text style sebelum komponen dibuat.

#### 5.1 Font loading

- [x] Load Geist Sans dari package `geist`.
- [x] Load Geist Mono hanya untuk utility teknis.
- [x] Gunakan Inter/system sans sebagai fallback.
- [x] Tidak menggunakan runtime external font CDN.
- [x] Pastikan font tersedia pada production build dan PWA cache strategy nanti.

#### 5.2 Text style token

- [x] `caption-xs`.
- [x] `caption`.
- [x] `body-sm`.
- [x] `body`.
- [x] `body-lg`.
- [x] `label`.
- [x] `heading-sm`.
- [x] `heading`.
- [x] `heading-lg`.
- [x] `title`.
- [x] `display-sm`.
- [x] `display`.

#### 5.3 Typography utility

- [x] Weight 400, 500, 600, dan 700.
- [x] Tracking untuk display, heading, body, dan caption.
- [x] Tabular numbers utility.
- [x] Money/quantity/timer numeric style.
- [x] Truncate satu baris dan line-clamp dua/tiga baris.
- [x] Prose/long-content style belum ditambahkan karena belum dibutuhkan docs/help.

#### 5.4 Text-style preview

- [x] Tampilkan seluruh style dengan contoh Bahasa Indonesia.
- [x] Tampilkan angka, nominal, order number, dan timer.
- [x] Tampilkan long label dan mixed-case.
- [x] Verifikasi light dan dark.
- [x] Verifikasi zoom 200% dan font scaling.

#### Acceptance gate Tahap 5

- [x] Seluruh type scale `design-system.md` tersedia.
- [x] Tidak ada font-size/weight arbitrary pada preview.
- [x] Nominal dan table number memakai tabular numbers.
- [x] Geist Mono tidak digunakan untuk UI normal.
- [x] Build, lint, typecheck, dan visual review lulus.

**Commit yang disarankan:**

```text
feat(ui): add Geist typography and text style bank
```

**STOP:** Push dan review typography sebelum spacing/icon foundation.

---

### Tahap 6 - Spacing, radius, shadow, motion, dan icon foundation

**Tujuan:** Menyelesaikan seluruh visual foundation selain component.

- [x] Implementasikan spacing scale berbasis 4px.
- [x] Implementasikan control-height `xs`, `sm`, `md`, `lg`, dan `xl`.
- [x] Implementasikan radius `none`, `xs`, `sm`, `md`, `lg`, `xl`, dan `full`.
- [x] Implementasikan shadow `none`, `xs`, `sm`, `md`, dan `lg`.
- [x] Implementasikan motion duration/easing tokens.
- [x] Hormati `prefers-reduced-motion`.
- [x] Buat `AppIcon` wrapper untuk Lucide.
- [x] Kunci icon size `xs`, `sm`, `md`, `lg`, dan `xl`.
- [x] Buat preview spacing, radius, shadow, motion, dan icon.

#### Acceptance gate Tahap 6

- [x] Tidak ada arbitrary spacing/radius/shadow pada preview.
- [x] Icon menggunakan current color dan accessible rule.
- [x] Dark mode tidak bergantung pada shadow untuk membedakan surface.
- [x] Reduced-motion behavior diuji.
- [x] Build, lint, typecheck, dan visual review lulus.

**Commit yang disarankan:**

```text
feat(ui): add layout and icon foundation tokens
```

**STOP:** Push dan review seluruh foundation sebelum component bank.

---

### Tahap 6.1 - Design System Overview Hub

**Tujuan:** Menyediakan satu entry point untuk melihat dan menavigasi seluruh foundation sebelum component bank dibangun.

- [x] Buat route development `/design-system`.
- [x] Ringkas Color Bank, Typography Bank, dan Layout/Icon Foundation.
- [x] Pertahankan halaman bank detail sebagai drill-down.
- [x] Tampilkan semantic light/dark, status, typography, control height, dan icon reference.
- [x] Arahkan homepage ke Design System Hub sebagai entry point tunggal.

#### Acceptance gate Tahap 6.1

- [x] Seluruh link ke halaman bank detail valid.
- [x] Light/dark semantic comparison tampil konsisten.
- [x] Desktop dan viewport sempit tidak mengalami overflow.
- [x] Build, lint, typecheck, test, format, HTTP smoke test, dan visual review lulus.

**Commit yang disarankan:**

```text
feat(web): add design system overview hub
```

**STOP:** Report, review, commit, dan push Tahap 6.1 sebelum memulai Storybook/Tahap 7.

---

### Tahap 6.2 - Bun development runner pada port 4000

**Tujuan:** Menjadikan `bun run dev` dari root sebagai satu perintah untuk menjalankan workspace dengan aplikasi web pada port `4000`.

- [x] Ubah script development web ke `next dev --port 4000`.
- [x] Verifikasi `bun run dev` dari root menjalankan Design System Hub pada `http://localhost:4000/design-system`.

#### Acceptance gate Tahap 6.2

- [x] `bun run dev` berhasil menjalankan seluruh task development melalui Turborepo.
- [x] Design System Hub merespons HTTP `200` pada port `4000`.
- [x] Port development web tidak perlu diberikan manual melalui CLI.

#### Commit checkpoint Tahap 6.2

```text
chore(web): run Bun development server on port 4000
```

**STOP:** Report, review, commit, dan push Tahap 6.2 sebelum memulai Tahap 7.

---

### Tahap 7 - Component bank dan test harness

**Tujuan:** Menyediakan tempat resmi untuk membangun dan memeriksa custom component.

#### 7.1 Storybook

- [x] Install Storybook hanya setelah foundation selesai.
- [x] Integrasikan `packages/ui`.
- [x] Tambahkan toolbar light/dark/system.
- [x] Tambahkan viewport mobile, tablet portrait, tablet landscape, desktop, dan large display.
- [x] Load stylesheet dan Geist yang sama dengan aplikasi.

**Checkpoint 7.1:** `chore(ui): add Storybook foundation`

**STOP:** Report, review, commit, dan push Tahap 7.1 sebelum melanjutkan Test tooling Tahap 7.2.

#### 7.2 Test tooling

- [x] Install Vitest.
- [x] Install Testing Library dan user-event.
- [x] Install axe integration untuk component accessibility.
- [x] Siapkan Playwright untuk visual/smoke test ketika story kritis tersedia.
- [x] Tambahkan script root untuk component test dan Storybook build.

**Checkpoint 7.2:** `chore(test): add component and Storybook smoke test tooling`

**STOP:** Report, review, commit, dan push Tahap 7.2 sebelum melanjutkan Story contract Tahap 7.3.

#### 7.3 Story contract

- [x] Template story menampilkan size, variant, dan state.
- [x] Template light/dark visual comparison.
- [x] Template keyboard/accessibility notes.
- [x] Template long Indonesian label.
- [x] Template loading, empty, error, dan disabled.

**Checkpoint 7.3:** `chore(ui): add component story contract template`

**STOP:** Report, review, commit, dan push Tahap 7.3 sebelum melanjutkan Button foundation Tahap 8.1.

#### Acceptance gate Tahap 7

- [ ] Storybook dev dapat dibuka.
- [ ] Storybook production build berhasil.
- [ ] Theme dan font identik dengan app.
- [ ] Minimal satu foundation story melewati axe smoke test.
- [ ] Build, lint, typecheck, dan test lulus.

**Commit yang disarankan:**

```text
chore(ui): add component bank and test harness
```

**STOP:** Push dan review component bank sebelum membuat primitive pertama.

---

## 5. PRIORITAS P1 - Custom Primitive Components

Setiap sub-tahap P1 dipush terpisah. Jangan membuat seluruh component dalam satu commit.

### Tahap 8.1 - Button foundation

- [x] `Button`: primary, secondary, outline, ghost, destructive, dan link.
- [x] Size `xs`, `sm`, `md`, `lg`, dan `xl`.
- [x] Loading, disabled, icon-left, icon-right, dan full-width.
- [x] `IconButton` seluruh size.
- [x] Focus-visible, keyboard, tooltip contract, dan touch target.
- [x] Story light/dark dan component test.

**Commit:** `feat(ui): add custom button primitives`

### Tahap 8.2 - Form field dan text input

- [x] `FormField`, label, helper, error, required indicator.
- [x] `Input`, search, password, prefix, suffix, read-only, dan invalid.
- [x] `Textarea` sm/md/lg dan auto-grow variant.
- [x] Story light/dark, long label, error, disabled, dan keyboard test.

**Commit:** `feat(ui): add custom text field primitives`

### Tahap 8.3 - Selection controls

- [x] Checkbox sm/md/lg dan indeterminate.
- [x] Radio sm/md/lg.
- [x] Switch sm/md/lg.
- [x] Segmented Control sm/md/lg.
- [x] Quantity Stepper sm/md/lg.
- [x] Keyboard, touch, accessible label, light/dark stories.

**Commit:** `feat(ui): add custom selection controls`

### Tahap 8.4 - Select dan Combobox

- [x] Custom Select sm/md/lg.
- [x] Searchable Combobox single select.
- [ ] Multi-select hanya jika sudah ada use case.
- [x] Loading, no-result, error, disabled option, dan async search state.
- [x] Keyboard navigation, portal, focus, mobile sheet behavior.

**Commit:** `feat(ui): add custom select and combobox`

### Tahap 8.5 - Numeric, Money, Date, dan Time

- [x] Number Input.
- [x] Money Input dengan format IDR.
- [x] Percentage dan unit variant.
- [x] Date Picker, Date Range Picker, dan Month Picker.
- [x] Time Input format 24 jam.
- [x] Locale Indonesia, keyboard, light/dark, dan validation test.

**Commit:** `feat(ui): add numeric and date input primitives`

### Tahap 8.6 - Feedback components

- [x] Badge xs/sm/md dan semantic variants.
- [x] Alert compact/default.
- [x] Toast stack dan placement per surface.
- [x] Status Bar untuk info, success, warning, danger, loading, dan offline state.
- [x] Spinner, Progress, dan Skeleton variants.
- [x] Empty State dan Error State.
- [x] Live-region behavior dan reduced motion.

**Commit:** `feat(ui): add feedback and status components`

### Tahap 8.7 - Overlay components

- [x] Dialog xs/sm/md/lg/xl/full.
- [x] Alert Dialog destructive flow.
- [x] Drawer/Sheet sm/md/lg dan mobile behavior.
- [x] Overflow Modal/Sheet untuk action padat dan mobile behavior.
- [x] Popover.
- [x] Dropdown Menu.
- [x] Tooltip.
- [x] Focus trap/restore, Escape, portal, scroll lock, light/dark test.

**Commit:** `feat(ui): add custom overlay components`

### Tahap 8.8 - Navigation components

- [x] Sidebar expanded/collapsed/mobile.
- [x] Top Bar.
- [x] Tabs line/contained/vertical.
- [x] Breadcrumb.
- [x] Pagination.
- [x] Stepper.
- [x] Responsive dan keyboard behavior.

**Commit:** `feat(ui): add navigation components`

### Tahap 8.9 - Data-display components

- [x] Card/Panel variants.
- [x] Data Table compact/default/comfortable.
- [x] Description List.
- [x] Metric Card.
- [x] Avatar.
- [x] Divider, Accordion, dan Timeline.
- [x] Chart wrapper berbasis ApexCharts untuk line, area, bar, dan donut; dapat dipakai fitur future report setelah metriknya tervalidasi.
- [x] Install `apexcharts` dan `react-apexcharts` hanya pada tahap ini.
- [x] Chart mempunyai loading, empty, error, tooltip, legend, responsive, reduced-motion state, dan ringkasan nonvisual.

**Commit:** `feat(ui): add data display components`

### Acceptance gate seluruh P1

- [ ] Seluruh P0 component pada `design-system.md` tersedia.
- [ ] Semua component mempunyai light/dark stories.
- [ ] Semua component mempunyai size/variant/state yang terdokumentasi.
- [ ] Keyboard dan axe test lulus untuk component interaktif.
- [ ] Tidak ada default visual browser/library sebagai hasil final.
- [ ] Tidak ada raw feature color atau arbitrary style yang tidak terdokumentasi.

---

## 6. PRIORITAS P2 - Backend, Contract, dan Data Foundation

P2 dimulai setelah primitive UI stabil. P2 belum berarti membangun seluruh fitur.

### Tahap 9 - Database dan API foundation

- [x] Install Prisma, PostgreSQL driver adapter, dan client pada tahap ini, bukan sebelumnya.
- [x] Buat tenant/outlet scope foundation.
- [x] Buat migration baseline.
- [x] Buat audit, idempotency, dan outbox foundation.
- [x] Buat OpenAPI dan shared contract generation/validation.
- [x] Sediakan Swagger UI interaktif di `/api/docs` serta dokumen JSON/YAML untuk development; nonaktifkan seluruh endpoint dokumentasi di production sampai proteksi admin tersedia.
- [x] Tetapkan quality gate API: setiap endpoint baru wajib memvalidasi header, path parameter, query, body, dan response yang relevan melalui shared Zod contract sebelum fiturnya dianggap selesai.
- [ ] **[DEFERRED]** Siapkan Redis/BullMQ setelah use case worker pertama ditetapkan.
- [ ] **[DEFERRED]** Siapkan Docker Compose PostgreSQL/Redis/object storage setelah kebutuhan local service terkonfirmasi.
- [ ] **[DEFERRED]** Tambahkan integration test PostgreSQL/RLS dengan database test terisolasi; PostgreSQL development lokal sudah tersedia, tetapi belum menjadi target test yang disposable.

**Commit harus dipecah:** database baseline, API contract, lalu queue/infrastructure tidak digabung dalam satu push besar.

### Tahap 10 - Identity, tenant, outlet, dan entitlement

- [x] Authentication/session foundation.
- [x] Tenant, brand, dan outlet registry foundation; authorized HTTP routes menunggu membership/permission Tahap 10.3.
- [x] Membership, role, permission, dan outlet assignment; organization route kini dilindungi session, active membership, permission, dan tenant/outlet scope.
- [x] Subscription/module/entitlement core; active subscription kini menjadi gate seluruh route tenant dan feature route dapat menambahkan module entitlement.
- [x] Tenant-isolation regression test pada application service, authorization guard, entitlement state, dan schema constraint; integration PostgreSQL/RLS tetap mengikuti deferred gate Tahap 9.
- [x] Platform owner master foundation; identity/session platform terpisah, role-permission guard, tenant/subscription/entitlement master route, serta bootstrap CLI tanpa default credential.
- [x] Lindungi Swagger UI, asset, dan dokumen OpenAPI JSON/YAML dengan `platform_session` serta `platform.docs.read`; production tetap opt-in melalui `API_DOCS_ENABLED=true`.

**Checkpoint 10.1:** `feat(identity): add authentication and session foundation`

**Checkpoint 10.2:** `feat(organization): add tenant brand and outlet registry foundation`

**Checkpoint 10.3:** `feat(identity): add membership role and outlet access control`

**Checkpoint 10.4:** `feat(subscription): add module and entitlement core`

**Checkpoint 10.5:** `test(tenancy): add cross-tenant isolation regression suite`

**Checkpoint 10.6:** `feat(platform): add platform owner master foundation`

**Checkpoint 10.7:** `feat(api): protect production OpenAPI documentation`

**Authorization gate:** Registry route hanya dapat diakses setelah session, active membership, permission, serta tenant/outlet scope tervalidasi. Header tenant/outlet hanya memilih context dan tidak pernah menjadi bukti authorization.

**Provisioning gate:** Provisioning role default dan tenant owner tetap application service internal. Platform user pertama dibuat melalui CLI `platform:user:provision` dengan environment eksplisit; tidak ada akun, password, atau route bootstrap default. Pembuatan registry tenant kini hanya tersedia melalui platform session dengan `platform.tenant.manage`; provisioning tenant owner belum digabung menjadi onboarding HTTP sampai transaction boundary-nya tersedia.

**Entitlement gate:** Katalog module dan plan awal diprovisikan melalui migration. Mutasi subscription/override kini tersedia pada route platform dengan `platform.subscription.manage`. Route tenant tetap wajib memiliki subscription usable; route fitur menambahkan module entitlement di atas permission dan scope.

**Isolation gate:** Test tanpa database asli wajib membuktikan organization snapshot, role, membership, authorization, subscription, dan entitlement tenant A tidak membaca state tenant B. Schema-contract test menjaga composite foreign key serta unique constraint tenant tetap ada. PostgreSQL/RLS integration test belum dianggap terpenuhi sampai database test terisolasi dan disposable tersedia; database development lokal tidak dipakai sebagai pengganti gate ini.

**Documentation gate:** Development dapat menonaktifkan dokumentasi dengan `API_DOCS_ENABLED=false`. Production tidak mendaftarkan route dokumentasi secara default; `API_DOCS_ENABLED=true` hanya mendaftarkan `/api/docs`, seluruh asset UI, `/api/openapi.json`, dan `/api/openapi.yaml` di belakang session platform aktif dengan `platform.docs.read`. `merchant_session` tidak diterima.

**STOP:** Report, review, commit, dan push Tahap 10.7 sebelum melanjutkan Catalog Foundation Tahap 11.

### Tahap 11 - Catalog foundation

- [x] **11.1 Category/product core:** category dan product tenant-scoped, base price minor-unit, lifecycle status, manual availability, audit/outbox, serta service foundation tanpa route HTTP.
- [x] **11.2 Product composition:** variant, modifier group/option, product-modifier assignment, dan product image.
- [x] **11.3 Outlet catalog override:** product/outlet assignment, outlet price override, dan outlet availability/sold-out.
- [x] **11.4a Authorized Catalog API:** shared contract dan route HTTP untuk master serta outlet catalog dengan session, permission, scope, entitlement, validasi Zod, dan OpenAPI internal.
- [x] **11.4b Backoffice Catalog flow:** auth-aware web shell/client, bootstrap tenant/outlet dari sesi, dan flow pengelolaan master, composition, serta outlet catalog.
- [x] **11.4c Browser acceptance:** login/session restore, switch tenant/outlet, mutation master/composition/outlet, light/dark, mobile/reflow, dan error state diperiksa pada runtime browser dengan database lokal.
- [x] **11.4d Backoffice UI consistency:** shared application shell, sidebar responsif, top bar ringkas, context toolbar datar, section tanpa nested card, informasi teknis/metric berulang dihapus, dan alignment form distandarkan.
- [x] Jangan membangun POS sebelum catalog minimal stabil.

**Checkpoint 11.1:** `feat(catalog): add category and product core`

**Checkpoint 11.2:** `feat(catalog): add product composition foundation`

**Checkpoint 11.3:** `feat(catalog): add outlet catalog overrides`

**Checkpoint 11.4a:** `feat(catalog): expose authorized catalog api`

**Checkpoint 11.4b:** `feat(web): add authorized catalog backoffice flow`

**Checkpoint 11.4c:** `fix(catalog): close local browser acceptance`

**Checkpoint 11.4d:** `fix(web): align catalog backoffice shell`

**Catalog gate:** Harga disimpan sebagai integer minor-unit non-negatif dan dikirim sebagai decimal string agar tidak kehilangan presisi. `ACTIVE/INACTIVE` mengatur lifecycle master, sedangkan `AVAILABLE/SOLD_OUT` mengatur ketersediaan jual manual. Product wajib menunjuk category pada tenant yang sama melalui composite foreign key. Tidak ada hard delete pada master catalog.

**Composition gate:** Variant dan modifier option menyimpan surcharge minor-unit non-negatif. Modifier group menjaga `minSelections <= maxSelections` dan group `SINGLE` maksimal satu pilihan. Product-modifier assignment, variant, option, dan image memakai composite foreign key tenant. Product image menyimpan object key/metadata, menolak path traversal/content type non-raster, serta hanya mengizinkan satu primary image aktif per product. Seluruh master composition memakai lifecycle status dan mutasinya menulis audit/outbox.

**Outlet override gate:** Satu `outlet_products` row menjadi assignment product ke outlet. `priceOverrideMinor = null` dan `availabilityOverride = null` berarti mewarisi master product. Effective price/availability serta `sellable` dihitung server-side dari lifecycle tenant, outlet, product, assignment, dan availability efektif. Assignment tidak dihapus permanen, wajib memakai composite foreign key tenant/outlet/product, dan setiap mutasi menulis audit/outbox dengan `outletId`.

**Exposure gate:** Route master Catalog tenant-wide memerlukan session, permission `catalog.read|manage`, scope `allOutlets`, dan entitlement Core Catalog. Route outlet memerlukan `x-outlet-id` yang sama dengan parameter route serta akses actor ke outlet tersebut. Seluruh header, params, body, dan response memakai shared Zod; route ini tidak memiliki query input. Kontrak route tersedia pada OpenAPI internal yang tetap mengikuti production documentation gate.

**Backoffice gate:** Web memperoleh tenant, outlet, permission, dan scope dari `GET /api/v1/access/workspaces` setelah merchant session tervalidasi; UUID context tidak ditebak atau dipercaya dari local state. Semua request/response Catalog diparse dengan shared Zod melalui same-origin API rewrite. UI permission-aware hanya menjadi presentation gate; API tetap authorization boundary final. Master/composition memerlukan `allOutlets`, sedangkan actor outlet-scoped hanya menerima outlet yang ditugaskan. Browser acceptance 11.4c sudah lolos pada Chrome/Playwright dengan PostgreSQL lokal: session restore, perpindahan dua tenant dan dua outlet, isolasi context, mutasi master/composition/outlet, error state, theme, serta reflow 390/1440 px tervalidasi.

**STOP:** Report, review, commit, dan push Tahap 11.4c sebelum melanjutkan POS Tahap 12.

---

## 7. PRIORITAS P3 - Domain Component dan MVP Flow

### Tahap 12 - POS component dan flow

- [x] **12.1 Product Tile dan Category Rail:** variant/size/state Product Tile serta rail kategori horizontal/vertical yang keyboard-accessible, responsive, token-driven, dan tervalidasi di Storybook.
- [x] **12.2 Modifier Picker:** product summary, single/multiple modifier group, batas minimum/maksimum, incomplete state, unavailable option, note, quantity, total, serta add/update cart action yang responsive.
- [x] **12.3 Cart Item dan Cart Summary:** variant compact/default/receipt, modifier detail collapse, note, quantity, unit/line total, remove action, serta breakdown subtotal sampai sisa tagihan yang menghilangkan baris tidak berlaku.
- [x] **12.4 Money Display:** variant inline/summary/total/accounting, size sm/md/lg/xl, exact integer minor-unit, format IDR, negative minus/parentheses, zero, unavailable, dan tabular alignment.
- [x] **12.5 Payment Method Tile dan Cash Keypad:** metode cash/QRIS/transfer/EDC/mixed, availability/selected state, size md/lg, serta keypad tunai dengan preset, amount received, change, clear, dan backspace.
- [x] **12.6 Shift component:** form buka shift hanya menginput kas awal; ringkasan read-only memisahkan data tunai/non-tunai; form tutup shift hanya menginput kas fisik dan alasan saat ada selisih; variance mengikuti permission.
- [ ] POS order/payment manual flow.

**Checkpoint 12.1:** `feat(ui): add POS product tile and category rail`

**Checkpoint 12.2:** `feat(ui): add POS modifier picker`

**Checkpoint 12.3:** `feat(ui): add POS cart item and summary`

**Checkpoint 12.4:** `feat(ui): add Money Display`

**Checkpoint 12.5:** `feat(ui): add POS payment method and cash keypad`

**Checkpoint 12.6:** `feat(ui): add guarded POS shift components`

**POS catalog component gate:** Product Tile menyediakan variant `compact/default/touch/customer`, size `sm/md/lg/customer`, state selected, low stock, sold out, scheduled/unavailable, image loading, dan image fallback tanpa menyembunyikan harga/status. Category Rail menyediakan mode vertical untuk POS desktop dan horizontal-scroll untuk customer/mobile dengan active indicator yang eksplisit. Component tests mencakup interaksi, disabled state, semantics, dan axe smoke; Storybook production build serta review Chrome pada 1440/390 px, light/dark, focus ring, minimum size, long status, dan overflow sudah lulus.

**Modifier picker gate:** Single selection memakai radio dan multiple selection memakai checkbox; batas minimum/maksimum serta required incomplete state selalu terlihat. Pilihan yang unavailable tetap memiliki label, surcharge berada di sisi kanan, dan action cart tidak aktif sebelum group wajib lengkap. Struktur menyertakan product summary, note, quantity, total, serta add/update action; desktop memakai dialog `lg` dan viewport mobile memakai bottom sheet responsive. Component interaction dan axe smoke test, Storybook production build, serta review browser light/dark dan 1440/390 px wajib lulus.

**Cart gate:** Cart Item menjaga nama, modifier, note, quantity, harga satuan, line total, dan remove action pada variant compact/default; variant receipt bersifat read-only. Modifier panjang dapat dibuka/tutup tanpa menghilangkan konteks item. Cart Summary mengurutkan subtotal, diskon, pajak, service charge, pembulatan, total, pembayaran tercatat, dan sisa tagihan; baris yang tidak berlaku tidak dirender, sedangkan total menjadi hierarki visual terkuat. Component interaction dan axe smoke test, Storybook production build, serta review browser light/dark dan 1440/390 px wajib lulus.

**Money Display gate:** Nilai menerima integer minor-unit presisi aman melalui bigint, safe integer, atau string integer; default currency IDR ditampilkan tanpa mengubah source of truth. Variant inline/summary/total/accounting dan size sm/md/lg/xl memakai angka tabular. Nilai nol tampil `Rp0`, data unavailable tampil `-` dengan label aksesibel, sedangkan negatif mendukung minus atau parentheses secara konsisten tanpa bergantung pada warna. Component/axe test, Storybook production build, serta review browser light/dark dan 1440/390 px wajib lulus.

**POS payment component gate:** Payment Method Tile memakai native radio semantics untuk cash, merchant QRIS, transfer, EDC, dan mixed; ukuran md/lg, selected check, availability, serta instruction tetap terlihat dan metode unavailable tidak dapat dipilih. Cash Keypad hanya muncul untuk tunai, tombol angka minimal 56px, preset mengikuti total, serta amount received, change, clear, dan backspace memakai integer minor-unit. Component interaction/axe test, Storybook production build, serta review browser light/dark, keyboard, dan 1440/390 px wajib lulus.

**Shift component gate:** Open Shift hanya menyediakan input kas awal. Shift Summary menampilkan actor/time sekali, rekonsiliasi tunai, breakdown non-tunai yang tersedia, serta counted cash hanya ketika shift sudah ditutup; variance default tersembunyi dan hanya tampil saat caller memberi permission `canViewVariance`. Close Shift menampilkan expected cash sebagai read-only, hanya meminta counted cash, dan baru meminta alasan saat variance nonzero. Nilai turunan tidak menjadi payload input, baris yang tidak berlaku dihilangkan, serta tidak ada field outlet/kasir/waktu sebagai input. Component/axe test, Storybook production build, serta review browser light/dark dan 1440/390 px wajib lulus.

**STOP:** Report, review, commit, dan push Tahap 12.6 sebelum melanjutkan POS order/payment manual flow.

### Tahap 13 - Table Layout dan QR Self-Order

- [ ] Install `@dnd-kit` atau package drag-and-drop terpilih baru pada tahap ini.
- [ ] Floor Selector.
- [ ] Table Tile view/edit.
- [ ] Table Layout Canvas snap-to-grid.
- [ ] Table Layout Toolbar dan Property Panel.
- [ ] Unplaced Table Tray.
- [ ] Bounds/overlap validation dan keyboard alternative.
- [ ] Table QR generate/print/revoke/rotate.
- [ ] Customer QR resolution dan table context.
- [ ] Customer tidak menerima internal table layout.

### Tahap 14 - KDS

- [ ] Install realtime client/server package saat tahap ini dimulai.
- [ ] Kitchen Ticket sm/md/lg.
- [ ] Timer dan SLA state.
- [ ] Audio/visual new-ticket alert.
- [ ] Reconnect/refetch flow.
- [ ] KDS tidak menerima payment/HPP/customer sensitive data.

### Tahap 15 - Inventory Basic

- [ ] Inventory item/unit.
- [ ] Stock Indicator dan Movement Row.
- [ ] Stock in/out, adjustment, opname, waste, dan transfer.
- [ ] Recipe/BOM Editor.
- [ ] Order consumption, cancellation reversal, dan waste.

### Tahap 16 - Finance Basic

- [ ] Finance Metric.
- [ ] Sales, expense, other income, dan cashbook.
- [ ] Reconciliation dan Shift Summary.
- [ ] HPP/gross profit/operating profit estimasi.
- [ ] Report table dan chart hanya untuk metrik yang tervalidasi.

### Tahap 17 - Customer dan Platform Admin

- [ ] Customer Basic.
- [ ] Customer product/cart/order-status page.
- [ ] Platform tenant/subscription master.
- [ ] Entitlement Matrix.
- [ ] Support context dan Audit Event.

---

## 8. PRIORITAS P4 - Hardening dan Pilot

### Tahap 18 - PWA dan device mode

- [ ] Merchant app manifest dan installability.
- [ ] Application-shell caching.
- [ ] POS/KDS/BACKOFFICE/INVENTORY device mode.
- [ ] Last-known menu dan draft cart cache.
- [ ] Operasi finansial/stok tetap membutuhkan server acknowledgement.

### Tahap 19 - Reliability dan security

- [ ] Tenant/outlet isolation full test.
- [ ] Rate limit login dan QR submit.
- [ ] CSRF/session/security header.
- [ ] Audit critical action.
- [ ] Backup/restore drill.
- [ ] Queue retry/dead-letter.
- [ ] Monitoring, request ID, structured log, dan error tracking.

### Tahap 20 - Pilot gate

- [ ] Dua tenant berjalan tanpa data leak.
- [ ] Multi-outlet report terisolasi dan consolidated.
- [ ] POS dan QR menghasilkan order pada KDS yang sama.
- [ ] Table layout per lantai dan QR mapping bekerja.
- [ ] Manual cash/QRIS/transfer direkonsiliasi.
- [ ] Inventory reversal/waste benar.
- [ ] Finance Basic menghasilkan metrik estimasi yang benar.
- [ ] Light/dark/system seluruh critical flow lolos visual review.
- [ ] Backup, monitoring, migration, dan staging smoke test tersedia.

## 9. Urutan push terdekat

Urutan yang harus diikuti mulai sekarang:

```text
Push 1  Workspace structure
Push 2  Foundation dependencies
Push 3  Color token bank
Push 4  Light/Dark/System engine
Push 5  Geist typography bank
Push 6  Spacing/radius/shadow/icon foundation
Push 7  Storybook and test harness
Push 8  Button primitives
Push 9  Text field primitives
Push 10 Selection controls
... lanjut satu batch komponen per push
```

Jangan menggabungkan Push 1 sampai Push 7 menjadi satu commit. Tujuan pemisahan ini agar setiap keputusan dasar dapat direview dan jika perlu dikoreksi tanpa bercampur dengan feature implementation.

## 10. Hal yang belum dikerjakan sekarang

- Review screenshot Color Bank dan runtime Theme Engine yang masih terbuka pada acceptance gate Tahap 3-4.
- Audit penutupan acceptance gate Storybook dan seluruh primitive P1 yang masih belum dicentang sebagai satu gate konsolidasi.
- Redis/BullMQ dan Docker Compose local services tetap deferred sampai use case worker/infrastructure ditetapkan. PostgreSQL development lokal sudah tersedia; integration test PostgreSQL/RLS tetap menunggu database test terisolasi dan disposable.
- Authentication/session Tahap 10.1, organization registry Tahap 10.2, membership/RBAC/outlet assignment Tahap 10.3, serta seluruh migration saat ini sudah diterapkan pada PostgreSQL development lokal.
- Subscription/module/entitlement core, application/schema tenant-isolation regression, Platform Owner, dan proteksi dokumentasi production Tahap 10 sudah diimplementasikan; integration PostgreSQL/RLS tetap menjadi gate terpisah.
