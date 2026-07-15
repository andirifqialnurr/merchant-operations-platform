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

> **NEXT: Review, commit, dan push Tahap 2; lalu mulai Tahap 3 - Color bank dan design token.**

Tahap 2 sudah selesai dan terverifikasi secara lokal. Belum boleh mulai color token atau komponen UI sebelum hasil Tahap 2 direview, di-commit, dan di-push.

## 3. Keputusan stack yang dikunci

| Area | Pilihan |
|---|---|
| Bahasa | TypeScript strict |
| Runtime | Node.js 24 LTS |
| Package manager | pnpm |
| Monorepo | pnpm workspace + Turborepo |
| Web | Next.js App Router + React |
| API | NestJS modular monolith |
| Worker | Node.js worker process |
| Styling | Tailwind CSS + CSS design tokens |
| UI behavior | Radix/headless primitives |
| Font | Geist Sans + Geist Mono terbatas |
| Icon | Lucide |
| Server state | TanStack Query |
| Local state | Zustand secukupnya |
| Form | React Hook Form + Zod |
| Database | PostgreSQL + Prisma |
| Queue | Redis + BullMQ |
| Component bank | Storybook |
| Component test | Vitest + Testing Library + axe |
| E2E | Playwright |

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

- [ ] Canvas, surface, surface subtle, raised, inverse, dan overlay.
- [ ] Text primary, secondary, muted, disabled, dan inverse.
- [ ] Border subtle, default, control, dan strong.
- [ ] Action primary, hover, pressed, on-primary, dan primary subtle.
- [ ] Focus ring.
- [ ] Info, success, warning, danger, dan special.

#### 3.3 Semantic token dark

- [ ] Buat pasangan semantic token dark untuk seluruh token light.
- [ ] Gunakan navy-slate, bukan black murni.
- [ ] Pastikan surface dibedakan oleh luminance dan border.
- [ ] Pastikan primary dark memakai teal terang dengan foreground aman.

#### 3.4 Merchant storefront preset

- [ ] Teal.
- [ ] Blue.
- [ ] Indigo.
- [ ] Violet.
- [ ] Rose.
- [ ] Orange.
- [ ] Simpan `primary` dan `on-primary` sebagai satu preset contract.
- [ ] Batasi override hanya untuk customer storefront.

#### 3.5 Tailwind mapping

- [ ] Hubungkan CSS variables ke Tailwind theme variables.
- [ ] Nama utility harus semantic, bukan berdasarkan feature.
- [ ] Tambahkan guard/lint convention untuk melarang raw arbitrary color pada feature.

#### 3.6 Color bank preview

- [ ] Buat preview development khusus seluruh primitive palette.
- [ ] Tampilkan semantic token light dan dark berdampingan.
- [ ] Tampilkan merchant preset dan pasangan foreground.
- [ ] Tampilkan status color dengan label, bukan swatch saja.

#### Acceptance gate Tahap 3

- [ ] Semua token di `design-system.md` mempunyai implementasi.
- [ ] Contrast teks normal minimal `4.5:1`.
- [ ] Contrast control/focus penting minimal `3:1`.
- [ ] Tidak ada raw color pada feature/skeleton app.
- [ ] Screenshot color bank light/dark diperiksa.
- [ ] Build, lint, dan typecheck lulus.

**Commit yang disarankan:**

```text
feat(ui): add light and dark color token bank
```

**STOP:** Push dan review bank warna sebelum theme switching.

---

### Tahap 4 - Theme engine Light, Dark, dan System

**Tujuan:** Menerapkan theme runtime yang stabil sebelum typography dan component.

