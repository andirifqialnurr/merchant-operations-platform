# TODO - Merchant Operations Platform

**Status:** Implementation roadmap selaras PRD modular v2.3
**Tanggal:** 5 Agustus 2026
**Acuan:** `docs/README.md`, `docs/product/*`, dan `docs/foundation/*`
**Strategi:** Satu tahap -> verifikasi -> commit/push -> lanjut tahap berikutnya
**Rencana:** milestone dan task berikutnya ada di [`docs/milestones/`](docs/milestones/README.md); file ini mencatat checkpoint yang sedang dan sudah dikerjakan.

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
12. Sebelum membuat layar/modul baru, tentukan referensi `docs/foundation/design-system.md`, `docs/foundation/design-system-modules.md`, dan shell yang dipakai; jangan membuat layout baru tanpa mencatat alasannya.
13. Setiap navigasi, tombol, tab, dialog, form submit, filter, dan primary action yang terlihat harus memiliki perilaku yang jelas serta diverifikasi melalui unit/component test, browser smoke, atau HTTP route smoke sesuai risikonya.
14. Gunakan urutan source of truth pada `docs/README.md`; audit dan TODO boleh mencatat gap implementasi tetapi tidak boleh menurunkan requirement PRD.

## 2. Status saat ini

### Basis produk dan foundation aktif

- [x] PRD Modular Platform v2.3 menjadi sumber scope, modularity, integration, data boundary, roadmap, dan Release 1.
- [x] Module Tiers v1.2 menjadi sumber capability Basic/Pro/Advanced dan delivery status.
- [x] Packages and Limits v1.2 menjadi sumber package composition, limit, add-on, usage, dan enforcement; pricing belum final.
- [x] `docs/foundation/architecture.md` menjadi technical boundary.
- [x] `docs/foundation/design-system.md` menjadi visual/interaction contract Calm Neutral, Geist Sans, Tabler Icons, ApexCharts, light/dark/system, `id`/`en`, dan S/M/L (menggantikan Warm Operational/DM Sans/Fraunces per 2 Oktober 2026).
- [x] `docs/foundation/design-system-modules.md` menjadi mapping module ke shell/screen/component/state/data guard.
- [x] `docs/foundation/DESIGN_SYSTEM_APP_AUDIT.md` menjadi catatan gap implementasi, bukan sumber requirement.

### Checkpoint 5 Agustus 2026 - source-of-truth alignment

- [x] Seluruh dokumen baru di `docs/product/` dan `docs/foundation/` dipelajari dan dibandingkan dengan dokumen lama.
- [x] `docs/packages/*`, `docs/versions/*`, `docs/00-GLOBAL-PRODUCT-SCOPE.md`, dan `docs/FEATURE_INVENTORY.md` ditetapkan superseded karena requirement serta traceability-nya sudah diserap dokumen baru.
- [x] `docs/README.md`, `AGENTS.md`, dan referensi nama/path antar dokumen diselaraskan.
- [x] Source route web diaudit ulang: `/backoffice/catalog` sudah memakai API, sedangkan `/pos`, `/kds`, dan `/inventory` masih placeholder; beberapa surface R1 belum mempunyai route aktif.
- [x] Fondasi backend/API/isolation/security/reliability dikonfirmasi lebih maju daripada implementasi UI route, tetapi belum selesai terhadap kontrak modular baru di `docs/product/` dan `docs/foundation/`.
- [x] Build produksi yang tersedia berhasil di-smoke melalui HTTP: route aktif utama merespons 200 dan `/finance`, `/hc`, `/platform` merespons 404 sesuai source route yang belum ada.
- [ ] Runtime visual/interaksi belum terverifikasi: start dev masih tertahan lock `.next/dev` dan browser dalam aplikasi tidak tersedia.
- [x] `CREDENTIALS.local.md` diperiksa; tidak ada perubahan akun, password, atau aturan pemeliharaan yang diperlukan.

### Checkpoint 2 Oktober 2026 - documentation remap (tanpa perubahan kode)

- [x] User mengonfirmasi arah reslicing UI: tema modern minimalis, tanpa data ganda, tanpa deskripsi halaman panjang, light/dark, dan dua bahasa.
- [x] `docs/product/prd.md` dibuat sebagai ringkasan terkonsolidasi beserta keputusan D-01 sampai D-08.
- [x] `docs/foundation/design-system.md` ditulis ulang: Calm Neutral, Geist, Tabler Icons, ApexCharts, aturan konten halaman, inventaris dan gap komponen.
- [x] `docs/foundation/architecture.md` ditulis ulang dengan status stack aktual dan catatan keputusan (ADR).
- [x] `docs/foundation/schema.md`, `backend.md`, `frontend.md`, `security.md`, `deploy.md`, dan `flowchart.md` dibuat.
- [x] `docs/README.md` dan `AGENTS.md` diselaraskan.
- [x] User memutuskan: palet monokrom tanpa aksen (D-01), bahasa bawaan mengikuti browser (D-09), hosting VPS + Docker + Nginx dikerjakan paling akhir (D-10).
- [ ] Keputusan skema `SCH-01` sampai `SCH-03` masih terbuka; tidak memblokir pekerjaan UI.

### Tahap implementasi berikutnya

> **NEXT: STOP setelah UI Foundation 1.** User meninjau `/color-bank` (light dan dark) sebelum komponen dibenahi satu per satu, dimulai dari Button.

Urutan fondasi UI mengikuti `docs/foundation/frontend.md` bagian 14; setiap butir adalah checkpoint yang berdiri sendiri:

