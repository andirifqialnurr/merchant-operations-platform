# Design System App Audit

**Tanggal alignment:** 5 Agustus 2026  
**Snapshot implementasi terakhir yang tersedia di file lama:** 3 Agustus 2026  
**Status:** Source re-audit selesai; runtime visual/interaksi masih menunggu browser gate  
**Requirement sources:** PRD v2.3, Module Tiers v1.2, Packages & Limits v1.2, `architecture.md`, `design-system.md`, `design-system-modules.md`

## 1. Tujuan dan batas audit

Dokumen ini memisahkan tiga hal:

1. **Requirement target** dari PRD terbaru.
2. **Design/component readiness** dari design-system foundation.
3. **Observed implementation** dari snapshot audit yang tersedia.

Audit **bukan** source of truth scope. Bila code saat ini belum memenuhi requirement, catat sebagai gap; jangan mengubah requirement agar terlihat “selaras”.

Source route web telah diperiksa ulang pada 5 Agustus 2026. Server tidak sedang aktif pada awal audit. Upaya menjalankan `pnpm.cmd --filter @merchant/web dev` dapat menemukan Next.js 16.2.10, tetapi proses berhenti karena lock `.next/dev` tidak dapat diperoleh. Build produksi yang sudah tersedia kemudian berhasil dijalankan sementara melalui `pnpm.cmd --filter @merchant/web start`: route `/`, `/design-system`, `/color-bank`, `/typography`, `/foundation`, `/backoffice/catalog`, `/pos`, `/kds`, dan `/inventory` merespons HTTP 200; `/finance`, `/hc`, dan `/platform` merespons 404. Browser dalam aplikasi tidak tersedia pada sesi audit. Karena itu status di bawah adalah bukti source/HTTP, bukan klaim visual, klik, responsive, light/dark, atau accessibility runtime.

## 2. Perubahan requirement sejak audit lama

Empat area membuat audit lama tidak lagi cukup:

| Area | Keputusan terbaru | Dampak audit |
|---|---|---|
| Platform modular | Workspace + module installation + integration binding + tier/capability/limit | Route tidak cukup dinilai dari visual; access/setup/limit state wajib diuji |
| Floor/Table | `Location -> Floor -> Area -> Table -> Table Session`, 3 shapes, QR, move, Pro merge/split | Table route perlu editor + live operation + responsive S/M/L |
| HC/Finance standalone | HC Basic R1 simple dan Business Finance dapat standalone | App harus mampu shell/navigation non-F&B tanpa dependency POS |
| Responsive | S `320–767`, M `768–1279`, L `>=1280` | Semua R1 web capability perlu baseline + boundary QA |
| Visual identity | Cream/espresso/amber + DM Sans + Fraunces terbatas | Operational Teal/Geist bukan lagi target visual |

## 3. Source-of-truth map

| Pertanyaan | Dokumen |
|---|---|
| Produk/module/integration/architecture scope | `../product/CAFE-COMPANION-PRD-V2-MODULAR-PLATFORM.md` |
| Capability Basic/Pro/Advanced | `../product/CAFE-COMPANION-MODULE-TIERS-V1.md` |
| Package/limit/add-on/enforcement | `../product/CAFE-COMPANION-PACKAGES-LIMITS-V1.md` |
| Technical boundary | `architecture.md` |
| Token/component/layout/responsive | `design-system.md` |
| Module -> screen/component/data guard | `design-system-modules.md` |
| Actual implementation gap | File audit ini setelah source diverifikasi |

## 4. Observed route snapshot — source 5 Agustus 2026

