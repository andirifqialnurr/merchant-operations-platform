# Design System — Breakdown per Modul

**Produk:** Cafe Companion Pro  
**Status:** Mapping UI module selaras PRD v2.3 / Module Tiers v1.2 / Packages & Limits v1.2  
**Tanggal:** 5 Agustus 2026  
**Visual source of truth:** `design-system.md`

Dokumen ini menghubungkan requirement product module dengan shell, screen, component, responsive behavior, tier gate, dan data guard. Dokumen ini **tidak** menentukan harga atau angka limit; angka efektif mengikuti `CAFE-COMPANION-PACKAGES-LIMITS-V1.md`.

## 0. Aturan global sebelum membaca modul

### 0.1 Urutan keputusan UI

```text
PRD product scope
-> Module tier/capability
-> Effective entitlement + installation + permission + limit
-> design-system.md
-> component bank
-> module screen
```

Package bukan fork UI. Cafe Digital, Cafe Operations, Cafe Growth, Finance Only, atau HC Only memilih capability/tier/limit dari codebase yang sama.

### 0.2 Module state bukan satu boolean

Screen/navigation harus membedakan:

- not entitled;
- entitled + provisioning;
- setup required;
- active;
- paused/error;
- permission denied;
- delivery/feature flag unavailable;
- hard/soft limit state;
- subscription suspended.

Operational navigation hanya menampilkan module installation yang aktif dan user dapat akses. Explore Modules dapat menampilkan locked/upgrade state.

### 0.3 Responsive contract

| Class | Width CSS | Baseline QA |
|---|---:|---:|
| Small (S) | `320–767px` | `390×844` |
| Medium (M) | `768–1279px` | `1024×768` |
| Large (L) | `>=1280px` | `1440×900` |

Responsive adalah baseline kualitas, bukan capability/add-on. Capability yang dimiliki user harus usable di S/M/L. Business logic/API/permission/audit/limit tidak berubah karena viewport.

### 0.4 Data guard global

Jangan render sebagai field editable atau payload umum:

- internal database ID;
- raw token/hash/session secret/API key;
- idempotency/correlation internals kecuali technical support surface yang memang berhak;
- provider raw payload;
- calculated official status/actor/audit timestamp sebagai editable input;
- HPP/profit pada POS/KDS/customer;
- payment/customer PII pada KDS;
- employee sensitive evidence di luar HC permission scope.

## 1. Core Platform — Workspace, Organization, dan Context

- **Availability:** selalu tersedia ketika subscription usable; bukan product module berbayar.
- **Shell:** Platform Admin + Business Backoffice sesuai role.
- **Screen:** Workspace switcher -> Business Unit -> Location -> profile/settings -> membership/outlet scope.
- **Component:** WorkspaceContext, LocationSwitcher, EntityHeader, DataTable, FormField, Empty/Error/Permission State.
- **Responsive:** L persistent sidebar/context; M collapsible rail; S drawer + current workspace/location tetap terlihat sebelum mutation.
- **Data guard:** satu workspace tidak pernah melihat candidate/resource workspace lain melalui search/filter.

Internal model: `Workspace -> Business Unit -> Location`. Template Cafe boleh melabeli sebagai Tenant/Brand/Outlet; HC-only dapat memakai Company/Branch. Label tidak mengubah schema atau authorization.

## 2. Identity, Membership, RBAC, dan Device

- **Availability:** Core.
- **Screen:** Users -> Invitations -> Membership -> Role & Permission -> Location Scope -> Devices/Sessions.
- **Component:** UserRow, RoleBadge, PermissionMatrix, ScopeSelector, DeviceStatus, SessionList, ConfirmationDialog.
- **Responsive:** complex permission table menjadi grouped sections pada S; destructive session/device action tetap reachable.
- **Data guard:** password hash, cookie, secret, device credential, raw session data tidak dirender.

User dan Employee adalah entity berbeda. HC screen hanya menampilkan linkage status; membership UI tidak mengubah employment record secara implisit.

## 3. Subscription, Package, Entitlement, Limit, dan Installation