- [x] **UI Foundation 1 - Bank warna Calm Neutral:** `primitives.css` diganti menjadi ramp netral 16 langkah + status + chart + preset storefront (skala Teal, Slate, Violet, Indigo lama dihapus); `tokens.css` light/dark monokrom tanpa aksen; token `--color-chart-series-1..6` dan utility `bg-chart-*`; preset storefront `ink/blue/teal/green/rose/orange`; `/color-bank` ditulis ulang; warna PWA diselaraskan; status `special` dipetakan ke netral. Verifikasi: kontras WCAG dihitung, penjaga warna, lint, typecheck `ui`/`storybook`, dan 204 test komponen lulus.
- [ ] **Gate UI Foundation 1:** user meninjau `/color-bank` di browser pada light dan dark. Typecheck `apps/web` masih gagal hanya pada berkas hasil generate `.next/dev/types/routes.d.ts` yang rusak (bukan kode sumber); hapus `apps/web/.next/dev` setelah proses dev lama dihentikan.
- [x] **UI Foundation 2 - Tabler Icons:** `AppIcon` memakai `@tabler/icons-react` (garis 1,75px); 49 berkas dimigrasikan lewat codemod berbasis AST; `lucide-react` dihapus dari ketiga paket dan dilarang lewat lint. Lint, typecheck, 231 test komponen, build dan 22 smoke test Storybook lulus; ikon terverifikasi di halaman Katalog pada browser.
- [ ] **UI Foundation 3 - i18n:** pasang `next-intl` berbasis cookie, kamus `id`/`en`, `LanguageSwitcher`, keluarkan string dari `packages/ui`.
- [ ] **UI Foundation 4 - API client dan server state:** header CSRF (temuan `SEC-F1`), idempotency, error bertipe, TanStack Query.
- [ ] **UI Foundation 5 - Shell dan pattern:** `AppShell`, `ContextSwitcher`, `UserMenu`, `PageHeader`, `FilterBar`, `Chip`, `ModuleAccessState`, `UsageLimitState`.
- [ ] **UI Foundation 6 - Route group dan guard:** `(auth)`, `(backoffice)`, `(pos)`, `(kds)`, `(customer)`, `(platform)`.
- [ ] **UI Foundation 7 - Reslice Catalog:** pecah `catalog-backoffice.tsx` menjadi `features/catalog` sesuai pola halaman baru.
- [x] **Komponen 1 - Button/IconButton:** tinggi kontrol bawaan 36px, secondary bergaris (outline menjadi alias), ghost dan link netral, link selalu bergaris bawah, state tekan, disabled mengikuti bentuk variant, loading mempertahankan tampilan variant, ikon xl dibatasi 24px.
- [x] **Komponen 2 - FormField/Input/Textarea:** penanda `optionalLabel` menggantikan `required`, label aksi cari/kata sandi menjadi props, fokus 1px tinta, read-only dibedakan dari disabled.
- [x] **Komponen 3 - Checkbox/Radio/Switch/SegmentedControl/QuantityStepper:** thumb switch terlihat di mode gelap, state hover dan disabled, label tombol stepper menjadi props.
- [x] **Komponen 4 - Select/Combobox:** menu menempel pada trigger (sebelumnya muncul di tengah layar), tertutup saat klik di luar, placeholder redup, fokus 1px tinta, label loading/coba lagi/kosong/cari menjadi props.
- [x] **Komponen 5 - NumericInput/MoneyInput/DatePicker/DateRangePicker/MonthPicker/TimeInput:** perbaikan bug tanggal bergeser satu hari karena zona waktu dan hari pertama tidak sejajar dengan nama harinya; nama hari dan bulan dari `Intl` melalui props `locale`; penanda hari ini; kalender tertutup saat klik di luar atau Escape; label menjadi props.
- [x] **Komponen 6 - Badge/Alert/Toast/StatusBar/Spinner/Progress/Skeleton/EmptyState/ErrorState:** perbaikan token latar status yang salah nama (badge dan alert sebelumnya tanpa latar), tone `neutral` sebagai bawaan Badge, toast di permukaan raised, penempatan `top-center` untuk POS/KDS, state kosong/error tanpa bingkai, label tutup menjadi props.
- [x] **Komponen 7 - Dialog/AlertDialog/Sheet/Popover/DropdownMenu/Tooltip:** perbaikan Tooltip tanpa latar dan tanpa posisi (token salah nama); Popover dan DropdownMenu tertutup saat klik di luar atau Escape; navigasi panah pada DropdownMenu; AlertDialog memakai Button design system; label tutup/batal menjadi props.
- [x] **Komponen 8 - Sidebar/TopBar/Tabs/Breadcrumb/Pagination/Stepper:** state hover, fokus, dan terpilih netral pada Sidebar; Tabs dengan roving tabindex dan garis dasar; Pagination menangani total nol dan menerima label sebagai props; Breadcrumb maksimal tiga tingkat.
- [x] **Komponen 9 - Panel/DataTable/DescriptionList/MetricCard/Avatar/Accordion/Timeline/Chart:** `Panel` baru sebagai pengganti kartu; DataTable dengan kolom rata kanan, prioritas kolom P0-P3 (P2/P3 tersembunyi di layar kecil), slot kosong, dan baris yang dapat dipilih; Chart membaca warna token aktual dan mengikuti pergantian tema; skeleton tidak lagi tampil bersama state kosong/error.
- [x] **Perbaikan token teks:** token ukuran teks, berat, dan tracking sebelumnya hanya ada bila dipakai utility Tailwind, sehingga di Storybook seluruh komponen tampil 16px dan di web sebagian token hilang (`--text-title`, `--font-weight-*`). Blok theme kini `static` dan Storybook memproses style lewat pipeline Tailwind yang sama dengan web. Terverifikasi lewat pemeriksaan variabel di browser dan tangkapan layar.
- [x] **Komponen 10 - AppShell/ContextSwitcher/UserMenu:** shell Backoffice dan Platform: sidebar tetap (Large), rail ikon (Medium), drawer kiri (Small); pemilih workspace dan lokasi di top bar; menu akun berisi bahasa, tema, dan keluar; link router lewat `renderLink`. Semua label lewat props.
- [x] **Komponen 11 - PageHeader/FilterBar/Chip:** header halaman tanpa slot deskripsi dan aksi utama menempel di bawah pada layar kecil; filter bar dengan pencarian, chip filter aktif, reset, dan sheet filter pada layar kecil. Semua label lewat props.
- [x] **Verifikasi visual komponen 10-11:** tangkapan layar story `Patterns/AppShell` pada 1440 light, 1440 dark, dan 390 dark diperiksa; build dan 22 smoke test Storybook lulus.
- [x] **Reslice Catalog (UI Foundation 4, 6, 7):** klien API mengirim header CSRF (`SEC-F1` selesai); TanStack Query terpasang; rute `/login` dan `/catalog` dengan layout berpenjaga sesi; shell memakai `AppShell`; `catalog-backoffice.tsx` (1.114 baris) dipecah menjadi `features/auth`, `features/workspace`, dan `features/catalog`; `/backoffice/catalog` dialihkan ke `/catalog`. Halaman mengikuti aturan baru: tanpa deskripsi, satu aksi utama, konteks bisnis/outlet hanya di shell, detail dan edit lewat sheet, tab dan baris terbuka tersimpan di URL. Field slug, object key gambar, dan penghitung berulang dihapus dari tampilan.
- [x] **Verifikasi browser reslice Catalog:** login lalu `/catalog` dengan database lokal pada Chromium headless: daftar produk tampil, sheet produk terbuka dari baris, saklar habis tersimpan dan dikembalikan (badge ikut berubah), tab Kategori dan Modifier, 390px gelap tanpa overflow, tanpa error API. Belum diuji: membuat produk/kategori/modifier baru, pengguna berbatas outlet, dan berganti bisnis.
- [x] **Dua bahasa (UI Foundation 3):** `next-intl` tanpa plugin build; kamus `apps/web/messages/id.json` dan `en.json` (namespace shell, auth, catalog, errors); bawaan mengikuti bahasa browser dan pilihan manual tersimpan di cookie; pemilih bahasa di menu akun dan halaman login; pesan error diterjemahkan dari kode API, bukan dari teks server; format uang mengikuti bahasa; kunci terjemahan diperiksa tipe; test kesamaan kunci dan placeholder kedua kamus. `messages.ts` per fitur dihapus.
- [x] **Verifikasi browser dua bahasa:** browser berbahasa Inggris mendapat halaman login Inggris; error login salah tampil dalam bahasa aktif; berganti bahasa di login mempertahankan isian; berganti di menu akun mengubah judul, badge, dan format harga (`Rp25.000` menjadi `Rp25,000`) tanpa pindah rute; `<html lang>` ikut berubah.
- [ ] **Sisa dua bahasa:** halaman referensi dev dan placeholder POS/KDS/Inventory belum diterjemahkan.
- [ ] **Catatan label:** komponen 4-9 masih memakai bawaan Bahasa Indonesia pada props label baru; bawaan itu dihapus pada checkpoint i18n (UI Foundation 3).
- [ ] **Gate komponen 1-11:** user meninjau Storybook pada light dan dark; verifikasi otomatis (lint, typecheck ui/storybook, format, 231 test, 22 smoke test) lulus, visual belum ditinjau.
- [ ] **UI Foundation 8 - Komponen berikutnya satu per satu:** satu komponen per checkpoint, primitive selesai; berikutnya komponen domain (POS → Floor → KDS → Inventory → Finance → Customer → Platform) dan primitive yang masih gap (MultiSelect, FileUpload, ModuleAccessState, UsageLimitState, BottomNav). Atas permintaan user, pekerjaan ini boleh didahulukan sebelum UI Foundation 2-7.

### Backend delta yang harus diaudit sebelum UI reslicing

- [x] `Workspace -> Business Unit -> Location` dibandingkan dengan implementasi `tenant/brand/outlet`; code baru tidak boleh memperluas terminology F&B sebagai invariant Core.
- [x] `workspaceType BUSINESS/PERSONAL`, business template, device/channel metadata, dan employee != user diperiksa terhadap schema/API saat ini.
- [x] Module manifest registry diperiksa: module key/version, capability, permission, route, navigation, setting, event produced, handler, install step, dan config schema version.
- [x] Module installation lifecycle diperiksa: `NOT_INSTALLED`, `PROVISIONING`, `SETUP_REQUIRED`, `ACTIVE`, `ERROR`, `SUSPENDED`; tidak boleh direduksi menjadi boolean `moduleEnabled`.
- [x] Integration binding lifecycle diperiksa: source module, event+version, target module, handler, mapping config, effective time, status, health, retry/dead-letter state, dan audit metadata.
- [x] Package/version/entitlement/limit/metering diperiksa: immutable package version, effective entitlement, hard count limit, soft metered event, throttled limit, usage event idempotent, rebuildable counter, adjustment audit, dan downgrade tanpa menghapus histori.
- [x] Event/outbox/inbox diperiksa terhadap flow R1: POS -> KDS, POS -> Finance, POS -> Inventory, KDS-only manual/API intake, Inventory-only, Finance-only, HC-only, dan duplicate consumer handling.
- [x] ORM schema gap diperiksa untuk Core tables baru, floor/session/QR, KDS ticket, inventory ledger, Finance Core, HC attendance append-only, customer/report projection, usage metering, dan safe DTO boundary.
- [x] Security delta diperiksa: integration API rate limit, endpoint sensitif, module boundary lint, PostgreSQL/RLS integration test disposable, QR token hash/rotation privacy, support access scope/reason/expiry, dan PII-safe event/log.
- [x] Setiap gap diklasifikasi sebagai `implemented`, `partial`, `missing`, `deferred`, atau `future`, dengan rekomendasi checkpoint implementasi yang dapat dipush sendiri.

Audit detail: `docs/foundation/BACKEND_MODULAR_DELTA_AUDIT.md`.

### Backend delta implementation checkpoints

- [x] **Backend Delta 2.1 - Workspace terminology contract:** contract alias `Workspace`, `BusinessUnit`, `Location`, `WorkspaceType`, dan `BusinessTemplate` tersedia di `packages/contracts` tanpa migration tabel lama.
- [x] **Backend Delta 2.2 - Module manifest contract:** schema manifest versioned tersedia untuk capability, permission, route, navigation, setting, event, handler, install step, dan config schema version.
- [x] **Backend Delta 2.3 - Installation and integration lifecycle contract:** lifecycle module installation dan integration binding tersedia sebagai contract typed, tidak memakai boolean `moduleEnabled`.
- [x] **Backend Delta 3.1 - Package limit and usage metering contract:** package version snapshot, effective limit, usage event/counter/adjustment, hard/soft/throttled enforcement, dan error code minimum tersedia sebagai contract typed.
- [x] **Backend Delta 4.1 - Event envelope and inbox contract:** event envelope versioned dan inbox/consumer idempotency contract tersedia sebelum ORM/event implementation.
- [x] **Backend Delta 4.2 - Command context contract:** command metadata untuk WEB, MOBILE, POS, KDS, API, IMPORT, device/system/integration, idempotency, correlation, causation, occurred/received timestamp, dan client version tersedia sebagai contract typed.
- [x] **Security Delta 1 - Support access contract:** support access memiliki reason, scope, expiry, actor, audit reference, dan tidak mencampur platform support dengan merchant session.
- [x] **Security Delta 2 - QR token lifecycle contract:** QR token memakai hash/version/status/rotation/revocation contract tanpa raw token pada DTO publik.
- [x] **Backend Delta 5.1 - Module boundary rule contract:** aturan owner module, allowed dependency, public facade, event-only reaction, dan larangan cross-module repository write tersedia sebagai contract typed.