- [ ] Implementasikan `ThemeProvider` pada root web.
- [ ] Mendukung `light`, `dark`, dan `system`.
- [ ] Gunakan `data-theme` atau class root yang konsisten.
- [ ] Set `color-scheme` sesuai theme aktif.
- [ ] Cegah flash theme yang salah saat initial render/hydration.
- [ ] Simpan preference sementara secara lokal; integrasi user/device dilakukan setelah identity tersedia.
- [ ] Buat temporary development theme switcher.
- [ ] Theme switch tidak me-refresh halaman.
- [ ] Theme switch tidak menghapus state/draft lokal.
- [ ] Siapkan contract persistence per user untuk backoffice dan per device untuk POS/KDS.

#### Acceptance gate Tahap 4

- [ ] Light, dark, dan system dapat dipilih.
- [ ] Reload mempertahankan pilihan lokal.
- [ ] Tidak ada hydration warning atau visible theme flash.
- [ ] Seluruh color bank berubah melalui semantic token.
- [ ] Keyboard dapat menggunakan theme switcher.
- [ ] Build, lint, typecheck, dan smoke test lulus.

**Commit yang disarankan:**

```text
feat(ui): add light dark and system theme engine
```

**STOP:** Push dan review theme engine sebelum typography.

---

### Tahap 5 - Geist typography dan text-style bank

**Tujuan:** Mengunci font dan seluruh text style sebelum komponen dibuat.

#### 5.1 Font loading

- [ ] Load Geist Sans dari package `geist`.
- [ ] Load Geist Mono hanya untuk utility teknis.
- [ ] Gunakan Inter/system sans sebagai fallback.
- [ ] Tidak menggunakan runtime external font CDN.
- [ ] Pastikan font tersedia pada production build dan PWA cache strategy nanti.

#### 5.2 Text style token

- [ ] `caption-xs`.
- [ ] `caption`.
- [ ] `body-sm`.
- [ ] `body`.
- [ ] `body-lg`.
- [ ] `label`.
- [ ] `heading-sm`.
- [ ] `heading`.
- [ ] `heading-lg`.
- [ ] `title`.
- [ ] `display-sm`.
- [ ] `display`.

#### 5.3 Typography utility

- [ ] Weight 400, 500, 600, dan 700.
- [ ] Tracking untuk display, heading, body, dan caption.
- [ ] Tabular numbers utility.
- [ ] Money/quantity/timer numeric style.
- [ ] Truncate satu baris dan line-clamp dua/tiga baris.
- [ ] Prose/long-content style hanya jika dibutuhkan docs/help.

#### 5.4 Text-style preview

- [ ] Tampilkan seluruh style dengan contoh Bahasa Indonesia.
- [ ] Tampilkan angka, nominal, order number, dan timer.
- [ ] Tampilkan long label dan mixed-case.
- [ ] Verifikasi light dan dark.
- [ ] Verifikasi zoom 200% dan font scaling.

#### Acceptance gate Tahap 5

- [ ] Seluruh type scale `design-system.md` tersedia.
- [ ] Tidak ada font-size/weight arbitrary pada preview.
- [ ] Nominal dan table number memakai tabular numbers.
- [ ] Geist Mono tidak digunakan untuk UI normal.
- [ ] Build, lint, typecheck, dan visual review lulus.

**Commit yang disarankan:**

```text
feat(ui): add Geist typography and text style bank
```

**STOP:** Push dan review typography sebelum spacing/icon foundation.

---

### Tahap 6 - Spacing, radius, shadow, motion, dan icon foundation

**Tujuan:** Menyelesaikan seluruh visual foundation selain component.

- [ ] Implementasikan spacing scale berbasis 4px.
- [ ] Implementasikan control-height `xs`, `sm`, `md`, `lg`, dan `xl`.
- [ ] Implementasikan radius `none`, `xs`, `sm`, `md`, `lg`, `xl`, dan `full`.
- [ ] Implementasikan shadow `none`, `xs`, `sm`, `md`, dan `lg`.
- [ ] Implementasikan motion duration/easing tokens.
- [ ] Hormati `prefers-reduced-motion`.
- [ ] Buat `AppIcon` wrapper untuk Lucide.
- [ ] Kunci icon size `xs`, `sm`, `md`, `lg`, dan `xl`.
- [ ] Buat preview spacing, radius, shadow, motion, dan icon.