| Route | Status source | Evidence dan gap utama |
|---|---|---|
| `/` | `PARTIAL` | Device-mode shell dan navigasi ke POS/KDS/Catalog/Inventory tersedia, tetapi context masih tenant/outlet lama, navigation statis, dan belum entitlement/installation-aware. |
| `/design-system` | `PARTIAL` dev/reference | Reference hub tersedia, tetapi masih mendeskripsikan Calm Commerce/Operational Teal dan Geist, bukan Warm Operational/DM Sans/Fraunces terbaru. |
| `/color-bank` | `PARTIAL` dev/reference | Color bank light/dark tersedia, tetapi preset dan semantic target belum diselaraskan ke cream/espresso/amber. |
| `/typography` | `PARTIAL` dev/reference | Typography bank tersedia dengan Geist; migrasi ke DM Sans dan Fraunces terbatas belum dilakukan. |
| `/foundation` | `PARTIAL` dev/reference | Preview spacing/radius/shadow/icon tersedia; ini bukan source-of-truth dokumentasi dan belum menjadi responsive/component state lab terbaru. |
| `/backoffice/catalog` | `PARTIAL` business route | Login/session, workspace context, permission, API read/mutation, loading/empty/error, category/product/composition/outlet assignment tersedia. Masih memakai tenant/outlet terminology, shell/navigasi tunggal, dan belum membedakan entitlement, installation, feature flag, tier, serta limit state. |
| `/pos` | `PLACEHOLDER` | Hanya penjelasan surface, server acknowledgement, dan link navigasi; belum ada catalog/cart/order/payment/shift flow. |
| `/kds` | `PLACEHOLDER` | Hanya penjelasan read model/acknowledgement dan link; belum ada ticket queue, lifecycle, timer, reconnect, atau history. |
| `/inventory` | `PLACEHOLDER` | Hanya penjelasan mutation acknowledgement dan link; belum ada item, balance, movement, stocktake, waste, transfer, atau receiving flow. |
| Floor/Table, Finance, HC, Customer/Self-Order, Reports, Settings, Platform Admin | `NOT_STARTED` sebagai web route | Tidak ditemukan `page.tsx` aktif untuk surface tersebut pada source web saat audit. Component/domain/backend readiness harus dinilai terpisah dan tidak dianggap route complete. |

Kesimpulan implementasi: fondasi backend/API/security/reliability lebih maju daripada pengalaman UI. Checkpoint berikutnya harus menyelaraskan foundation visual dan shell/module state sebelum route business di-reslice.

## 5. Component bank readiness yang diwarisi

Komponen berikut sudah pernah tercatat tersedia/siap secara design/component bank. Re-audit harus memastikan API, token, dan behavior masih sesuai `design-system.md` terbaru.

| Area | Component/story yang pernah tercatat | Gap terbaru yang perlu dicek |
|---|---|---|
| POS | `PosCatalog`, `PosCart`, `PosModifierPicker`, `PosPayment`, `PosManualFlow`, `PosShift` | S/M/L + hold/resume + module/limit states |
| KDS | `KdsTicket` + timer/SLA/reconnect/history | Standalone intake + 1/2–3/multi-column behavior |
| Inventory | `InventoryItemUnit`, `InventoryStock`, `InventoryOperations`, `InventoryOrderFlow`, `RecipeBom` | Standalone + correction/limit states |
| Floor/QR | `FloorSelector`, `TableTile`, `TableLayoutCanvas`, `TableLayoutTools`, `TableLayoutTray`, `TableQr`, `CustomerQrContext` | AreaSelector, 3 shapes, chairs, session/move, live view/list fallback, tier gating |
| Finance | `FinanceMetric`, `FinanceBasicSummary`, `FinanceProfitEstimate`, `FinanceReconciliationSummary`, `FinanceValidatedReport` | Finance-only, tier states, S/M/L, estimate labeling |
| Customer | `CustomerBasicProfile`, `CustomerOrderSurface`, `CustomerQrContext` | safe public DTO + mobile flow + waiter/bill actions |
| Platform | `PlatformTenantSubscriptionMaster`, `PlatformEntitlementMatrix`, `PlatformSupportAudit` | workspace terminology + package version/installation/binding/usage state |
| HC | Belum tercatat pada audit lama | Component bank baru wajib dibuat untuk Employee/Schedule/Attendance/Leave |

## 6. Gap desain/arsitektur wajib saat re-audit

### 6.1 Workspace dan context

Periksa bahwa code baru tidak menambah ketergantungan ke hierarchy lama `Tenant -> Brand -> Outlet` sebagai domain invariant. Internal model target adalah `Workspace -> Business Unit -> Location`; label F&B tetap boleh Tenant/Brand/Outlet.