### Gate sebelum coding backend berikutnya

- [x] Backend delta audit selesai dan dicatat pada TODO.
- [ ] Untuk setiap checkpoint backend implementasi, tentukan owner module/data, mutation command, read model/DTO, permission, entitlement, installation, limit, idempotency, audit, dan error code sebelum coding.
- [ ] Migration/Prisma change wajib disertai constraint/index/tenant-workspace isolation review dan rollback/rebuild consideration.
- [ ] Endpoint/API baru wajib memakai shared Zod contract untuk header, params, query, body, dan response yang relevan.
- [ ] Event/worker change wajib membuktikan idempotency, retry/dead-letter, safe payload, dan duplicate handling.
- [ ] Verification minimum backend mencakup lint, typecheck, unit/contract test terkait, API test, migration/schema test bila ada, dan privacy/security regression sesuai scope.

### Gate sebelum coding visual berikutnya

- [x] Backend Delta 1 selesai dan checkpoint backend implementasi prioritas sudah disepakati.
- [x] User mengonfirmasi arah reslicing/redesign UI (2 Oktober 2026).
- [x] User menyetujui arah dokumen hasil remap dan meminta bank warna dikerjakan lebih dulu (2 Oktober 2026).
- [ ] Halaman lulus checklist review `docs/foundation/design-system.md` bagian 23.3 (judul tanpa deskripsi, satu aksi utama, tanpa data ganda, `id`/`en`).
- [ ] Field inventory dibuat sebelum JSX untuk setiap surface bisnis yang tersentuh.
- [ ] Component/source audit memastikan API dan behavior existing yang harus dipertahankan.
- [ ] Module state membedakan entitlement, permission, installation/setup, feature flag/delivery, limit, dan subscription lifecycle.
- [ ] Interaction acceptance mencakup semua navigasi, tombol, tab, dialog, form submit, filter, dan primary action yang terlihat.
- [ ] Verification minimum mencakup lint, typecheck, test terkait, HTTP route smoke, browser/click smoke, S/M/L boundary, light/dark, keyboard/focus, dan data guard.

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
| Icon            | Tabler Icons melalui `AppIcon`                                |
| i18n            | `next-intl` berbasis cookie, `id` dan `en`                    |
| Server state    | TanStack Query                                                |
| Local state     | Zustand secukupnya                                            |
| Form            | React Hook Form + Zod                                         |
| Database        | PostgreSQL + Prisma                                           |
| Queue           | Redis + BullMQ                                                |
| Component bank  | Storybook                                                     |
| Component test  | Vitest + Testing Library + axe                                |
| E2E             | Playwright                                                    |
| Chart           | ApexCharts + `react-apexcharts` melalui wrapper `packages/ui` |
| Drag-and-drop   | `@dnd-kit/react` + `@dnd-kit/dom`                             |

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

**Catatan alignment 5 Agustus 2026:** Checklist selesai di tahap ini adalah bukti baseline lama Operational Teal/Geist. Baseline tersebut sekarang menjadi migration input dan belum memenuhi `docs/foundation/design-system.md` yang menetapkan Warm Operational/DM Sans/Fraunces.

#### 3.1 Primitive color token

- [x] Implementasikan Operational Teal `50-950` sesuai baseline design system lama.
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

- [x] Semua token pada baseline design system lama mempunyai implementasi.
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

- [x] Seluruh type scale Geist pada baseline design system lama tersedia.
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

- [ ] Seluruh P0 component pada `docs/foundation/design-system.md` tersedia dan sudah dire-audit terhadap API existing.
- [ ] Semua component mempunyai light/dark stories.
- [ ] Semua component mempunyai size/variant/state yang terdokumentasi.
- [ ] Keyboard dan axe test lulus untuk component interaktif.
- [ ] Tidak ada default visual browser/library sebagai hasil final.
- [ ] Tidak ada raw feature color atau arbitrary style yang tidak terdokumentasi.

---

## 6. PRIORITAS P2 - Backend, Contract, dan Data Foundation

Catatan alignment 5 Agustus 2026: urutan historis P2 dimulai setelah primitive UI stabil sudah tidak cukup untuk PRD Modular v2.3. Backend Delta 1-4 di bagian atas file ini menjadi re-audit dan implementasi lanjutan terhadap kontrak modular baru, bukan pengulangan Tahap 9 lama.

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
- [x] **12.7 POS order/payment manual flow:** alur takeaway menyusun katalog, keranjang, pemilihan cash/manual QRIS, verifikasi read-only, dan status PAID tanpa menumpuk informasi antar-tahap.
- [x] **12.8 Shift API:** tabel `pos_register_sessions` dan `pos_cash_movements`, modul `apps/api/src/modules/pos-sales` (domain, application, adapters), endpoint `GET /pos/shifts/current`, `POST /pos/shifts`, `POST /pos/shifts/:id/cash-movements`, `POST /pos/shifts/:id/close`, audit dan outbox `shift.opened.v1`/`shift.closed.v1`.
- [x] **12.9 Halaman shift:** route group `(pos)` dengan `SessionGate` bersama dan `PosShell` (layar penuh, bar atas 56px, tanpa sidebar); `/pos/shift` memakai Shift API untuk buka shift, catat kas, riwayat kas, dan tutup shift; `/pos` mengarah ke `/pos/shift`; menu Kasir di backoffice; komponen shift `packages/ui` menerima semua label lewat props, tanpa deskripsi dan tanpa kartu sendiri.
- [x] **12.10a Menu jual:** `GET /pos/menu` (izin `order.create`, modul POS, scope outlet) mengembalikan kategori, produk, varian, dan modifier yang benar-benar bisa dijual di outlet beserta harga outlet.
- [x] **12.10b Order:** kernel `apps/api/src/kernels/order-intake` dengan tabel `order_orders`, `order_order_items`, `order_item_modifiers`, `order_number_counters`; `POST /pos/orders` dan `GET /pos/orders/:id`; harga dihitung server dari menu jual; audit dan outbox `order.submitted.v1`.
- [x] **12.10c Bill, pembayaran, dan sale:** kernel `apps/api/src/kernels/billing-payment-ledger` dengan tabel `billing_bills`, `billing_payments`, `billing_payment_allocations`, `sales_sales`, `sales_number_counters`; `POST /pos/orders/:id/payments` untuk tunai dan QRIS manual; penjualan tunai masuk ke kas seharusnya pada shift; audit dan outbox `payment.recorded.v1` serta `sale.completed.v1`.
- [x] **12.10d-1 Kartu produk dan rel kategori:** label status produk dan nama navigasi kategori lewat props; teks cadangan gambar dihapus (ikon saja).
- [x] **12.10d-2 Layar jual:** `/pos` dengan rel kategori, kartu produk, panel pilihan varian/tambahan, keranjang, pembayaran tunai/QRIS manual, dan layar lunas; memakai API menu, order, dan pembayaran; navigasi Jual/Shift di bar atas kasir. Keranjang, pemilih, dan pembayaran dirakit di `apps/web/src/features/pos` dari primitive, bukan dari komponen lama.
- [x] **12.10d-3 Komponen kasir lama (selesai di 12.20):** `ProductModifierPicker`, `CartItem`, `CartSummary`, `PaymentMethodTile`, `CashKeypad`, dan `PaymentConfirmationPanel` di `packages/ui` masih berteks tertanam dan hanya dipakai story serta layar pelanggan; putuskan dirapikan atau dihapus saat layar pelanggan dikerjakan.
- [x] **12.11a Daftar dan batal pesanan (API):** `GET /pos/orders` (24 jam terakhir, maksimal 100, dengan status bayar dan nomor penjualan) dan `POST /pos/orders/:id/cancel` dengan alasan wajib; pesanan yang sudah dibayar ditolak; audit `order.cancel` dan outbox `order.canceled.v1`.
- [x] **12.11b Layar pesanan:** `/pos/orders` dengan daftar 24 jam terakhir, detail pesanan, bayar pesanan yang tertunda, dan batal dengan alasan; layar pembayaran menerima keranjang atau pesanan yang sudah ada, dan pesanan yang gagal dibayar dapat ditinggal dengan "Bayar nanti"; navigasi Jual/Pesanan/Shift.
- [x] **12.12 Struk (M1-FT-07):** `GET /pos/orders/:id/receipt` untuk pesanan lunas; komponen `Receipt` dengan kertas 58 mm/80 mm/A4 (pilihan disimpan per perangkat) dan stylesheet cetak yang hanya mencetak struk dengan token `print.ink`/`print.paper`; tombol Cetak struk di layar lunas dan Struk di detail pesanan lunas (ditandai SALINAN).
- [x] **12.13 Transfer dan EDC (M1-FT-08):** metode bayar transfer dan EDC manual dengan nomor referensi opsional; tidak menambah kas seharusnya; shift menampilkan bagian Non-tunai per metode (`nonCashPayments`).
- [x] **12.14 Refund (M1-FT-09):** tabel `sales_refunds`; `POST /pos/orders/:id/refunds` (izin `payment.refund`, idempotent) untuk refund sebagian atau penuh lewat metode bayar asli, dalam shift terbuka; layar Refund dari detail pesanan lunas dengan riwayat refund; status Refund sebagian/Direfund di daftar pesanan; struk mencantumkan refund; shift menampilkan Refund tunai.
- [x] **12.15 Ringkasan shift tertutup (M1-FT-13):** setelah tutup shift, layar Shift ditutup menampilkan kasir, waktu buka/tutup, rekonsiliasi kas (refund tunai bila ada), kas fisik, selisih dan alasannya untuk yang berizin tutup shift, serta Non-tunai per metode; Cetak ringkasan mencetak versi kertas memakai komponen `Receipt`; Selesai kembali ke form buka shift.
- [x] **12.16 Catatan per item (M1-FT-11):** catatan opsional di panel pilihan produk dan dari tombol catatan di setiap baris keranjang (Enter simpan, Esc batal, kosong menghapus); baris dengan produk, pilihan, dan catatan yang sama digabung; catatan ikut ke snapshot pesanan, detail pesanan, dan struk.
- [x] **12.17 Tahan pesanan (M1-FT-12):** tabel `pos_held_carts` dan `GET/POST /pos/held-carts`, `POST /pos/held-carts/:id/resume`, `DELETE /pos/held-carts/:id`; tombol Tahan di keranjang dengan nama/penanda wajib; tombol Ditahan (n) di layar jual membuka daftar untuk melanjutkan (hanya saat keranjang kosong) atau membuang; item yang sudah tidak dijual tidak dimasukkan dan kasir diberi tahu.
- [x] **12.18 Preferensi bahasa dan tema (M1-BE-09, M1-UX-06):** kolom `users.locale`/`users.theme` (CHECK, nullable), `PATCH /auth/preferences`, sesi memuat keduanya; pilihan di menu akun langsung mengganti layar dan disimpan ke profil; `PreferenceSync` menerapkan pilihan tersimpan sekali setelah masuk, sehingga pilihan mengikuti pengguna ke perangkat lain. Nilai kosong tetap mengikuti bahasa browser dan tema sistem (D-09).
- [x] **12.19 Label komponen tanpa bawaan (M1-DS-05):** Select, Combobox, DatePicker, DateRangePicker, TimeInput, Dialog, Sheet, AlertDialog, navigasi, Pagination, Chart, Spinner, dan FilterBar tidak lagi punya teks bawaan Bahasa Indonesia; label wajib dikirim lewat props dari kamus `id`/`en`. DateRangePicker memakai `label` sebagai nama grup. Komponen domain lama (pos-modifier, floor-selector, finance-validated-report) memegang teksnya sendiri sampai dibersihkan di M1-DS-06.
- [x] **12.20 Komponen POS lama (M1-DS-06):** `ProductModifierPicker`, `PaymentMethodTile`, `CashKeypad`, dan `PaymentConfirmationPanel` dihapus dari `packages/ui` beserta CSS, story (`PosModifierPicker`, `PosPayment`, `PosManualFlow`), test, dan smoke test; kasir memakai versi di `apps/web/src/features/pos`. `pos-payment` hanya menyisakan `buildCashPresets`. `CartItem` dan `CartSummary` dipertahankan untuk layar pelanggan (M4) dengan semua teks lewat props `labels`; `customer-order-surface` masih memegang teks Indonesianya sampai dibangun ulang di M4.
- [ ] **12.10d-4 Lanjutan layar jual:** catatan per item, tahan pesanan, makan di tempat, gambar produk, dan status shift/koneksi di bar atas.