- **Availability:** Core; merchant side read/upgrade sesuai policy, Platform Admin full management.
- **Screen:** Subscription summary -> module/tier list -> usage/limit -> installation/setup -> integration binding -> history.
- **Component:** SubscriptionStatus, EntitlementMatrix, ModuleAccessState, UsageLimitState, SetupChecklist, IntegrationStatus, AuditEvent.

UI wajib membedakan:

```text
package version
module tier
capability
add-on/override
effective limit + usage
installation
integration binding
permission
feature flag
```

Hard limit memblokir create/activate resource baru. Soft metered operational event tidak boleh diberi success=false hanya karena quota. Responsive S/M/L tidak pernah muncul sebagai entitlement/usage dimension.

## 4. Platform Admin

- **Availability:** Platform-only.
- **Shell:** Platform Admin.
- **Screen:** Workspace Registry -> Workspace Detail -> Package Builder -> Subscription -> Entitlement/Override -> Usage -> Installation -> Binding -> Support Access/Audit.
- **Component:** dense DataTable, FilterBar, WorkspaceContext, EntitlementMatrix, UsageLimitState, ModuleAccessState, AuditTimeline.
- **Responsive:** L dense table + drawer; M compact table/drawer; S row/card + filter sheet + full-screen detail.
- **Data guard:** support context reason/expiry selalu terlihat; raw secret/provider payload tidak dirender.

Published package version immutable. Editing published package membuat version baru, bukan mengubah snapshot customer lama.

## 5. Catalog, Profile, dan Menu

- **Tier:** Basic R1; Pro R1+; Advanced Future.
- **Shell:** Backoffice; public subset pada Customer surface.
- **Basic screen:** Categories -> Product list/grid -> Product form -> Variant/Modifier -> Location price/availability -> Public preview.
- **Pro UI:** bulk import/edit, scheduled availability, channel pricing, bundle/versioned recipe bridge sesuai capability.
- **Advanced UI:** pricing rule, approval/version governance bila delivery siap.
- **Component:** ProductTile, CategoryRail, ProductForm, ModifierPicker, MoneyDisplay, AvailabilityBadge, DataTable, FilterBar.
- **Responsive:** S cards/rows + full-screen edit; M compact grid/table + drawer; L grid/table + side panel.
- **Data guard:** Catalog menampilkan harga jual; HPP/cost tidak bocor dari Inventory/Finance tanpa permission/use case khusus.

Catalog standalone tidak memerlukan POS. Recipe bridge hanya muncul bila capability dan integration yang relevan tersedia.

## 6. POS & Sales

- **Tier:** Basic R1; Pro R1+; Advanced Future; integrated payment External Gate.
- **Shell:** POS.
- **Basic screen:** Catalog -> Cart -> order type/table context -> modifier/note -> hold/resume -> payment -> receipt -> shift open/close -> refund record.
- **Pro UI:** split bill/partial payment, richer approval, blind close, webhook/connector sesuai capability.
- **Advanced UI:** central policy/offline advanced/custom payment orchestration hanya ketika delivered.
- **Component:** ProductTile, CategoryRail, CartItem, CartSummary, PaymentMethodTile, CashKeypad, PaymentConfirmationPanel, OrderCard, ShiftSummary.
- **Responsive:** L catalog + persistent cart; M compact split/collapsible cart; S catalog primary + sticky cart summary/sheet/page checkout.
- **Data guard:** cost/HPP/profit, provider raw payload, internal IDs tidak tampil.

Hold order tidak boleh masuk KDS sebagai submitted production work sampai benar-benar disubmit. Resume wajib mempunyai explicit retrieval path.

## 7. Floor, Table, dan Self-Order

- **Tier:** Basic R1; Pro R1+; Advanced Future.
- **Shell staff:** Backoffice untuk Edit Layout, POS/operations untuk Live Table View.
- **Shell customer:** Customer/Self-Order.

### 7.1 Struktur

```text
Location
-> Floor
-> Area
-> Table
-> Table Session
-> one or more Order batches
```