Acceptance:

- switch workspace membersihkan query/cache/realtime context;
- location scope tervalidasi backend;
- HC-only dapat memakai Company/Branch terminology;
- PERSONAL future tidak diwajibkan mempunyai Location.

### 6.2 Entitlement, tier, installation, dan limit

UI tidak boleh hanya memiliki boolean `moduleEnabled`.

Perlu state terpisah:

- entitlement/capability;
- permission;
- module installation/setup;
- feature flag/delivery availability;
- hard/soft limit;
- subscription lifecycle.

Responsive tidak pernah menjadi paywall.

### 6.3 Floor/Table

Basic acceptance minimum:

- `Main Floor/Main Area` default;
- user-defined Floor/Area;
- SQUARE/RECTANGLE/ROUND;
- capacity + derived chair visualization;
- visual size SMALL/MEDIUM/LARGE;
- snap-to-grid + 0/90 rotation;
- Edit Layout terpisah dari Live Table View;
- table session mempunyai identity sendiri;
- multiple order batch per session;
- move table mempertahankan order/bill/session;
- QR rotate/revoke tidak mengubah table identity;
- status AVAILABLE/OCCUPIED/CLOSING/CLEANING/INACTIVE;
- Pro merge/split tidak aktif pada Basic;
- reservation tidak aktif tanpa capability;
- Small menyediakan list fallback dan property edit tanpa precision drag.

### 6.4 Human Capital

HC Basic R1 perlu:

- Employee;
- Department/job;
- Schedule + publish;
- Web/manual attendance;
- Correction history;
- Leave request/approve/reject;
- Basic report.

Employee != User harus terlihat pada data model/UI. Mobile attendance/geofence/selfie bukan R1 Basic.

### 6.5 Business Finance

Finance harus usable tanpa POS. Basic menampilkan operational cashbook/reconciliation dan report estimasi. Budget/AP/AR/approval adalah Pro; journal/ledger/period close adalah Advanced/Future.

Audit harus mencari double-count risk antara `sale.completed` dan `payment.recorded` serta memastikan reversal tidak menghapus histori.

### 6.6 Standalone KDS/Inventory

- KDS-only harus mempunyai manual/API Lite intake path tanpa POS UI.
- Inventory-only harus mempunyai item master/ledger tanpa Catalog product wajib.
- Missing optional integration tidak boleh menghasilkan crash/generic empty state.

## 7. Responsive audit contract

Setiap route R1 diuji pada:

| Class | Baseline | Boundary |
|---|---:|---|
| Small | `390×844` | `320`, `767` |
| Medium | `1024×768` | `768`, `1279` |
| Large | `1440×900` | `1280` |

Gate:

- tidak ada accidental page-level horizontal overflow;
- primary task/action tidak hilang;
- table -> summary card/detail transformation mempertahankan data;
- modal panjang berubah sheet/full-screen bila perlu;
- touch target Floor/POS/KDS/Customer minimum 44×44 CSS px;
- keyboard/focus tetap valid pada management surface;
- resize tidak mereset cart/form/context;
- loading/empty/error/permission/not-entitled/setup-required/over-limit ikut diuji;
- light dan dark diuji pada S/M/L.

## 8. Visual alignment audit

Target baru:

- Warm Operational;
- cream/espresso/amber semantic palette;
- DM Sans untuk operational UI;
- Fraunces terbatas pada brand/storefront/display;
- semantic success/warning/info/destructive terpisah dari accent amber;
- light/dark/system;
- WCAG 2.2 AA;
- Lucide icon family;
- tidak ada raw feature color untuk mengganti semantic token.

Code/story yang masih memakai Operational Teal/Geist sebagai identitas utama harus dicatat sebagai migration gap, bukan dijadikan alasan mempertahankan theme lama.

## 9. Re-audit matrix per route

Gunakan status berikut:

- `NOT_STARTED`;
- `PLACEHOLDER`;
- `PARTIAL`;
- `FUNCTIONAL`;
- `ALIGNED`;
- `BLOCKED`.