**Checkpoint 12.1:** `feat(ui): add POS product tile and category rail`

**Checkpoint 12.2:** `feat(ui): add POS modifier picker`

**Checkpoint 12.3:** `feat(ui): add POS cart item and summary`

**Checkpoint 12.4:** `feat(ui): add Money Display`

**Checkpoint 12.5:** `feat(ui): add POS payment method and cash keypad`

**Checkpoint 12.6:** `feat(ui): add guarded POS shift components`

**Checkpoint 12.7:** `feat(ui): add guarded POS manual payment flow`

**Checkpoint 12.8:** `feat(pos): add shift and cash movement api`

**Checkpoint 12.9:** `feat(web): add POS shell and shift page`

**Checkpoint 12.10a:** `feat(pos): add sellable menu api`

**Checkpoint 12.10b:** `feat(order): add order intake and POS order api`

**Checkpoint 12.10c:** `feat(billing): add bill, payment, and sale for POS checkout`

**Checkpoint 12.10d:** `refactor(ui): take POS catalog labels through props`, `feat(web): add the POS sell screen`

**Checkpoint 12.11a:** `feat(order): list and cancel cashier orders`

**Checkpoint 12.11b:** `feat(web): add the cashier order list`

**Checkpoint 12.12:** `feat(pos): print receipts`

**Checkpoint 12.13:** `feat(pos): take transfer and EDC payments`

**Checkpoint 12.14:** `feat(pos): refund paid orders`

**Checkpoint 12.15:** `feat(pos): show and print the closed shift summary`

**Checkpoint 12.16:** `feat(pos): add notes to cart lines`

**Checkpoint 12.17:** `feat(pos): hold and resume carts`

**Checkpoint 12.18:** `feat(web): remember language and theme on the user profile`

**Checkpoint 12.19:** `refactor(ui): require labels instead of Indonesian defaults`

**Checkpoint 12.20:** `refactor(ui): remove unused legacy POS components`

**POS catalog component gate:** Product Tile menyediakan variant `compact/default/touch/customer`, size `sm/md/lg/customer`, state selected, low stock, sold out, scheduled/unavailable, image loading, dan image fallback tanpa menyembunyikan harga/status. Category Rail menyediakan mode vertical untuk POS desktop dan horizontal-scroll untuk customer/mobile dengan active indicator yang eksplisit. Component tests mencakup interaksi, disabled state, semantics, dan axe smoke; Storybook production build serta review Chrome pada 1440/390 px, light/dark, focus ring, minimum size, long status, dan overflow sudah lulus.

**Modifier picker gate:** Single selection memakai radio dan multiple selection memakai checkbox; batas minimum/maksimum serta required incomplete state selalu terlihat. Pilihan yang unavailable tetap memiliki label, surcharge berada di sisi kanan, dan action cart tidak aktif sebelum group wajib lengkap. Struktur menyertakan product summary, note, quantity, total, serta add/update action; desktop memakai dialog `lg` dan viewport mobile memakai bottom sheet responsive. Component interaction dan axe smoke test, Storybook production build, serta review browser light/dark dan 1440/390 px wajib lulus.

**Cart gate:** Cart Item menjaga nama, modifier, note, quantity, harga satuan, line total, dan remove action pada variant compact/default; variant receipt bersifat read-only. Modifier panjang dapat dibuka/tutup tanpa menghilangkan konteks item. Cart Summary mengurutkan subtotal, diskon, pajak, service charge, pembulatan, total, pembayaran tercatat, dan sisa tagihan; baris yang tidak berlaku tidak dirender, sedangkan total menjadi hierarki visual terkuat. Component interaction dan axe smoke test, Storybook production build, serta review browser light/dark dan 1440/390 px wajib lulus.

**Money Display gate:** Nilai menerima integer minor-unit presisi aman melalui bigint, safe integer, atau string integer; default currency IDR ditampilkan tanpa mengubah source of truth. Variant inline/summary/total/accounting dan size sm/md/lg/xl memakai angka tabular. Nilai nol tampil `Rp0`, data unavailable tampil `-` dengan label aksesibel, sedangkan negatif mendukung minus atau parentheses secara konsisten tanpa bergantung pada warna. Component/axe test, Storybook production build, serta review browser light/dark dan 1440/390 px wajib lulus.

**POS payment component gate:** Payment Method Tile memakai native radio semantics untuk cash, merchant QRIS, transfer, EDC, dan mixed; ukuran md/lg, selected check, availability, serta instruction tetap terlihat dan metode unavailable tidak dapat dipilih. Cash Keypad hanya muncul untuk tunai, tombol angka minimal 56px, preset mengikuti total, serta amount received, change, clear, dan backspace memakai integer minor-unit. Component interaction/axe test, Storybook production build, serta review browser light/dark, keyboard, dan 1440/390 px wajib lulus.

**Shift component gate:** Open Shift hanya menyediakan input kas awal. Shift Summary menampilkan actor/time sekali, rekonsiliasi tunai, breakdown non-tunai yang tersedia, serta counted cash hanya ketika shift sudah ditutup; variance default tersembunyi dan hanya tampil saat caller memberi permission `canViewVariance`. Close Shift menampilkan expected cash sebagai read-only, hanya meminta counted cash, dan baru meminta alasan saat variance nonzero. Nilai turunan tidak menjadi payload input, baris yang tidak berlaku dihilangkan, serta tidak ada field outlet/kasir/waktu sebagai input. Component/axe test, Storybook production build, serta review browser light/dark dan 1440/390 px wajib lulus.