Location baru menggunakan `Main Floor` + `Main Area`. Indoor, Outdoor, Smoking, VIP, Garden, Terrace, Bar, dan sejenisnya adalah nama Area user-defined.

### 7.2 Basic

Basic wajib mencakup:

- Floor/Area manage;
- table shape `SQUARE`, `RECTANGLE`, `ROUND`;
- capacity + auto chair visualization;
- visual size `SMALL`, `MEDIUM`, `LARGE`;
- snap-to-grid;
- rotation `0/90`;
- active/inactive;
- Edit Layout;
- Live Table View;
- table session + guest count + multiple order batch;
- move table tanpa membuat ulang order/bill;
- QR generate/print/download/rotate/revoke;
- customer menu/cart/note/reorder;
- waiter call/request bill;
- payment claim `VERIFYING` yang tetap dikonfirmasi kasir.

### 7.3 Pro dan Advanced

- Pro: merge/split beberapa meja dalam satu session, service zone, richer resizing/bulk layout, group order/auto-accept sesuai capability.
- Advanced/Future: reservation/waitlist-aware optimization, complex venue editor/background plan/free rotation/custom shape.

Capacity/table count/floor/area limit berasal dari package; membeli Table Pack menambah capacity tetapi **tidak** membuka merge/split.

### 7.4 Screen dan component

- **Edit Layout:** FloorSelector, AreaSelector, TableLayoutCanvas, TableLayoutToolbar, TablePropertyPanel, UnplacedTableTray.
- **Live:** Floor/Area/status filter, LiveTableView, TableTile, TableSessionPanel.
- **QR:** QRTableCard.
- **Customer:** MerchantHeader, CustomerProductCard, ProductModifierPicker, StickyCartBar, OrderProgress, Waiter/Bill action.

Status Basic: `AVAILABLE`, `OCCUPIED`, `CLOSING`, `CLEANING`, `INACTIVE`. `RESERVED` hanya jika capability reservation aktif.

### 7.5 Responsive

| Mode | Small | Medium | Large |
|---|---|---|---|
| Live Table | Pannable view + list fallback | Touch pan/zoom + collapsible detail | Full canvas + docked context |
| Edit Layout | Simplified edit via sheet/form; precision drag tidak wajib | Touch canvas + collapsible property | Canvas + palette + persistent property |

Move Table pada S memakai source/destination selection. Status/action tidak bergantung pada fill warna tile.

### 7.6 Data guard

- Drag layout hanya mengubah visual coordinates; tidak memindahkan table session.
- Customer tidak menerima grid coordinate, internal table/session ID, atau raw QR token.
- QR melekat pada Table, bukan Session.
- Closed session history tidak ditimpa saat meja digunakan kembali.

## 8. Kitchen Display System

- **Tier:** Basic R1; Pro R1+; Advanced Future.
- **Shell:** KDS Kiosk.
- **Standalone:** valid melalui manual/API Lite intake; tidak memerlukan POS.
- **Basic screen:** Queue -> Ticket -> Accept/Start/Ready/Served/Complete -> History -> Connection state.
- **Pro UI:** multi-station/routing, item-level status, SLA, expo/fallback print sesuai capability.
- **Advanced UI:** course/firing/dynamic routing future.
- **Component:** KitchenTicket, KdsTimer, StatusBadge, NetworkSyncIndicator, history/filter drawer.
- **Responsive:** S 1-column prioritized queue; M 2–3 column tipikal; L adaptive multi-column.
- **Data guard:** tidak mengirim price, HPP, payment, customer phone, raw token, atau audit payload.

Semua source memakai CreateKitchenTicket use case yang sama; source label hanya metadata.

## 9. Inventory

- **Tier:** Basic R1; Pro R1+; Advanced Future.
- **Standalone:** valid; inventory item tidak harus Catalog product.
- **Basic screen:** Item -> Stock balance -> Movement -> Adjustment -> Stocktake -> Waste -> Transfer -> Supplier/Purchase/Receiving -> Recipe/BOM -> Low Stock.
- **Pro UI:** approval, richer warehouse/purchasing/cost controls menurut capability.
- **Advanced:** batch/expiry/forecast/central kitchen/cost policy future.
- **Component:** StockIndicator, MovementRow, MovementTypeBadge, InventoryItemPicker, StockAdjustmentForm, StocktakeTable, RecipeBomEditor.
- **Responsive:** S cards + single-column mutation; M compact table/cards; L dense table/list.
- **Data guard:** posted movement tidak diedit/hapus; correction membuat reversal/adjustment. Calculated balance/cost bukan editable field.