#### Acceptance gate Tahap 6

- [ ] Tidak ada arbitrary spacing/radius/shadow pada preview.
- [ ] Icon menggunakan current color dan accessible rule.
- [ ] Dark mode tidak bergantung pada shadow untuk membedakan surface.
- [ ] Reduced-motion behavior diuji.
- [ ] Build, lint, typecheck, dan visual review lulus.

**Commit yang disarankan:**

```text
feat(ui): add layout and icon foundation tokens
```

**STOP:** Push dan review seluruh foundation sebelum component bank.

---

### Tahap 7 - Component bank dan test harness

**Tujuan:** Menyediakan tempat resmi untuk membangun dan memeriksa custom component.

#### 7.1 Storybook

- [ ] Install Storybook hanya setelah foundation selesai.
- [ ] Integrasikan `packages/ui`.
- [ ] Tambahkan toolbar light/dark/system.
- [ ] Tambahkan viewport mobile, tablet portrait, tablet landscape, desktop, dan large display.
- [ ] Load stylesheet dan Geist yang sama dengan aplikasi.

#### 7.2 Test tooling

- [ ] Install Vitest.
- [ ] Install Testing Library dan user-event.
- [ ] Install axe integration untuk component accessibility.
- [ ] Siapkan Playwright untuk visual/smoke test ketika story kritis tersedia.
- [ ] Tambahkan script root untuk component test dan Storybook build.

#### 7.3 Story contract

- [ ] Template story menampilkan size, variant, dan state.
- [ ] Template light/dark visual comparison.
- [ ] Template keyboard/accessibility notes.
- [ ] Template long Indonesian label.
- [ ] Template loading, empty, error, dan disabled.

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

- [ ] `Button`: primary, secondary, outline, ghost, destructive, dan link.
- [ ] Size `xs`, `sm`, `md`, `lg`, dan `xl`.
- [ ] Loading, disabled, icon-left, icon-right, dan full-width.
- [ ] `IconButton` seluruh size.
- [ ] Focus-visible, keyboard, tooltip contract, dan touch target.
- [ ] Story light/dark dan component test.

**Commit:** `feat(ui): add custom button primitives`

### Tahap 8.2 - Form field dan text input

- [ ] `FormField`, label, helper, error, required indicator.
- [ ] `Input`, search, password, prefix, suffix, read-only, dan invalid.
- [ ] `Textarea` sm/md/lg dan auto-grow variant.
- [ ] Story light/dark, long label, error, disabled, dan keyboard test.

**Commit:** `feat(ui): add custom text field primitives`

### Tahap 8.3 - Selection controls

- [ ] Checkbox sm/md/lg dan indeterminate.
- [ ] Radio sm/md/lg.
- [ ] Switch sm/md/lg.
- [ ] Segmented Control sm/md/lg.
- [ ] Quantity Stepper sm/md/lg.
- [ ] Keyboard, touch, accessible label, light/dark stories.

**Commit:** `feat(ui): add custom selection controls`

### Tahap 8.4 - Select dan Combobox

- [ ] Custom Select sm/md/lg.
- [ ] Searchable Combobox single select.
- [ ] Multi-select hanya jika sudah ada use case.
- [ ] Loading, no-result, error, disabled option, dan async search state.
- [ ] Keyboard navigation, portal, focus, mobile sheet behavior.

**Commit:** `feat(ui): add custom select and combobox`

### Tahap 8.5 - Numeric, Money, Date, dan Time

- [ ] Number Input.
- [ ] Money Input dengan format IDR.
- [ ] Percentage dan unit variant.
- [ ] Date Picker, Date Range Picker, dan Month Picker.
- [ ] Time Input format 24 jam.
- [ ] Locale Indonesia, keyboard, light/dark, dan validation test.