**Shift API gate:** Semua route memerlukan session, modul POS, `x-tenant-id`, dan `x-outlet-id` yang diperiksa terhadap membership; buka shift dan kas masuk/keluar memakai `shift.open`, tutup shift memakai `shift.close`. Kasir hanya dapat membaca dan mengubah shift miliknya di outlet aktif; shift tenant, outlet, atau kasir lain dilaporkan tidak ditemukan. Uang disimpan sebagai integer minor-unit dan dikirim sebagai string. Kas yang diharapkan dan selisih dihitung server (`kas awal + kas masuk - kas keluar`, `selisih = fisik - diharapkan`) dan tidak pernah menjadi input; selisih bukan nol wajib beralasan, dijaga di service dan CHECK database. Kas masuk/keluar wajib `Idempotency-Key`: kunci yang sama dengan isi sama mengembalikan hasil lama, isi berbeda ditolak; kas keluar tidak boleh melebihi uang di laci. Tutup shift yang diulang mengembalikan hasil tersimpan tanpa event baru. Audit dan outbox ditulis dalam transaksi yang sama. Penjualan tunai belum masuk ke kas yang diharapkan sampai checkpoint 12.10.

**Shift page gate:** Input pengguna hanya kas awal, jenis/jumlah/keterangan kas, kas fisik, dan alasan selisih. Waktu buka, kas awal, kas masuk, kas keluar, dan kas seharusnya hanya ditampilkan; kas seharusnya dan selisih tidak pernah dikirim sebagai input. Nama kasir dan outlet hanya ada di bar atas. Baris penjualan tunai dan panel riwayat kas tidak dirender selama datanya belum ada. Satu aksi utama per layar: Buka shift, atau Tutup shift (hanya dengan izin `shift.close`) dengan Catat kas sebagai aksi sekunder. Layar hanya berubah setelah server menjawab; catat kas memakai satu `Idempotency-Key` per niat sehingga pengulangan tidak tercatat dua kali. Uji browser dengan PostgreSQL lokal lolos untuk alur login → buka → kas masuk/keluar → muat ulang → tutup dengan selisih, Indonesia/Inggris, terang/gelap, dan 1440/390 px tanpa geser horizontal. Belum ada: status koneksi dan status shift di bar atas, ringkasan shift tertutup untuk dicetak, dan uji dengan akun kasir tanpa izin `shift.close`.

**Sellable menu gate:** Menu dibangun server dari katalog tenant oleh fungsi murni `buildSellableMenu`; layar tidak menghitung ketersediaan atau harga. Produk hanya muncul bila tenant dan outlet aktif, assignment outlet aktif, produk dan kategorinya aktif, serta ketersediaan efektif `AVAILABLE`. Harga adalah harga outlet (override, atau harga dasar). Varian dan pilihan modifier yang nonaktif atau habis tidak dikirim; produk yang dijual per varian hilang bila semua variannya habis; produk hilang bila grup modifier wajib tidak dapat dipenuhi; grup opsional tanpa pilihan tidak dikirim; `maxSelections` tidak melebihi jumlah pilihan yang tersedia. Kasir outlet-scoped dapat membacanya tanpa akses semua outlet. Gambar produk belum disertakan karena penyajian berkas belum ada.

**Order intake gate:** Klien hanya mengirim produk, varian, pilihan modifier, jumlah, dan catatan; nama serta harga diambil server dari menu jual saat itu dan disimpan sebagai snapshot, sehingga perubahan katalog tidak mengubah pesanan lama. Harga satuan = harga outlet + selisih varian + selisih modifier; `line_total = unit_price * quantity` dijaga CHECK; subtotal pesanan adalah nilai turunan, tidak disimpan. Produk yang dijual per varian wajib tepat satu varian; pilihan modifier harus milik grup produk itu dan memenuhi minimum/maksimum grup. Penolakan menyebut kode dan indeks baris. Nomor pesanan berurutan per outlet lewat counter yang naik dalam transaksi yang sama. `Idempotency-Key` wajib: pengulangan mengembalikan pesanan semula walau menu sudah berubah. Pesanan hanya terbaca di tenant dan outlet miliknya. Pesanan kasir langsung berstatus `SUBMITTED`; saat ini hanya `TAKEAWAY` (makan di tempat menunggu sesi meja), dan tahan pesanan, batal, serta daftar pesanan belum ada.

**Checkout gate:** Kasir hanya menyatakan cara bayar (tunai dengan uang diterima, atau QRIS manual dengan referensi opsional); jumlah yang dibayar selalu seluruh tagihan dan ditentukan server. Total tagihan adalah nilai turunan `subtotal - diskon + pajak + service charge + pembulatan` dan dijaga CHECK; pajak, service charge, diskon, dan pembulatan belum dikonfigurasi sehingga bernilai nol dan total sama dengan subtotal (harga menu diperlakukan sebagai harga akhir). Kembalian adalah nilai turunan `uang diterima - jumlah`, tidak disimpan dan tidak diinput; uang diterima yang kurang ditolak. Satu transaksi menulis bill, pembayaran, alokasi, nomor penjualan, penjualan, audit, dan outbox. Satu bill per pesanan dan satu penjualan per bill; pelunasan dijaga status sehingga pesanan tidak dapat dibayar dua kali, dan `Idempotency-Key` yang sama mengembalikan hasil semula. Pembayaran hanya diterima dalam shift terbuka milik kasir. Pembayaran, kas masuk/keluar, dan tutup shift mengunci baris shift yang sama, sehingga pembayaran selalu terhitung oleh penutupan atau ditolak; kas seharusnya dihitung setelah kunci didapat. Hanya pembayaran tunai yang menambah kas seharusnya. Status pembayaran terpisah dari status pesanan. Belum ada: pembayaran sebagian/campuran, transfer, EDC, refund, batal, dan pengaturan pajak.

**Sell screen gate:** Input kasir hanya pilihan produk, varian, tambahan, jumlah, metode bayar, uang diterima, dan referensi QRIS. Harga satuan, total baris, total, dan kembalian adalah nilai turunan yang hanya ditampilkan; payload pesanan tidak memuat nama atau harga. Total tampil di satu tempat per layar: keranjang saat menjual, layar pembayaran saat membayar (yang menggantikan katalog dan keranjang), lalu layar lunas. Produk tanpa varian/tambahan langsung masuk keranjang dan baris yang sama digabung; produk lain membuka panel pilihan yang tombolnya nonaktif sampai aturan grup terpenuhi. Pesanan dikirim saat kasir mengonfirmasi pembayaran; bila total server berbeda dari keranjang (menu berubah), pembayaran ditahan dan total baru ditampilkan untuk dikonfirmasi ulang. Satu kunci idempotensi per keranjang dan satu per pembayaran. Tanpa shift terbuka layar mengarahkan ke buka shift. Di layar kecil produk menjadi tampilan utama dan keranjang dibuka dari bar ringkasan bawah. Uji browser dengan PostgreSQL lokal lolos: tunai dengan kembalian, QRIS, penjualan tunai muncul di shift, tutup shift seimbang, Indonesia/Inggris, terang/gelap, 1440/390 px tanpa geser horizontal. Setelah pesanan terkirim, keranjang tidak dapat diubah lagi: kasir membayar sekarang atau memilih "Bayar nanti" lalu membayar atau membatalkannya dari daftar pesanan.

**Order cancellation gate:** Hanya pesanan yang belum dibayar yang dapat dibatalkan, dengan alasan 3–300 karakter; pesanan yang sudah dibayar adalah penjualan dan kelak di-refund, bukan dibatalkan. Pesanan tidak dihapus; status `CANCELED` wajib disertai waktu, pelaku, dan alasan (CHECK). Batal dan bayar mengunci baris pesanan yang sama, sehingga pesanan dibatalkan sebelum dibayar atau dibayar sebelum dibatalkan, tidak keduanya. Membatalkan ulang mengembalikan hasil pertama. Daftar pesanan kasir mencakup 24 jam terakhir (maksimal 100) dengan status bayar dari billing.

**Receipt gate:** Struk hanya ada untuk pesanan lunas (`RECEIPT_NOT_FOUND` untuk yang belum). Isi: nama outlet dan bisnis dari konteks workspace, nomor penjualan, nomor pesanan, waktu, kasir, baris item dengan varian/tambahan/catatan, total (subtotal dan penyesuaian hanya bila ada penyesuaian), metode, uang diterima, kembalian, referensi; tanpa ID internal. Cetak ulang dari daftar pesanan bertanda SALINAN. Uji browser lolos: tampilan terang/gelap, pilihan kertas tersimpan, dan media cetak hanya memuat struk hitam di atas putih dari pojok kiri atas.

**Non-cash gate:** Pembayaran non-tunai tidak memuat uang diterima atau kembalian (CHECK `tendered_minor` kosong) dan tidak menambah kas seharusnya; total per metode dihitung billing dari pembayaran `PAID` yang terikat shift dan hanya metode yang ada pembayarannya yang ditampilkan. Uji browser lolos: transfer dengan referensi tampil di struk, EDC tanpa referensi, ringkasan shift memisahkan Non-tunai dari kas, tutup shift seimbang.