## 10. Business Finance

- **Standalone:** valid.
- **Finance Core:** internal kernel, bukan menu.

### 10.1 Basic — R1

Fokus: operational cashbook, bukan accounting formal.

- accounts sederhana;
- income/expense/transfer;
- source dari POS bila binding aktif;
- manual reconciliation cash/QRIS/transfer/EDC;
- shift/payment summary;
- HPP/gross/operating profit estimate bila data tersedia;
- report per location + consolidated.

Semua HPP/profit Basic diberi label `Estimasi operasional` dan data freshness bila relevan.

### 10.2 Pro — R1+/Future menurut roadmap

- recurring transaction;
- budget/variance;
- AP/AR ringan;
- approval;
- reconciliation import;
- managerial report/cost center.

### 10.3 Advanced — Future

- chart of accounts;
- journal/ledger;
- period close;
- accounting report;
- asset/multi-currency/custom integration.

Advanced tidak boleh dipresentasikan sebagai accounting-compliant sebelum product/legal/professional review selesai.

### 10.4 Screen/component/responsive

- **Screen:** Finance Overview -> Cashbook -> Income/Expense/Transfer -> Reconciliation -> Report.
- **Component:** FinanceMetric, LedgerRow, ReconciliationSummary, ShiftSummary, FinancialReportTable, FilterBar, Chart wrapper.
- **S:** KPI stack + transaction cards + 1-column form.
- **M:** KPI 2-column + compact transaction table/list.
- **L:** KPI/report multi-column + transaction table.
- **Data guard:** POS/KDS/customer tidak melihat HPP/profit; reversal membuat record baru dan source trace tetap visible.

## 11. Human Capital

- **Standalone:** valid tanpa Catalog/POS/KDS/Inventory/Finance.
- **Employee != User:** linkage account adalah state terpisah.

### 11.1 Basic — R1 simple

- employee master;
- department/job;
- business unit/location assignment;
- shift template;
- weekly schedule + publish;
- web/manual attendance;
- attendance correction dengan audit;
- leave type/request/approve/reject;
- basic report.

### 11.2 Pro — Future awal

- employee import/document;
- mobile attendance;
- geofence;
- selfie evidence;
- device trust;
- timesheet approval;
- accrual/multi-level approval;
- workforce report.

### 11.3 Advanced — Future

- payroll;
- recruitment;
- performance;
- training;
- biometric connector;
- roster optimization;
- SSO/SCIM enterprise.

### 11.4 Screen/component/responsive

- **Screen:** HC Overview -> Employees -> Employee Detail -> Schedule -> Attendance -> Leave -> Reports.
- **Component:** EmployeeRow/Card, EmployeeDetailHeader, ScheduleCalendar/Agenda, AttendanceEventRow, AttendanceRecordCard, LeaveRequest, StatusBadge, Timeline.
- **S:** employee/attendance cards + mobile agenda + full-screen detail/edit.
- **M:** compact table/calendar + drawer.
- **L:** table/calendar + detail panel.
- **Data guard:** attendance evidence/employee PII hanya untuk permission yang memerlukan; correction append-only; GPS/selfie adalah evidence, bukan value yang user edit.

Mobile HC adalah future client pada backend yang sama. Entitlement saja tidak membuat mobile attendance aktif sebelum installation, privacy/security, dan client readiness terpenuhi.

## 12. Customer Basic / CRM