Untuk setiap route/screen, isi:

| Field | Yang harus dicatat |
|---|---|
| Route | URL/path aktual |
| Module | Product module owner |
| Capability | Capability key/tier minimum |
| Delivery | R1/R1+/Future/External Gate |
| Shell | Backoffice/POS/KDS/Customer/Platform |
| State | Status audit |
| Data source | mock/repository/API/read model |
| Mutation | callback/mock/API + acknowledgement behavior |
| S/M/L | pass/fail per class |
| Light/Dark | pass/fail |
| Accessibility | keyboard/focus/label/target state |
| Privacy | DTO/field guard result |
| Tests | component/integration/E2E coverage |
| Blocker | technical/product/security issue |

## 10. Urutan implementasi yang disarankan setelah re-audit

Urutan mengikuti dependency risk, bukan jumlah component yang sudah ada:

1. Foundation convergence: warm tokens/fonts, S/M/L shell, ModuleAccessState, UsageLimitState.
2. Workspace/context/navigation + entitlement/installation/permission gate.
3. Catalog + POS Basic end-to-end.
4. KDS Basic + POS->KDS integration proof; KDS-only intake tetap valid.
5. Floor/Table Basic + QR + Live Table View + table session/move.
6. Customer/Self-Order public flow.
7. Inventory Basic standalone + optional consumption binding.
8. Business Finance Basic standalone + POS/Inventory binding.
9. HC Basic standalone.
10. Platform Admin package/limit/install/binding surfaces.
11. Reports/Analytics embedded Basic.
12. Cross-cutting security/reliability/accessibility/performance hardening.

Urutan delivery release tetap tunduk pada PRD induk; checkpoint UI boleh dipecah lebih kecil selama capability tidak dipresentasikan palsu sebagai complete.

## 11. Gate setiap redesign/implementation route

- Field inventory sebelum JSX: input, official read-only context, derived, hidden/sensitive.
- Gunakan shell + component dari `design-system.md`/`packages/ui` lebih dulu.
- Route mempunyai module/capability/delivery owner.
- Navigation mengikuti effective entitlement/installation/permission/context.
- Semua action visible dapat dijalankan atau clearly disabled dengan reason.
- Mutation final tidak optimistic-success sebelum server acknowledgement.
- Error response user-safe; tidak menampilkan stack/provider payload.
- Responsive S/M/L + boundary QA.
- Light/dark QA.
- Keyboard/focus/touch target QA.
- Cross-workspace isolation dan safe DTO diuji sesuai domain.
- Future/External Gate tidak dirender seolah production-ready.

## 12. Security/reliability checkpoint

Audit lama mencatat rate limit login/QR, CSRF/session/security header, dan audit critical action belum selesai pada snapshot. Status ini harus diverifikasi ulang, bukan diasumsikan selesai.

Tambahan checkpoint PRD terbaru:

- workspace isolation;
- idempotency mutation kritis;
- transactional outbox + consumer inbox/idempotency;
- integration binding retry/dead-letter state;
- module boundary lint;
- package snapshot immutability;
- hard/soft limit semantics;
- downgrade tidak menghapus histori;
- attendance correction append-only;
- Finance reversal/source-reference uniqueness;
- QR token hash/rotation privacy.

## 13. Definition of aligned route

Sebuah route hanya berstatus `ALIGNED` bila:

1. scope/capability sesuai tier/delivery;
2. shell/context/navigation benar;
3. data guard benar;
4. happy/loading/empty/error/permission/entitlement/setup/limit state ada sesuai relevansi;
5. mutation semantics dan acknowledgement benar;
6. S/M/L + boundary lulus;
7. light/dark lulus;
8. keyboard/focus/touch baseline lulus;
9. test relevan ada;
10. tidak membuat duplicate business logic untuk standalone vs integrated path.

---

Setelah file ini dipindahkan ke codebase, langkah pertama coding agent adalah **re-audit source aktual** menggunakan matrix di atas. Jangan menggunakan status route historis 3 Agustus sebagai bukti bahwa implementasi terbaru masih sama.