**Refund gate:** Kasir hanya mengisi jumlah dan alasan; metode selalu metode pembayaran asli dan sisa yang bisa direfund dihitung server. Jumlah refund kumulatif tidak dapat melebihi total penjualan: dicek di dalam transaksi setelah baris penjualan dan baris shift dikunci. Refund tunai tidak boleh melebihi kas seharusnya di laci. Penjualan dan pembayaran asli tetap ada; status penjualan menjadi `PARTIALLY_REFUNDED`/`REFUNDED`. Kas seharusnya = kas awal + penjualan tunai − refund tunai + kas masuk − kas keluar, dihitung di bawah kunci shift saat tutup. Audit `sale.refund` dan outbox `sale.refunded.v1` dalam transaksi yang sama. Uji browser lolos: validasi kosong dan berlebih, refund sebagian lalu sisanya, tombol Refund hilang setelah direfund penuh, struk mencantumkan refund, shift seimbang setelah refund tunai. Belum diuji dengan akun kasir tanpa izin refund (`M1-SC-04`); persetujuan manager (`M1-FT-10`) belum ada.

**Held cart gate:** Keranjang yang ditahan hanya menyimpan pilihan (produk, varian, pilihan tambahan, jumlah, catatan) dan label; tidak bernomor, tidak menyimpan harga, dan tidak memengaruhi kas. Harga dihitung ulang dari menu saat dilanjutkan, dan baris yang sudah tidak dijual dibuang dari keranjang dengan pemberitahuan. Keranjang tertahan berlaku per outlet sehingga kasir lain dapat melanjutkannya; ambil dan buang memakai baca-lalu-hapus dalam transaksi sehingga satu keranjang tidak dapat diambil dua kali. Menahan bersifat idempotent per kunci. Uji browser lolos: label wajib, keranjang kosong setelah ditahan, lanjutkan dinonaktifkan saat keranjang berisi, catatan ikut kembali, buang mengosongkan daftar.

**POS manual flow gate:** Tahap order hanya menampilkan source takeaway, katalog, keranjang, dan ringkasan yang berlaku; order number baru muncul setelah masuk pembayaran. Tahap pembayaran mengganti katalog/keranjang dengan total dan metode cash/manual QRIS. Cash meminta nominal diterima, sedangkan QRIS menuju panel verifikasi tanpa membuat reference sebagai input. Payment Confirmation menampilkan metode, nominal, waktu order, optional reference, dan instruction secara read-only; status `Lunas` hanya berasal dari state `PAID` dan action konfirmasi hanya tersedia pada `VERIFYING`. Data customer, table, receipt, refund, approval, serta metode di luar acceptance cash/QRIS tidak dicampurkan ke checkpoint ini. Component/axe test, Storybook production build, serta review browser light/dark dan 1440/390 px wajib lulus.

**STOP:** Report, review, commit, dan push Tahap 12.7 sebelum menginstal dependency Table Layout/Tahap 13.

### Tahap 13 - Table Layout dan QR Self-Order

- [x] **13.0 Dependency Table Layout:** install `@dnd-kit/react@0.5.0` dan `@dnd-kit/dom@0.5.0` dengan peer React 19 yang tervalidasi.
- [x] **13.1 Floor Selector:** variant tabs/select/compact, size sm/md/lg, label staf, optional table count, disabled/empty state, serta keyboard navigation tanpa mengekspos ID internal atau metadata layout.
- [x] **13.2 Table Tile view/edit:** size sm/md/lg, state operasional eksplisit, mode view/edit terseleksi, metrik guest/order/durasi hanya saat berlaku, serta tidak mengekspos ID internal, koordinat, QR, audit, customer, atau metadata session.
- [x] **13.3 Table Layout Canvas snap-to-grid:** canvas logical grid untuk staff, mode view/edit/preview, item memakai koordinat integer, drag memakai `@dnd-kit/react` dan snap/clamp ke grid tanpa mengekspos metadata internal.
- [x] **13.4 Table Layout Toolbar dan Property Panel:** mode selector, tool select, snap toggle, empty selection, dan property panel posisi/ukuran grid tanpa mengekspos metadata internal atau field di luar kontrak.
- [x] **13.5 Unplaced Table Tray:** daftar meja belum ditempatkan dengan action tempatkan/select, empty state, disabled reason, dan derived count tanpa mengekspos ID internal, koordinat, QR, atau metadata operasional.
- [x] **13.6 Bounds/overlap validation dan keyboard alternative:** deteksi overlap berbasis label, penanda konflik, kontrol arah untuk meja terpilih, dan arrow-key movement yang tetap clamp ke batas canvas.
- [x] **13.7 Table QR generate/print/revoke/rotate:** staff QR manager untuk generate, print, rotate, revoke, status QR, preview QR dari sistem, dan action callback tanpa mengekspos token mentah, internal ID, atau customer context.
- [x] **13.8 Customer QR resolution dan table context:** customer storefront context untuk status resolving/ready/closed/invalid, merchant/outlet, label meja hasil resolve, dan action mulai pesan/retry tanpa membawa token, internal table ID, layout grid, session, payment, atau audit metadata.
- [x] **13.9 Customer tidak menerima internal table layout:** mapper customer-safe untuk resolusi QR hanya meneruskan status, label meja publik, dan pesan sistem; internal table ID, floor/grid/coordinate layout, raw token, session, payment, dan audit metadata dibuang sebelum masuk surface customer.

**Checkpoint 13.0:** `build(ui): add Table Layout drag-and-drop foundation`

**Table Layout dependency gate:** Proyek baru memakai API stabil terbaru `DragDropProvider` dari `@dnd-kit/react` serta pointer/keyboard sensor dari `@dnd-kit/dom`. Kedua package dipin pada `0.5.0`, mendukung React 19, dan ditempatkan langsung pada `packages/ui` sebagai pemilik komponen canvas. Legacy `@dnd-kit/core`, prerelease `beta`, dan `@dnd-kit/sortable` tidak dipasang; sortable tidak sesuai karena layout menyimpan koordinat grid, bukan urutan list. Lockfile harus frozen-installable dan import runtime/type harus lolos sebelum komponen dibuat.

**STOP:** Report, review, commit, dan push Tahap 13.0 sebelum membuat Floor Selector.

**Checkpoint 13.1:** `feat(ui): add guarded Floor Selector`

**Floor Selector gate:** Komponen hanya mengubah lantai aktif. Variant `tabs` dipakai untuk 2-5 lantai pada desktop/tablet, `select` untuk daftar panjang atau ruang sempit, dan `compact` untuk toolbar POS. UI hanya menampilkan label staf serta optional jumlah meja; ID internal menjadi value yang tidak terlihat, sedangkan grid size, area, posisi, QR, audit, dan metadata layout tidak dirender. Jumlah `0 meja` tetap valid bila tersedia, tetapi count yang tidak tersedia dihilangkan. Tabs mendukung Arrow Left/Right, Home, End, disabled state, dan roving focus. Component/axe test, Storybook production build, serta review browser light/dark dan 1440/390 px wajib lulus.

**STOP:** Report, review, commit, dan push Tahap 13.1 sebelum membuat Table Tile view/edit.

**Checkpoint 13.2:** `feat(ui): add guarded Table Tile`

**Table Tile gate:** Komponen hanya memilih meja pada `view` atau memilih tile pada `edit`. Label meja dan status operasional tampil satu kali sebagai konteks utama; guest count, order count, dan durasi hanya tampil pada state layanan aktif saat nilainya tersedia. Nilai `0` eksplisit tetap valid, tetapi data yang tidak tersedia atau tidak berlaku dihilangkan. Mode `edit` tidak menampilkan metrik operasional dan tidak menyediakan field posisi, ukuran grid, floor/area, shape, QR, customer, payment, audit, actor, timestamp, atau metadata session. State disabled/non-service tidak selectable pada `view`, tetapi tetap dapat dipilih pada `edit` oleh manager berizin. Component/axe test, Storybook production build, serta review browser light/dark dan 1440/390 px wajib lulus.

**STOP:** Report, review, commit, dan push Tahap 13.2 sebelum membuat Table Layout Canvas snap-to-grid.

**Checkpoint 13.3:** `feat(ui): add Table Layout Canvas snap-to-grid`

**Checkpoint 13.4:** `feat(ui): add Table Layout toolbar and property panel`

**Checkpoint 13.5:** `feat(ui): add Unplaced Table Tray`

**Checkpoint 13.6:** `feat(ui): add table layout validation and keyboard movement`

**Checkpoint 13.7:** `feat(ui): add Table QR management controls`

**Checkpoint 13.8:** `feat(ui): add Customer QR context surface`

**Checkpoint 13.9:** `feat(ui): guard customer QR table context`

**Table Layout Canvas gate:** Canvas hanya tersedia sebagai komponen staff untuk memetakan posisi meja pada logical grid. Source of truth item adalah `gridX`, `gridY`, `gridW`, dan `gridH` integer; drag pada mode `edit` memakai `DragDropProvider` dari `@dnd-kit/react`, sensor pointer/keyboard dari `@dnd-kit/dom`, serta snap/clamp ke grid sebelum callback perubahan posisi. Mode `view` dan `preview` read-only terhadap posisi. UI hanya merender boundary canvas, grid, dan `TableTile`; tidak menyediakan objek bangunan, toolbar, property panel, unplaced tray, save/undo, overlap messaging, QR, capacity, shape editor, customer/payment/session/audit/actor/timestamp metadata, atau layout customer. Component/axe test, Storybook production build, serta review browser light/dark dan 1440/390 px wajib lulus.