- **Basic R1 simple:** optional name/phone/note, transaction history projection, visit/spend summary.
- **Pro Future:** merge/dedup, consent preference, segment, loyalty/voucher/basic feedback.
- **Advanced Future:** campaign automation, identity resolution, advanced analytics.
- **Shell:** Backoffice; safe order-status projection pada Customer surface.
- **Component:** CustomerRow, DetailDrawer, Timeline, ConsentState future.
- **Responsive:** S cards/detail full-screen; M compact table/drawer; L table + detail.
- **Data guard:** phone/contact tidak pernah dikirim ke KDS; workspace isolation wajib.

## 13. Reports & Analytics

Basic report milik setiap module tetap termasuk pada tier module. Analytics terpisah hanya untuk cross-module/custom distribution.

- **Embedded Basic:** screen report dasar per module, date/location/status filter, manual export terbatas.
- **Pro Analytics:** cross-module dashboard, configurable widget, compare location/period, scheduled export.
- **Advanced Analytics Future:** custom metric/dashboard, warehouse/BI export, bulk API.
- **Component:** MetricCard, ChartWrapper, DataTable, FilterBar, FreshnessIndicator, ExportState.
- **Responsive:** S single-column; M 2-column/stack; L multi-card/chart grid.
- **Data guard:** report tidak memperoleh field yang user tidak berhak lihat hanya karena data tersedia pada projection.

## 14. Integration/API

Integration bukan module tier universal. Internal binding yang resmi dapat included; External API atau Custom Integration dapat menjadi add-on/capability.

- **Screen:** Integration list -> Setup/Mapping -> Test -> Delivery/Retry log -> API Client/Webhook management.
- **Component:** IntegrationStatus, SetupChecklist, masked CredentialState, DeliveryTimeline, UsageLimitState.
- **Data guard:** credential full hanya boleh tampil sekali saat provisioning jika policy mengizinkan; setelah itu masked. Raw signed payload tidak masuk general UI.
- **Responsive:** mapping/form tetap usable S/M/L; large log table berubah summary cards/detail pada S.

Internal module binding tidak meminta user permission tambahan hanya agar event berjalan; handler memakai installation/entitlement/binding/service identity yang benar.

## 15. Device, Printer, dan PWA

- **Availability:** Core/device support; printer capability mengikuti surface/module.
- **Device mode:** BACKOFFICE, POS, KDS, INVENTORY; MOBILE_HC/MOBILE_PERSONAL_FINANCE future; API_CLIENT.
- **Screen:** Device list -> activate/revoke -> printer test -> connectivity.
- **Component:** DeviceStatusBadge, NetworkSyncIndicator, PrinterCard, StaleDataBanner.
- **Data guard:** device secret tidak pernah ditampilkan kembali setelah provisioning.

R1 online-first. Cache dapat menyimpan shell/last-known menu/safe draft; final payment/stock/finance/approval mutation memerlukan server acknowledgement.

## 16. Audit, Idempotency, Security, dan Support

- **Availability:** Core.
- **Screen merchant:** safe audit/history sesuai permission.
- **Screen platform:** support access log, audit, retry/dead-letter operational view.
- **Component:** AuditEvent, Timeline, ReadOnlyDescriptionList, Error/Retry state.
- **Data guard:** before/after summary disanitasi; secret, raw provider payload, evidence image content, dan sensitive PII tidak disalin ke audit row.

UI tidak boleh membuat retry terlihat seperti action baru yang dapat menggandakan transaksi. Duplicate idempotent result dijelaskan sebagai current state, bukan error generik.

## 17. Personal Finance — Future Product

- **Workspace:** `PERSONAL` saja.
- **Status:** Finance Core foundation now; product UI future.
- **Basic illustrative:** account, income/expense/transfer, simple budget/goal, cashflow/spending.
- **Pro/Advanced illustrative:** recurring/import, household/connector/net-worth/scenario sesuai future PRD.
- **Client:** mobile-first future; bukan tab di Backoffice F&B.
- **Data guard:** Business membership tidak memberi akses Personal workspace; account adalah record keeping, bukan stored-value wallet.

Jangan membangun production flow hanya karena Finance Core sudah ada.

## 18. Integrated Payment — External Gate