**Commit:** `feat(ui): add numeric and date input primitives`

### Tahap 8.6 - Feedback components

- [ ] Badge xs/sm/md dan semantic variants.
- [ ] Alert compact/default.
- [ ] Toast stack dan placement per surface.
- [ ] Spinner, Progress, dan Skeleton variants.
- [ ] Empty State dan Error State.
- [ ] Live-region behavior dan reduced motion.

**Commit:** `feat(ui): add feedback and status components`

### Tahap 8.7 - Overlay components

- [ ] Dialog xs/sm/md/lg/xl/full.
- [ ] Alert Dialog destructive flow.
- [ ] Drawer/Sheet sm/md/lg dan mobile behavior.
- [ ] Popover.
- [ ] Dropdown Menu.
- [ ] Tooltip.
- [ ] Focus trap/restore, Escape, portal, scroll lock, light/dark test.

**Commit:** `feat(ui): add custom overlay components`

### Tahap 8.8 - Navigation components

- [ ] Sidebar expanded/collapsed/mobile.
- [ ] Top Bar.
- [ ] Tabs line/contained/vertical.
- [ ] Breadcrumb.
- [ ] Pagination.
- [ ] Stepper.
- [ ] Responsive dan keyboard behavior.

**Commit:** `feat(ui): add navigation components`

### Tahap 8.9 - Data-display components

- [ ] Card/Panel variants.
- [ ] Data Table compact/default/comfortable.
- [ ] Description List.
- [ ] Metric Card.
- [ ] Avatar.
- [ ] Divider, Accordion, dan Timeline.
- [ ] Chart wrapper hanya setelah report use case disepakati.

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

- [ ] Install Prisma dan PostgreSQL driver pada tahap ini, bukan sebelumnya.
- [ ] Buat tenant/outlet scope foundation.
- [ ] Buat migration baseline.
- [ ] Buat audit, idempotency, dan outbox foundation.
- [ ] Buat OpenAPI dan shared contract generation/validation.
- [ ] Siapkan Redis/BullMQ setelah use case worker pertama ditetapkan.
- [ ] Siapkan Docker Compose PostgreSQL/Redis/object storage untuk development.
- [ ] Tambahkan integration test dengan PostgreSQL asli.

**Commit harus dipecah:** database baseline, API contract, lalu queue/infrastructure tidak digabung dalam satu push besar.

### Tahap 10 - Identity, tenant, outlet, dan entitlement

- [ ] Authentication/session foundation.
- [ ] Tenant, brand, dan outlet.
- [ ] Membership, role, permission, dan outlet assignment.
- [ ] Subscription/module/entitlement core.
- [ ] Tenant-isolation test.
- [ ] Platform owner master foundation.

### Tahap 11 - Catalog foundation

- [ ] Category, product, variant, modifier, image, price, dan availability.
- [ ] Outlet override.
- [ ] Contract/API dan backoffice flow.
- [ ] Jangan membangun POS sebelum catalog minimal stabil.

---

## 7. PRIORITAS P3 - Domain Component dan MVP Flow

### Tahap 12 - POS component dan flow

- [ ] Product Tile dan Category Rail.
- [ ] Modifier Picker.
- [ ] Cart Item dan Cart Summary.
- [ ] Money Display.
- [ ] Payment Method Tile dan Cash Keypad.
- [ ] Shift component.
- [ ] POS order/payment manual flow.

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

- Belum membuat color token CSS.
- Belum membuat theme provider.
- Belum memasang Geist pada aplikasi.
- Belum membuat Storybook.
- Belum membuat custom component.
- Belum membuat database atau backend module.

Dependency dan skeleton Tahap 2 sudah dibuat serta diverifikasi secara lokal. Implementasi berikutnya dimulai dari **Tahap 3** setelah hasil Tahap 2 direview, di-commit, dan di-push.