**STOP:** Report, review, commit, dan push Tahap 13.3 sebelum membuat Table Layout Toolbar dan Property Panel.

**Table Layout tools gate:** Toolbar hanya mengatur mode layout, tool aktif, dan snap-to-grid preference. Property Panel hanya muncul untuk meja terpilih dan hanya mengubah `gridX`, `gridY`, `gridW`, serta `gridH` sebagai integer grid yang tetap berada dalam batas canvas. Label meja hanya dipakai sebagai konteks seleksi; ID internal, status operasional detail, grid canvas global, floor/area, QR, capacity, shape, customer, payment, session, audit, actor, timestamp, save/undo, unplaced tray, overlap messaging, dan layout customer tidak dirender atau dijadikan input pada checkpoint ini. Component/axe test, Storybook production build, serta review browser light/dark dan 1440/390 px wajib lulus.

**STOP:** Report, review, commit, dan push Tahap 13.4 sebelum membuat Unplaced Table Tray.

**Unplaced Table Tray gate:** Tray hanya tersedia untuk staff saat mengatur layout dan hanya menampilkan label meja yang belum ditempatkan, optional disabled reason, action menempatkan/select meja, empty state, serta derived count. ID internal hanya menjadi callback value dan tidak terlihat. Tray tidak merender atau menerima koordinat, ukuran grid, floor/area, QR, capacity, shape, customer, payment, session, audit, actor, timestamp, save/undo, overlap messaging, atau layout customer. Component/axe test, Storybook production build, serta review browser light/dark dan 1440/390 px wajib lulus.

**STOP:** Report, review, commit, dan push Tahap 13.5 sebelum membuat Bounds/overlap validation dan keyboard alternative.

**Bounds/keyboard gate:** Canvas memvalidasi overlap antar meja dari `gridX`, `gridY`, `gridW`, dan `gridH`, menampilkan pesan berbasis label yang terlihat, serta menandai tile konflik tanpa mengekspos ID internal. Pergerakan keyboard hanya tersedia pada mode `edit` untuk meja terpilih dan memakai arrow key atau tombol arah, tetap clamp ke batas canvas, serta tidak membuat save/undo, property baru, unplaced tray logic, QR, capacity, shape, floor/area, customer, payment, session, audit, actor, timestamp, atau layout customer. Component/axe test, Storybook production build, serta review browser light/dark dan 1440/390 px wajib lulus.

**STOP:** Report, review, commit, dan push Tahap 13.6 sebelum membuat Table QR generate/print/revoke/rotate.

**Table QR gate:** Table QR Manager hanya tersedia untuk staff sebagai kontrol generate, print, rotate, dan revoke QR per meja. UI menampilkan label meja, status QR, preview QR yang sudah disediakan sistem, dan pesan status operasional. Internal table ID hanya menjadi nilai callback tersembunyi; raw token, URL QR, customer/session context, audit actor, timestamp detail, payment data, dan resolusi customer tidak dirender atau dijadikan input. QR aktif dapat dicetak/dirotasi/dicabut, sedangkan QR hilang atau dicabut hanya dapat dibuat ulang. Component interaction/axe test, Storybook production build, serta review browser light/dark dan 1440/390 px wajib lulus.

**STOP:** Report, review, commit, dan push Tahap 13.7 sebelum membuat Customer QR resolution dan table context.

**Customer QR context gate:** Customer QR Context hanya merender hasil resolusi QR yang aman untuk customer: identitas merchant, outlet bila tersedia, status resolving/ready/closed/invalid, label meja yang sudah di-resolve, pesan sistem, serta action mulai pesanan atau coba lagi. Komponen tidak menerima atau menampilkan raw token, URL QR, internal table ID, koordinat/grid/floor layout, customer/session ID, order/payment data, audit actor, timestamp detail, atau kontrol staff. Status resolving/closed menonaktifkan mulai pesanan, invalid hanya menyediakan retry, dan ready mengizinkan mulai pesanan tanpa argumen ID internal. Component interaction/axe test, Storybook production build, serta review browser light/dark dan 1440/390 px wajib lulus.

**STOP:** Report, review, commit, dan push Tahap 13.8 sebelum membuat Customer tidak menerima internal table layout.

**Customer table layout privacy gate:** Customer-facing QR resolution wajib dibangun dari model publik yang hanya mengenal label meja, status resolusi, dan pesan sistem. Bila caller memiliki record internal layout staff, mapper harus menghasilkan payload baru yang hanya berisi `status`, `tableLabel`, dan optional `message`; ID internal meja, floor/area, koordinat/grid, ukuran canvas, raw token/URL QR, session/customer ID, order/payment data, audit actor, timestamp, dan metadata staff tidak boleh diteruskan sebagai props atau dirender di Storybook customer. Component/unit test harus membuktikan object hasil mapper tidak memuat field internal, Storybook smoke harus memastikan surface customer tidak mengekspos label internal, serta build/lint/typecheck tetap lulus.

**STOP:** Report, review, commit, dan push Tahap 13.9 sebelum memulai Tahap 14 KDS.

### Tahap 14 - KDS

- [x] **14.0 KDS realtime dependency foundation:** install package realtime resmi untuk API NestJS WebSocket/Socket.IO adapter dan client web Socket.IO tanpa membuat KDS ticket, gateway, route, atau flow realtime terlebih dahulu.
- [x] **14.1 Kitchen Ticket sm/md/lg:** ticket KDS untuk status, order/table/source, elapsed label, item quantity/name, modifier, note, allergy/special note, size sm/md/lg, variant compact/default/touch/history, dan primary action tanpa menampilkan harga, HPP, payment, nomor telepon, atau ID internal.
- [x] **14.2 Timer dan SLA state:** timer label/state dan SLA state read-only pada Kitchen Ticket tanpa menghitung realtime lokal, threshold mentah, event contract, audio alert, reconnect/refetch, payment/HPP, customer identity, atau ID internal.
- [x] **14.3 Audio/visual new-ticket alert:** alert ticket baru untuk KDS dengan visual state, audio readiness/blocked/muted state, action enable audio dan acknowledge, tanpa memutar audio otomatis, raw sound URL, event contract, reconnect/refetch, payment/HPP, customer identity, nomor telepon, atau ID internal sebagai teks.
- [x] **14.4 Reconnect/refetch flow:** status koneksi KDS dengan state connected/connecting/disconnected/stale, last sync, pending count, action reconnect dan refresh, tanpa membuat gateway/event contract, retry token, queue subscription, payment/HPP, customer identity, nomor telepon, atau ID internal sebagai teks.
- [x] **14.5 KDS tidak menerima payment/HPP/customer sensitive data:** seluruh surface KDS menolak key payment/HPP/cost/profit/customer/contact/token/payload sebelum render dan tetap hanya menerima read model dapur yang aman.

**Checkpoint 14.0:** `build(kds): add realtime dependencies`

**Checkpoint 14.1:** `feat(ui): add KDS kitchen ticket`

**Checkpoint 14.2:** `feat(ui): add KDS timer and SLA states`

**Checkpoint 14.3:** `feat(ui): add KDS new ticket alert`

**Checkpoint 14.4:** `feat(ui): add KDS reconnect and refetch status`

**Checkpoint 14.5:** `feat(ui): guard KDS sensitive read model data`

**KDS realtime dependency gate:** API memakai direct dependency resmi NestJS `@nestjs/websockets` dan `@nestjs/platform-socket.io` dengan versi yang sejajar dengan `@nestjs/core/common`. Web memakai `socket.io-client` untuk calon device KDS. Checkpoint ini hanya memasang dependency dan lockfile; belum membuat gateway, namespace, event contract, ticket UI, audio alert, reconnect/refetch logic, atau KDS read model. Typecheck/lint paket terkait dan frozen lockfile install harus tetap lulus.

**STOP:** Report, review, commit, dan push Tahap 14.0 sebelum membuat Kitchen Ticket sm/md/lg.

**Kitchen Ticket gate:** Kitchen Ticket menampilkan read model dapur saja: nomor order, label meja bila tersedia, source, elapsed label statis dari server, status KDS, item quantity/name, modifier, note, allergy/special note bila ada, dan primary state action. Size `sm/md/lg` mengikuti kontrak lebar/header/action; variant `compact/default/touch/history` tersedia, dengan `history` read-only. Ticket tidak merender harga, HPP, nomor telepon, informasi pembayaran, customer identity, internal ticket/order/table ID sebagai teks, audio alert, reconnect/refetch, atau SLA threshold dynamic coloring. Component interaction/axe test, Storybook production build, serta smoke browser 1440/390 px dan light/dark wajib lulus.

**STOP:** Report, review, commit, dan push Tahap 14.1 sebelum membuat Timer dan SLA state.

**Timer/SLA gate:** Timer dan SLA hanya memperkaya Kitchen Ticket sebagai display dapur read-only. `elapsedLabel`, `timerState`, dan `slaState` berasal dari read model/server atau caller yang sudah aman; komponen tidak menghitung deadline realtime lokal, tidak menerima threshold mentah sebagai field UI, dan tidak membuat event realtime. SLA state tampil sebagai on-track, warning, atau breached dengan label aman; timer state tampil sebagai running, paused, atau completed. Internal ticket/order/table ID tetap hanya untuk callback action dan tidak tampil sebagai teks. Checkpoint ini tidak membuat audio/visual alert, reconnect/refetch flow, gateway Socket.IO, namespace, harga, HPP, payment, customer identity, nomor telepon, atau data sensitif. Component interaction/axe test, Storybook production build, serta smoke browser 1440/390 px dan light/dark wajib lulus.