- **Status:** Future/external gate.
- **Current R1:** Cash + merchant QRIS/transfer/EDC manual + verification kasir.
- **Future UI:** provider setup, KYC, dynamic payment status, settlement, dispute/refund setelah legal/PJP/security siap.
- **Data guard:** API key, webhook secret, signature, raw settlement/provider payload tidak dirender pada business UI.

Customer action `Sudah Bayar` hanya menjadi `VERIFYING`; `PAID` hanya setelah backend/kasir/provider resmi mengonfirmasi sesuai flow.

## 19. Future capability families

Berikut tidak dianggap active R1 hanya karena component concept ada:

- Promotion/Pricing engine;
- Customer CRM/Loyalty advanced;
- Inventory batch/expiry/forecast/central kitchen;
- Finance accounting advanced;
- Payroll/talent/recruitment;
- Notifications/campaign connector;
- Marketplace/delivery;
- Reservation/waitlist;
- Franchise/multi-brand governance advanced;
- complex building floor-plan editor.

Future capability dapat memiliki locked/roadmap state. Jangan menyediakan production mutation/API palsu.

## 20. Package examples — hanya untuk composition reference

Paket tidak menentukan komponen secara langsung; ia memilih module tier dan limit.

| Package | Module composition utama |
|---|---|
| Profile | Catalog/Profile Basic terbatas |
| POS Basic | Catalog Basic + POS Basic |
| Cafe Digital | POS Basic + Floor/Self-Order Basic + KDS Basic + customer context |
| Cafe Operations | Cafe Digital + Inventory Basic + Business Finance Basic + Customer Basic |
| Cafe Growth | Pro pada modul operasional utama + Pro Analytics sesuai delivery |
| Enterprise | Custom snapshot dari capability yang benar-benar available |
| HC Only | HC tier terpilih + Core |
| Finance Only | Business Finance tier terpilih + Finance Core |
| KDS Only | KDS tier + Order Intake Lite/manual/API sesuai entitlement |

Responsive S/M/L selalu included ketika capability web terkait tersedia. Limit floor/user/device/transaction/employee berasal dari package/standalone/add-on effective state dan tidak diduplikasi di file ini.

## 21. Checklist coding per module

Sebelum membuat atau mengubah route:

1. Tentukan product module dan tier/capability yang sedang diimplementasi.
2. Tentukan status delivery: R1, R1+, Future, atau External Gate.
3. Gunakan `design-system.md` untuk token/component/layout; jangan membuat warna/size/radius sendiri.
4. Tentukan shell, workspace/location context, permission, dan installation state.
5. Buat field inventory: user input, read-only official context, derived display, hidden/sensitive.
6. Gunakan component bank sebelum membuat markup domain baru.
7. Rancang happy/loading/empty/error/offline/permission/not-entitled/setup-required/over-limit state.
8. Pastikan primary flow usable di S/M/L; test baseline + boundary.
9. Pastikan light/dark dan focus/keyboard/touch behavior sesuai surface.
10. Jangan menganggap hidden UI sebagai authorization.
11. Jangan hardcode package name untuk business rule yang seharusnya capability/limit.
12. Mutation final menunggu server acknowledgement dan mengikuti reversal/correction contract.

## 22. Source of truth

Jika terjadi konflik:

1. `CAFE-COMPANION-PRD-V2-MODULAR-PLATFORM.md` mengatur product/architecture scope.
2. `CAFE-COMPANION-MODULE-TIERS-V1.md` mengatur capability per Basic/Pro/Advanced.
3. `CAFE-COMPANION-PACKAGES-LIMITS-V1.md` mengatur package, limit, add-on, usage, enforcement.
4. `architecture.md` mengatur technical boundaries.
5. `design-system.md` mengatur visual/interaction contract.
6. File ini memetakan requirement tersebut ke modul/screen/component.
7. `DESIGN_SYSTEM_APP_AUDIT.md` hanya menyatakan implementation gap; audit tidak boleh menurunkan requirement.

---

Dokumen ini sengaja menjaga UI tetap modular: package berbeda mengubah **apa yang ter-entitle dan berapa limitnya**, bukan membuat versi screen, data model, atau business logic terpisah untuk setiap customer.