**STOP:** Report, review, commit, dan push Tahap 14.2 sebelum membuat Audio/visual new-ticket alert.

**Audio/visual alert gate:** New-ticket alert hanya memberi sinyal staff KDS bahwa ada ticket baru yang perlu dilihat. Visual alert menampilkan jumlah ticket baru dan pesan aman dari caller; audio state hanya `ready`, `muted`, atau `blocked` sebagai display/aksi user, tanpa memutar audio otomatis dan tanpa menerima raw sound URL sebagai field UI. Enable audio dan acknowledge adalah user action eksplisit dan internal alert ID hanya dipakai sebagai callback value tersembunyi. Checkpoint ini tidak membuat gateway/event contract, reconnect/refetch flow, queue subscription, payment, HPP, customer identity, nomor telepon, internal ticket/order/table ID sebagai teks, audit metadata, atau konfigurasi perangkat permanen. Component interaction/axe test, Storybook production build, serta smoke browser 1440/390 px dan light/dark wajib lulus.

**STOP:** Report, review, commit, dan push Tahap 14.3 sebelum membuat Reconnect/refetch flow.

**Reconnect/refetch gate:** Reconnect/refetch hanya menyediakan control surface staff KDS untuk melihat status koneksi dan meminta sinkronisasi ulang. UI menampilkan state connected/connecting/disconnected/stale, last sync label bila tersedia, pending count bila tersedia, pesan aman, serta action `Reconnect` dan `Refresh`. Internal status ID hanya menjadi callback value tersembunyi. Checkpoint ini tidak membuat gateway Socket.IO, namespace, event payload, retry token, queue subscription, polling interval, backoff scheduler, ticket read model baru, payment, HPP, customer identity, nomor telepon, internal ticket/order/table ID sebagai teks, atau audit metadata. Component interaction/axe test, Storybook production build, serta smoke browser 1440/390 px dan light/dark wajib lulus.

**STOP:** Report, review, commit, dan push Tahap 14.4 sebelum membuat guard KDS tidak menerima payment/HPP/customer sensitive data.

**KDS sensitive data guard gate:** Surface KDS tidak boleh menerima payment, HPP/COGS/cost/profit/margin, customer identity/contact, invoice/receipt/billing, raw token, namespace/socket/event payload, atau metadata sensitif lain sebagai props atau nested item data. Guard harus menolak key sensitif sebelum render, termasuk payload yang masuk lewat object spread. Data yang tetap valid hanya read model dapur: nomor order, label meja/source, status KDS, elapsed/timer/SLA label aman, item quantity/name/modifier/note/allergy, alert count/audio state, connection state/last sync/pending count, dan callback action dengan internal ID tersembunyi. Component/unit test harus membuktikan key sensitif ditolak, Storybook smoke harus memastikan surface KDS tidak mengekspos istilah/label sensitif, serta build/lint/typecheck tetap lulus.

**STOP:** Report, review, commit, dan push Tahap 14.5 sebelum memulai Tahap 15 Inventory Basic.

### Tahap 15 - Inventory Basic

- [x] Inventory item/unit.
- [x] Stock Indicator dan Movement Row.
- [x] Stock in/out, adjustment, opname, waste, dan transfer.
- [x] Recipe/BOM Editor.
- [x] Order consumption, cancellation reversal, dan waste.

### Tahap 16 - Finance Basic

- [x] Finance Metric.
- [x] Sales, expense, other income, dan cashbook.
- [x] Reconciliation dan Shift Summary.
- [x] HPP/gross profit/operating profit estimasi.
- [x] Report table dan chart hanya untuk metrik yang tervalidasi.

### Tahap 17 - Customer dan Platform Admin

- [x] Customer Basic.
- [x] Customer product/cart/order-status page.
- [x] Platform tenant/subscription master.
- [x] Entitlement Matrix.
- [x] Support context dan Audit Event.

---

## 8. PRIORITAS P4 - Hardening dan Pilot

### Tahap 18 - PWA dan device mode

- [x] Merchant app manifest dan installability.
- [x] Application-shell caching.
- [x] POS/KDS/BACKOFFICE/INVENTORY device mode.
- [x] Last-known menu dan draft cart cache.
- [x] Operasi finansial/stok tetap membutuhkan server acknowledgement.

### Tahap 19 - Reliability dan security

- [x] Tenant/outlet isolation full test.
- [x] Rate limit login dan QR submit.
- [x] CSRF/session/security header.
- [x] Audit critical action.
- [x] Backup/restore drill.
- [x] Queue retry/dead-letter.
- [x] Monitoring, request ID, structured log, dan error tracking.

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

## 9. Urutan checkpoint berikutnya

Urutan ini menggantikan daftar push fondasi lama. Setiap baris tetap harus menjadi checkpoint yang berdiri sendiri dan route reslicing memerlukan konfirmasi user.

```text
Current  Source-of-truth alignment: product + foundation + audit + TODO
Done     Backend Delta 1: architecture + ORM/API/security contract audit
Done     Backend Delta 2.1: workspace terminology contract
Done     Backend Delta 2.2: module manifest contract
Done     Backend Delta 2.3: installation and integration lifecycle contract
Done     Backend Delta 3.1: package limit and usage metering contract
Done     Backend Delta 4.1: event envelope and inbox contract
Done     Backend Delta 4.2: command context contract
Done     Security Delta 1: support access contract
Done     Security Delta 2: QR token lifecycle contract
Done     Backend Delta 5.1: module boundary rule contract
Done     Documentation remap: prd, design-system, architecture, schema, backend, frontend, security, deploy, flowchart
Done     UI Foundation 1: bank warna Calm Neutral monokrom
STOP     User meninjau /color-bank light dan dark
Then     Komponen UI dibenahi satu per satu, dimulai dari Button
Then     UI Foundation 2-7: Tabler, i18n, API client, shell/pattern, route group, reslice Catalog
Then     Core modular: tabel dan API instalasi, binding, paket berversi, limit, inbox
Then     Catalog + POS Basic end-to-end
Then     KDS Basic + standalone/integration proof
Then     Floor/Table + QR + Live Table View
Then     Customer, Inventory, Business Finance, HC, Platform Admin, Reports
```

Jangan menggabungkan backend delta audit, foundation convergence, dan reslicing route bisnis. Setelah setiap checkpoint, update file ini dan lengkapi acceptance gate sebelum lanjut.

## 10. Hal yang belum dikerjakan sekarang

- Browser acceptance aktual belum tersedia; runtime dev masih tertahan lock `.next/dev`. Production HTTP smoke lulus, tetapi tidak ada klaim screenshot, click flow, responsive, light/dark, atau accessibility untuk alignment baru.
- Backend delta terhadap PRD Modular v2.3 belum diaudit detail: module manifest, installation lifecycle, integration binding, package version snapshot, usage metering, standalone module path, dan workspace terminology baru belum boleh dianggap selesai.
- ORM/schema delta perlu diperiksa ulang terhadap `docs/foundation/architecture.md`: Core tables, usage tables, module installation/config, integration binding, Floor/Table/QR, KDS, Inventory, Finance Core, HC, Customer, dan reporting projection.
- Security/reliability lama sudah selesai untuk checkpoint Tahap 19, tetapi requirement baru masih perlu proof tambahan: integration API rate limit, module boundary lint, disposable PostgreSQL/RLS integration test, QR token privacy, support access, PII-safe event/log, dan hard/soft limit semantics.
- Bank warna sudah Calm Neutral, tetapi tiap komponen belum diperiksa satu per satu pada palet baru dan halaman referensi `/design-system` masih memuat teks lama. Font Geist dipertahankan. Ikon masih Lucide dan belum ada i18n.
- Web client belum mengirim header `x-csrf-token` yang diwajibkan API untuk mutasi bersesi (temuan `SEC-F1` di `docs/foundation/security.md`); perlu diverifikasi di browser dan diperbaiki pada UI Foundation 4.
- Runtime route matrix perlu dilengkapi setelah server dan browser gate tersedia; source audit awal berada di `docs/foundation/DESIGN_SYSTEM_APP_AUDIT.md`.
- POS, KDS, Inventory, Floor/Table, Finance, HC, Customer/Self-Order, Reports, Settings, dan Platform Admin belum boleh dianggap UI selesai hanya karena domain component atau backend contract tersedia.
- Audit penutupan acceptance gate Storybook dan seluruh primitive P1 perlu diulang terhadap design system baru.
- Redis/BullMQ dan Docker Compose local services tetap deferred sampai use case worker/infrastructure ditetapkan. PostgreSQL development lokal sudah tersedia; integration test PostgreSQL/RLS tetap menunggu database test terisolasi dan disposable.
- Authentication/session, organization registry, membership/RBAC/outlet assignment, subscription/module/entitlement core, tenant-isolation regression, Platform Owner, security, reliability, dan observability yang sudah diterapkan harus dipertahankan saat UI diselaraskan.
