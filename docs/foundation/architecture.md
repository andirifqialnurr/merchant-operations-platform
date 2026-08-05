# Architecture — Cafe Companion Pro Modular Business Platform

**Status:** Architecture baseline selaras PRD v2.3  
**Tanggal:** 5 Agustus 2026  
**Produk:** Cafe Companion Pro  
**Arsitektur:** TypeScript modular monolith, multi-workspace, PostgreSQL, online-first web/PWA  
**Sumber requirement:** `CAFE-COMPANION-PRD-V2-MODULAR-PLATFORM.md` v2.3, `CAFE-COMPANION-MODULE-TIERS-V1.md` v1.2, `CAFE-COMPANION-PACKAGES-LIMITS-V1.md` v1.2

## 1. Tujuan dokumen

Dokumen ini adalah kontrak teknis utama untuk implementasi Cafe Companion Pro. Ia menerjemahkan keputusan produk terbaru menjadi batas arsitektur yang dapat dipakai coding agent dan engineer tanpa membuat interpretasi baru per modul.

Jika dokumen ini bertentangan dengan tiga PRD sumber di atas, PRD terbaru berlaku untuk **scope/capability/limit**, sedangkan perubahan teknis harus dicatat sebagai architecture decision dan diselaraskan kembali ke dokumen ini.

Tujuan utamanya:

- satu codebase dapat melayani paket F&B dan module-only;
- satu product module dapat berjalan standalone maupun terintegrasi tanpa business logic kedua;
- aktivasi modul tidak membutuhkan fork/deploy/schema khusus workspace;
- backend yang sama dapat melayani web, POS, KDS, API, dan future mobile;
- data, permission, audit, entitlement, dan limit tidak tercampur;
- sistem tetap sederhana sebagai modular monolith pada Release 1.

## 2. Scope arsitektur Release 1

Release 1 harus mampu mendukung secara arsitektural:

```text
Core Platform
├── Workspace / membership / permission
├── Subscription / entitlement / limit
├── Module installation / configuration
├── Integration binding
├── Device / audit / idempotency
└── Event bus + outbox/inbox

Product modules
├── Catalog / Profile
├── POS & Sales
├── Floor / Table / Self-Order
├── KDS
├── Inventory
├── Business Finance
├── Human Capital
├── Customer Basic
└── Reports / Analytics
```

Fondasi sekarang tetapi UI produk belum wajib R1:

- workspace `PERSONAL`;
- Finance Core yang dapat dipakai Personal Finance;
- device/channel metadata untuk mobile HC dan Personal Finance;
- offline-safe idempotency foundation.

Tidak termasuk Release 1:

- microservices;
- Kafka/RabbitMQ;
- database per module/workspace;
- native mobile production;
- full offline mutation/sync;
- payroll lengkap;
- accounting formal lengkap;
- bank feed;
- integrated payment production;
- wallet/stored value;
- editor denah bangunan lengkap.

## 3. Model organisasi dan istilah

### 3.1 Hierarki internal

```text
Platform
└── Workspace
    ├── Business Unit
    │   └── Location
    ├── Membership
    ├── Subscription
    ├── Module Installation
    └── Integration Binding
```

Istilah internal harus cukup generik untuk HC-only, Finance-only, dan future Personal Finance.

| Internal | UI Cafe/F&B | UI HC-only | Catatan |
|---|---|---|---|
| Workspace | Tenant / Bisnis | Company | Batas data + subscription |
| Business Unit | Brand | Company/Unit | Opsional menurut template |
| Location | Outlet | Branch | Scope operasi |
| Membership | Staff access | User access | Identitas login bukan employee |

`tenant_id` pada implementasi lama boleh dipertahankan selama migrasi, tetapi secara konseptual diperlakukan sebagai `workspace_id`. Code baru tidak boleh memperluas ketergantungan pada terminology F&B di Core.

### 3.2 Workspace type

| Type | Status | Aturan |
|---|---|---|
| `BUSINESS` | R1 | Mendukung F&B, HC-only, Finance-only, dan bisnis lain |
| `PERSONAL` | Foundation now | Tidak mewajibkan Business Unit/Location; UI Personal Finance future |

Satu user dapat menjadi anggota beberapa workspace. Akses satu workspace tidak pernah memberikan akses workspace lain.

### 3.3 User tidak sama dengan employee

`core_users` adalah identity global. `hc_employees` adalah record kepegawaian di workspace.

- Employee dapat ada tanpa login.
- `employee.user_id` nullable.
- Menonaktifkan employee tidak menghapus global user.
- User dapat memiliki membership bisnis dan workspace personal secara bersamaan tanpa data sharing implisit.

## 4. Prinsip arsitektur wajib

1. Satu modular monolith backend pada Release 1.
2. Satu PostgreSQL database/cluster dapat melayani seluruh modul.
3. `workspace_id` adalah batas keamanan utama; `location_id` adalah scope operasional bila relevan.
4. Product module memiliki data, use case, repository, permission, manifest, dan event contract sendiri.
5. Modul hanya menulis tabel yang dimilikinya.
6. Query lintas modul menggunakan public facade/read model; reaction setelah commit menggunakan event.
7. Banyak adapter boleh masuk ke satu modul, tetapi satu aksi bisnis memiliki satu application use case.
8. Entitlement, permission, feature flag, installation, integration binding, limit, dan usage adalah konsep berbeda.
9. Paket adalah konfigurasi/snapshot; tidak pernah membuat fork codebase.
10. Aktivasi modul tidak membuat atau menghapus tabel.
11. Mutation final menggunakan reversal/correction, bukan delete histori.
12. Cross-module event bersifat at-least-once secara delivery; consumer wajib idempotent.
13. REST/database adalah source of truth; realtime adalah distribusi update.
14. Money tidak memakai floating point.
15. Waktu disimpan UTC; timezone IANA berada pada workspace/location.
16. Security enforcement berada di backend; hidden UI bukan authorization.

## 5. Tech stack baseline

Stack ini adalah baseline implementasi. Upgrade dependency harus mengikuti compatibility test dan migration review.

| Area | Baseline |
|---|---|
| Bahasa | TypeScript |
| Runtime | Node.js |
| Frontend | Next.js App Router + React |
| Backend | NestJS modular monolith |
| API | REST JSON + OpenAPI |
| Database | PostgreSQL |
| ORM/migration | Prisma ORM + reviewed SQL migration untuk constraint/index khusus |
| Realtime | WebSocket/Socket.IO |
| Queue/job | Redis + BullMQ bila dibutuhkan |
| Object storage | S3-compatible |
| UI | Tailwind CSS + shared component library |
| Drag/drop Floor | dnd-kit family; logical grid tetap source of truth |
| Server state | TanStack Query |
| Local UI state | Zustand secukupnya |
| Form/validation | React Hook Form + Zod |
| Monorepo | pnpm workspace + Turborepo |
| Testing | Unit + PostgreSQL integration + Playwright |
| CI/CD | GitHub Actions atau pipeline setara |

Versi dependency dipin melalui lockfile. Detail library bukan bagian kontrak domain dan dapat diganti tanpa mengubah PRD selama behavior tetap sama.

## 6. Topologi aplikasi

```text
Platform Admin Web ─┐
Merchant Backoffice ├── REST / WebSocket ──> Modular Monolith API
POS Web/PWA ────────┤                           │
KDS Web/PWA ────────┤                           ├── PostgreSQL
Customer Web ───────┘                           ├── Redis/Jobs
                                                ├── Object Storage
Future HC Mobile ───────── REST/API ────────────┤
Future Personal Mobile ─── REST/API ────────────┘
```

R1 boleh mengemas lima web surface dalam satu Next.js deployment dengan route group terpisah. Pemisahan frontend menjadi deployment terpisah bukan syarat modularitas. Backend domain contract tidak boleh bergantung pada struktur route React.

Deployment minimum:

- `web`: seluruh web surface R1 atau beberapa web app dari monorepo yang sama;
- `api`: NestJS HTTP + WebSocket;
- `worker`: outbox/job processor, dapat menjadi process type dari codebase yang sama;
- `postgres`;
- `redis` bila queue/realtime fan-out memerlukannya;
- object storage.

Tidak ada network call antarmodul internal di dalam monolith.

## 7. Struktur codebase

Struktur referensi:

```text
apps/
  web/
    app/
      (platform)/
      (backoffice)/
      (pos)/
      (kds)/
      (customer)/
  api/
  worker/
  hc-mobile/                  # future
  personal-finance-mobile/    # future

packages/
  database/
  contracts/
  domain-events/
  ui/
  config/

backend/ or apps/api/src/
  core/
    auth/
    workspaces/
    memberships/
    permissions/
    subscriptions/
    entitlements/
    installations/
    integrations/
    metering/
    devices/
    audit/
    idempotency/
    event-bus/
    outbox/
  kernels/
    catalog/
    order-intake/
    billing-payment-ledger/
    finance-core/
    reporting-projection/
  modules/
    catalog-profile/
    pos-sales/
    floor-self-order/
    kds/
    inventory/
    business-finance/
    human-capital/
    customer-basic/
    analytics/
    personal-finance/         # future product
```

Setiap modul mengikuti pola:

```text
module/
├── domain/
├── application/
│   ├── commands/
│   ├── queries/
│   ├── ports/
│   └── dto/
├── adapters/
│   ├── http/
│   ├── events/
│   ├── integrations/
│   └── persistence/
├── manifest.ts
└── public.ts
```

Import rules:

- modul boleh mengimpor Core/Shared dan `public.ts` modul yang diizinkan;
- dilarang mengimpor persistence/repository/domain internal modul lain;
- circular module dependency ditolak;
- `shared` tidak menjadi tempat business logic lintas domain;
- boundary diuji/lint di CI.

## 8. Core Platform, kernel, dan product module

### 8.1 Core Platform — selalu tersedia

- Auth/session.
- Workspace dan membership.
- Permission/RBAC dan location scope.
- Subscription/entitlement.
- Package snapshot dan limit/usage.
- Module installation/configuration.
- Integration binding.
- Device registry.
- Audit/idempotency.
- Feature flag.
- Outbox/inbox/event bus.

Core Platform bukan checkbox komersial.

### 8.2 Internal kernel — otomatis

Kernel mendukung product module tetapi tidak dijual sebagai menu:

- Catalog Kernel.
- Order Intake Kernel.
- Billing/Payment Ledger Kernel.
- Finance Core.
- Reporting Projection Kernel.

Kernel boleh diaktifkan otomatis karena dependency tanpa menambah navigation merchant.

### 8.3 Product module

- Catalog/Profile.
- POS & Sales.
- Floor/Table/Self-Order.
- KDS.
- Inventory.
- Business Finance.
- Human Capital.
- Customer Basic/CRM.
- Analytics.
- Personal Finance future.

Setiap product module memiliki tier `Basic`, `Pro`, `Advanced`. Tier menentukan **capability**; package/add-on/override menentukan **effective limit**.

## 9. Package, tier, entitlement, installation, dan limit

Konsep tidak boleh disatukan menjadi satu boolean `moduleEnabled`.

```text
Package version
  -> module tier + included capability + default limit
  -> entitlement snapshot
  -> module installation
  -> optional integration binding
  -> effective permission per user
```

### 9.1 Paket standar

Baseline komersial:

- Profile.
- POS Basic.
- Cafe Digital.
- Cafe Operations.
- Cafe Growth.
- Enterprise.
- Catalog Only / POS Only / KDS Only / Inventory Only / Finance Only / HC Only / Customer Only.
- Personal Finance future.

Angka limit tidak diduplikasi sebagai konstanta di code feature. Gunakan dimension catalog dan package version dari spesifikasi package/limit.

### 9.2 Effective access

Syarat mutation fitur:

```text
workspace usable
AND installation active/setup-valid
AND entitlement capability active
AND user permission granted
AND scope location valid
AND feature flag allows rollout
AND contextual policy valid
```

Limit dievaluasi setelah capability. Hard count limit memblokir resource baru; soft metered event operasional tetap diterima dan dimeter.

### 9.3 Installation lifecycle

```text
NOT_INSTALLED -> PROVISIONING -> SETUP_REQUIRED -> ACTIVE
                     |              |              |
                     +-----------> ERROR <---------+
                                      ^
                                      |
                                  SUSPENDED
```

- Provisioning idempotent.
- Tidak ada schema migration per workspace.
- Uninstall/suspend tidak menghapus data.
- Re-activation memakai data dan installation lama setelah compatibility check.

### 9.4 Integration binding lifecycle

Binding minimum: `DRAFT`, `SETUP_REQUIRED`, `ACTIVE`, `PAUSED`, `ERROR`, `DISABLED`.

Binding menyimpan source module, event+version, target module, handler, mapping config, effective time, status, dan audit metadata.

## 10. Standalone dan integrasi

Validasi minimum:

| Kombinasi | Behavior |
|---|---|
| POS only | Sale/payment/shift lengkap; event tanpa consumer aman |
| POS + KDS | `order.submitted` membuat ticket idempotently |
| POS + Finance | Sale/payment event dipetakan ke Finance bila binding aktif |
| POS + Inventory | Consumption mengikuti binding/deduction point |
| KDS only | Manual/API Lite intake memakai use case KDS yang sama |
| Inventory only | Item/ledger/purchasing sederhana tidak membutuhkan Catalog |
| Finance only | Income/expense/cashbook/reconciliation tidak membutuhkan POS |
| HC only | Tidak menampilkan istilah F&B; Core + HC saja |
| Personal Finance future | Hanya workspace PERSONAL; Finance Core shared, experience terpisah |

Menambahkan modul tidak melakukan backfill otomatis. Backfill historis, bila kelak ada, adalah command eksplisit dengan preview, date range, audit, dan idempotency.

## 11. Module manifest

Setiap product module mendaftarkan manifest versioned:

```ts
interface ModuleManifest {
  key: string;
  version: string;
  displayName: string;
  supportedWorkspaceTypes: Array<"BUSINESS" | "PERSONAL">;
  internalDependencies: string[];
  capabilities: string[];
  permissions: string[];
  routes: RouteRegistration[];
  navigation: NavigationRegistration[];
  settings: SettingRegistration[];
  eventsProduced: string[];
  eventHandlers: EventHandlerRegistration[];
  installSteps: InstallStep[];
  configSchemaVersion: number;
}
```

Manifest dipakai dependency resolver, provisioning, navigation, route guard, permission catalog, Package Builder, settings registry, handler registration, dan health page. Tidak ada configuration customer-specific dalam source manifest.

## 12. Authorization dan context

### 12.1 Role default

Role F&B minimum:

- Owner.
- Manager.
- Cashier.
- Kitchen.
- Waiter.
- Inventory Staff.
- Finance Staff.

HC menambahkan:

- HR Admin.
- Employee.

Custom role adalah kumpulan permission. Permission memakai use-case key, misalnya:

```text
pos.order.create
floor.table.manage
floor.layout.manage
floor.table_session.move
kds.ticket.manage
inventory.adjustment.record
business_finance.expense.record
hc.attendance.correct
hc.leave.approve
```

### 12.2 Aturan context

- Workspace context selalu diverifikasi server.
- Location dari header/path bukan bukti permission.
- Consolidated view tidak otomatis memberi mutation lintas location.
- Platform session terpisah dari merchant session.
- Support access memiliki reason, scope, expiry, dan audit.
- Integration worker memakai service identity/capability, bukan role user palsu.

## 13. Command context dan banyak adapter satu use case

Semua source mutation membawa metadata seragam:

```ts
interface CommandContext {
  workspaceId: string;
  actorId?: string;
  actorType: "USER" | "DEVICE" | "SYSTEM" | "INTEGRATION";
  channel: "WEB" | "MOBILE" | "POS" | "KDS" | "API" | "IMPORT";
  deviceId?: string;
  idempotencyKey: string;
  correlationId: string;
  causationId?: string;
  occurredAt: string;
  receivedAt: string;
  clientVersion?: string;
}
```

Adapter hanya menangani transport/auth/parsing/mapping. Business validation berada pada use case/domain. Manual controller, internal event handler, external API, dan future mobile tidak boleh membuat logic bisnis paralel.

## 14. Komunikasi antarmodul

### 14.1 Synchronous facade

Gunakan bila caller membutuhkan jawaban sebelum melanjutkan, misalnya:

- POS mengecek sellability dari Catalog;
- HC membaca timezone location dari Core;
- Package Builder memvalidasi dependency;
- POS mengecek stock policy hanya bila policy workspace memang blocking.

Facade mengekspos DTO/contract kecil dan tidak mengekspos ORM entity/repository.

### 14.2 Event after commit

Gunakan bila consumer bereaksi setelah source sukses:

- Order -> KDS.
- Sale/Payment -> Finance.
- Production/Sale -> Inventory.
- KDS ready -> Order/Customer projection.
- Attendance approved -> payroll future/report.

Dilarang:

- POS menulis tabel KDS/Finance/Inventory;
- KDS mengubah order persistence langsung;
- HC menulis Finance untuk payroll;
- ORM join lintas module untuk mutation bisnis.

## 15. Event envelope, outbox, inbox, retry

### 15.1 Event envelope

```ts
interface DomainEvent<T> {
  eventId: string;
  eventType: string;
  eventVersion: number;
  occurredAt: string;
  recordedAt: string;
  workspaceId: string;
  businessUnitId?: string;
  locationId?: string;
  producer: string;
  correlationId: string;
  causationId?: string;
  actor?: { type: "USER" | "DEVICE" | "SYSTEM" | "INTEGRATION"; id?: string };
  payload: T;
}
```

Payload adalah contract, bukan serialized database entity. Secret, token, raw provider payload, dan PII yang tidak dibutuhkan dilarang.

### 15.2 Transactional outbox

Source transaction dan event disimpan atomik:

```text
BEGIN
  save source aggregate
  append outbox event
COMMIT
```

Dispatcher memproses setelah commit. Kegagalan consumer tidak membatalkan source yang sudah berhasil.

### 15.3 Inbox/idempotency

Consumer menyimpan `workspace_id + consumer_name + event_id` sebagai unique key. Duplicate delivery menghasilkan current result, bukan duplicate transaction.

Retry hanya untuk error transient. Configuration/validation error masuk `BLOCKED`/dead-letter dengan safe reason dan dapat diretry setelah konfigurasi diperbaiki.

Target sehat R1: cross-module propagation p99 <= 5 detik.

## 16. Event catalog minimum R1

| Event | Producer | Consumer potensial |
|---|---|---|
| `order.submitted.v1` | Order/POS/Self-Order | KDS, reporting |
| `order.cancelled.v1` | Order | KDS, Inventory, reporting |
| `kitchen_ticket.started.v1` | KDS | Order, Inventory |
| `kitchen_ticket.ready.v1` | KDS | Order, Customer, POS |
| `kitchen_ticket.served.v1` | KDS | Order |
| `sale.completed.v1` | POS/Sales | Finance, Inventory, Customer, report |
| `payment.recorded.v1` | Payment Ledger | Finance, report |
| `sale.refunded.v1` | POS/Sales | Finance, Inventory, Customer, report |
| `shift.closed.v1` | POS | Finance, report |
| `table_session.opened.v1` | Floor | Order, report |
| `table_session.moved.v1` | Floor | Order, POS, report |
| `table_session.closed.v1` | Floor | POS, Customer, report |
| `stock.movement_recorded.v1` | Inventory | Finance/report |
| `attendance.approved.v1` | HC | Payroll future/report |
| `schedule.published.v1` | HC | Notification |
| `module.installed.v1` | Core | Admin/provisioning |
| `subscription.changed.v1` | Core | Entitlement projection |

Breaking payload change membuat event version baru.

## 17. Data ownership

| Domain | Pemilik data |
|---|---|
| Workspace/business unit/location | Core Organization |
| User/membership/role | Core Identity/Permission |
| Subscription/package/limit | Core Subscription/Metering |
| Installation/config | Core Installation |
| Integration binding | Core Integration |
| Product/menu | Catalog |
| Order/order item | Order Kernel/Product boundary |
| Bill/payment | Billing/Payment Ledger |
| Sale/refund/shift | POS & Sales |
| Floor/area/table/session/QR | Floor & Self-Order |
| Kitchen ticket | KDS |
| Stock ledger/purchasing | Inventory |
| Financial transaction/projection | Finance Core/Business Finance |
| Employee/schedule/attendance/leave | Human Capital |
| Customer profile | Customer |
| Cross-module dashboard | Reporting Projection |

Read model hanya membawa data yang dibutuhkan surface. Contoh: KDS tidak menerima price/HPP/payment/customer phone; POS tidak menerima margin/HPP; customer tidak menerima layout coordinate/internal IDs.

## 18. Database strategy

- Satu PostgreSQL database untuk R1.
- Tabel domain memakai prefix/schema ownership yang jelas.
- Semua migration dijalankan saat deploy, bukan saat module purchase.
- Semua row domain business memiliki `workspace_id` kecuali global platform tables.
- `location_id` hanya dipakai bila entity memang location-bound.
- Unique tenant-scoped memasukkan `workspace_id`.
- Transaction final tidak hard delete.
- JSONB hanya untuk config/metadata tervalidasi, bukan menggantikan relational core.
- RLS dapat dipakai defense-in-depth, tetapi application scoping tetap wajib.

### 18.1 Core tables

```text
core_users
core_workspaces
core_workspace_memberships
core_business_units
core_locations
core_roles
core_permissions
core_role_permissions
core_member_location_scopes
core_packages
core_package_versions
core_package_modules
core_package_limits
core_subscriptions
core_subscription_addons
core_entitlement_overrides
core_effective_entitlements
core_module_installations
core_module_configs
core_integration_bindings
core_usage_dimensions
core_usage_counters
core_usage_events
core_devices
core_feature_flags
core_audit_logs
core_idempotency_records
core_outbox_events
core_inbox_events
```

Published package version immutable. Usage event idempotent dan counter dapat direbuild.

### 18.2 Catalog/order/sales

```text
catalog_categories
catalog_products
catalog_product_variants
catalog_modifier_groups
catalog_modifier_options
catalog_location_products

order_orders
order_order_items
billing_bills
billing_payments
billing_payment_allocations
sales_sales
sales_refunds
pos_register_sessions
```

Availability `ACTIVE/INACTIVE` dipisahkan dari `AVAILABLE/SOLD_OUT`. Snapshot transaksi tidak berubah ketika catalog berubah kemudian.

### 18.3 Floor/Table/Self-Order

```text
floor_floors
floor_areas
floor_service_tables
floor_table_sessions
floor_session_tables
floor_qr_tokens
```

Aturan:

- Hierarki: `Location -> Floor -> Area -> Table`.
- Location baru mendapat `Main Floor` dan `Main Area` agar cafe sederhana tidak dipaksa setup kompleks.
- Floor/Area user-defined; Indoor/Outdoor/Smoking/VIP hanyalah label area, bukan enum arsitektur wajib.
- Table shape Basic: `SQUARE`, `RECTANGLE`, `ROUND`.
- Table menyimpan capacity, visual size, logical grid position/size, rotation `0|90`, active state, QR-ordering flag.
- Kursi adalah derived visual dari capacity/shape, bukan record inventory.
- Grid source of truth berupa logical integer coordinates, bukan pixel absolut.
- Overlap/out-of-bounds divalidasi server.
- `floor_session_tables` menyimpan attachment table-session dengan role `PRIMARY|MERGED`, attached/detached time.
- Basic: satu primary table aktif + move. Pro: merge/split beberapa table.
- QR melekat pada table, bukan session; database menyimpan token hash/version/status.
- Move table mempertahankan session/order/bill identity.

Table lifecycle/projection minimum: `AVAILABLE`, `OCCUPIED`, `CLOSING`, `CLEANING`, `INACTIVE`; `RESERVED` hanya jika reservation capability aktif.

### 18.4 KDS

```text
kds_tickets
kds_ticket_items
kds_ticket_status_history
kds_stations
```

KDS ticket menggunakan source snapshot dan source reference. External/manual KDS tidak wajib memiliki foreign key ke internal order.

### 18.5 Inventory

```text
inventory_items
inventory_units
inventory_unit_conversions
inventory_suppliers
inventory_recipes
inventory_recipe_items
inventory_movements
inventory_balance_projection
inventory_stocktakes
inventory_stocktake_lines
inventory_transfers
inventory_purchase_receipts
```

Movement append-only. Balance adalah projection yang dapat direbuild. Inventory item tidak wajib memiliki Catalog product.

### 18.6 Finance

```text
finance_accounts
finance_categories
finance_transactions
finance_entries
finance_attachments
finance_reconciliations
finance_period_projections
business_finance_mappings
personal_finance_budgets          # future
personal_finance_goals            # future
personal_finance_recurring_rules  # future
```

Aturan:

- nominal: `DECIMAL(19,4)` atau fixed precision setara + ISO 4217 currency;
- JSON API mengirim nominal sebagai decimal string;
- tidak memakai JS/DB floating point untuk uang;
- posted transaction immutable;
- correction memakai reversal/adjustment;
- `source_reference` unique dalam scope workspace/source/purpose untuk idempotency;
- Finance Basic diberi label operasional/estimasi, bukan accounting formal.

### 18.7 Human Capital

```text
hc_employees
hc_departments
hc_positions
hc_employee_assignments
hc_shift_templates
hc_schedules
hc_schedule_shifts
hc_attendance_events
hc_attendance_records
hc_leave_types
hc_leave_requests
```

Attendance event append-only. Daily record adalah projection. Mobile GPS/selfie/device adalah evidence; backend yang menentukan validitas. Continuous tracking tidak termasuk scope.

### 18.8 Customer/report projection

```text
customer_customers
customer_contact_methods
customer_order_links
report_daily_sales
report_kds_daily
report_inventory_daily
report_finance_period
report_hc_daily
report_workspace_overview
```

Projection dapat dihapus/rebuild tanpa kehilangan source transaction.

## 19. API convention

- Base path versioned, contoh `/api/v1` atau `/v1` secara konsisten.
- REST resource untuk master/draft; command endpoint untuk state transition/final transaction.
- OpenAPI + shared validation contract.
- Pagination/filter/sort untuk collection besar.
- Idempotency key wajib untuk mutation kritis.
- Error memiliki stable code, safe message, correlation ID, dan field error bila relevan.
- Workspace/location context selalu divalidasi server.
- API tidak mengembalikan ORM entity mentah.
- Mobile/web/POS/KDS memanggil domain use case yang sama melalui adapter berbeda.

Contoh command:

```text
POST /v1/workspaces/:workspaceId/pos/orders/:id/submit
POST /v1/workspaces/:workspaceId/pos/sales/:id/complete
POST /v1/workspaces/:workspaceId/floor/table-sessions/:id/move
POST /v1/workspaces/:workspaceId/floor/table-sessions/:id/merge
POST /v1/workspaces/:workspaceId/kds/tickets/:id/ready
POST /v1/workspaces/:workspaceId/inventory/stocktakes/:id/finalize
POST /v1/workspaces/:workspaceId/business-finance/transactions/:id/reverse
POST /v1/workspaces/:workspaceId/hc/attendance/check-in
POST /v1/workspaces/:workspaceId/hc/leave-requests/:id/approve
```

Tidak ada generic `DELETE` untuk final transaction.

## 20. Limit dan metering enforcement

Jenis enforcement:

| Type | Contoh | Behavior |
|---|---|---|
| Hard count | active table/user/device/item | Tolak create/activate baru; data lama tetap usable/readable |
| Soft metered | sale/ticket/movement/attendance | Tetap proses event; tandai over-limit dan tangani billing terpisah |
| Throttled | export/external API | Job baru dapat ditunda/ditolak aman |
| Capability gate | split bill/merge table/budget/mobile attendance | Memerlukan tier/add-on yang benar |

Operasi safety/correction seperti refund, reversal, stock correction, attendance checkout/correction, table-session close, dan export data tidak boleh menjadi hostage quota.

Responsive S/M/L bukan limit, capability, atau add-on.

## 21. Floor & Table architecture contract

### 21.1 Configuration vs operation

Pisahkan:

- **Edit Layout:** owner/manager mengatur Floor, Area, Table, shape, capacity, position, rotation, QR.
- **Live Table View:** staff melihat status/session dan menjalankan aksi operasional.

Menggeser table tile di editor hanya mengubah layout visual. `Move table` adalah domain command terpisah yang mengubah table-session attachment.

### 21.2 Table session

```text
AVAILABLE table
  -> OPEN session
  -> one or more order batches
  -> optional BILL_REQUESTED/CLOSING
  -> CLOSED
  -> CLEANING or AVAILABLE
```

Satu table dapat memiliki banyak session historis. Maksimal satu active primary session per table kecuali explicit recovery policy. Session ID tidak pernah ditimpa saat meja digunakan kembali.

### 21.3 Tier boundary

- Basic: Floor/Area, 3 shapes, capacity + auto chair visualization, snap-to-grid, 0/90 rotation, Live Table View, QR, table session, move table.
- Pro: merge/split, service zone, advanced layout operation/resizing.
- Advanced/Future: reservation/waitlist-aware optimization, complex venue editor/background plan/free rotation/custom shape.

Angka floor/area/table mengikuti effective package limit, bukan hardcoded tier.

## 22. Finance architecture contract

Finance Core adalah internal kernel. Business Finance dan future Personal Finance menggunakan primitive yang sama tetapi tidak berbagi navigation/use-case experience secara kondisional.

### 22.1 Business Finance

- Standalone valid.
- POS/Inventory/HC future masuk melalui integration binding.
- Sale revenue dan payment projection tidak boleh double count.
- Basic: operational cashbook/reconciliation/estimate report.
- Pro: managerial control, budget, AP/AR ringan, approval/import.
- Advanced: accounting-ready contract setelah review; journal/ledger/period close.

### 22.2 Personal Finance

- Hanya workspace `PERSONAL`.
- Tidak mewarisi business membership.
- Account adalah record keeping, bukan custody/wallet.
- UI/client future; Finance Core foundation dibuat sekarang.

## 23. Human Capital architecture contract

HC dapat berjalan tanpa modul F&B.

Tier boundary:

- Basic R1: employee, department/job, schedule, web/manual attendance, leave, basic report.
- Pro future: mobile attendance, geofence, selfie evidence, device trust, timesheet/advanced policy.
- Advanced future: payroll, recruitment, performance, training, biometric connector, roster optimization.

Payroll future mengirim event/binding ke Finance; HC tidak menulis finance table langsung.

## 24. Responsive architecture contract

Semua web capability yang tersedia harus dapat digunakan pada tiga kelas viewport. Ini bukan entitlement.

| Kelas | Width CSS | Baseline QA |
|---|---:|---:|
| Small | `320–767px` | `390×844` |
| Medium | `768–1279px` | `1024×768` |
| Large | `>=1280px` | `1440×900` |

Boundary QA: `320`, `767`, `768`, `1279`, `1280` CSS px.

Aturan arsitektural:

- viewport tidak mengubah API/use case/permission/audit/limit semantics;
- state client seperti cart, form draft, selected workspace/location tidak boleh reset ketika breakpoint berubah;
- tidak ada business logic terpisah `mobile vs desktop`;
- Floor Small memiliki list fallback dan property-edit flow; precision drag bukan satu-satunya cara;
- POS Small memakai catalog primary + cart sheet/page; Medium/Large boleh split view;
- table management Small dapat mengubah configuration lewat form/sheet;
- response DTO tidak mengirim data sensitif hanya karena surface lebih besar.

Detail visual berada di `design-system.md`.

## 25. PWA, device, dan offline boundary

Device mode minimum:

- `BACKOFFICE`;
- `POS`;
- `KDS`;
- `INVENTORY`;
- `MOBILE_HC` future;
- `MOBILE_PERSONAL_FINANCE` future;
- `API_CLIENT`.

R1 online-first:

- cache boleh menyimpan shell, last-known menu/display, dan safe draft;
- submit order, payment confirmation, refund, stock mutation, finance post, approval, dan shift close memerlukan server acknowledgement;
- reconnect selalu refetch source of truth;
- future offline event memakai client idempotency key dan occurred/received timestamp terpisah.

## 26. Realtime

WebSocket menggunakan workspace/location/station/session scope yang aman. Event realtime bukan source of truth.

Setelah reconnect:

1. restore authenticated context;
2. resubscribe channel yang diizinkan;
3. refetch REST/read model;
4. reconcile local display;
5. tampilkan stale/sync state bila belum sehat.

## 27. Security minimum

- Password hashing modern, secure HttpOnly session/cookie, CSRF sesuai transport.
- Rate limit login, QR submit, integration API, dan endpoint sensitif.
- Least privilege DB/app role.
- Workspace isolation automated regression.
- Optional RLS defense-in-depth untuk tabel kritis.
- Signed file upload + ownership/type/size validation.
- Secret di secret manager/environment, tidak di repository atau UI.
- Audit untuk entitlement/package/limit, role, price, floor/table/QR, payment/refund, shift, stock, finance, HC correction/leave approval, support access.
- PII dan secret tidak ditulis ke general log/event.
- Backup, point-in-time recovery bila tersedia, dan restore drill.

## 28. Privacy/data minimization per surface

| Surface | Tidak boleh menerima |
|---|---|
| KDS | price, HPP, payment detail, customer phone, raw audit payload |
| POS | HPP/profit, HR data yang tidak relevan |
| Customer | internal table/session ID, layout coordinate, token mentah, finance/HR data |
| HC Employee | employee lain atau finance business tanpa permission |
| Merchant | platform internal secret/raw provider payload |
| Platform Support | data di luar support scope/reason/expiry |

## 29. Observability

- Structured log: request/correlation ID, workspace ID, location ID, actor type/ID aman.
- Error tracking dan uptime monitor.
- Slow query/connection monitoring.
- Outbox age, consumer lag, retry/dead-letter count.
- WebSocket connection health.
- Usage metering anomaly.
- Audit log terpisah dari application log.
- Dashboard projection menampilkan freshness bila eventual consistency relevan.

## 30. Testing strategy

### 30.1 CI gate

- frozen lockfile install;
- lint/typecheck;
- module-boundary lint;
- unit test;
- PostgreSQL integration test;
- migration safety review;
- web/api/worker build;
- Playwright smoke/E2E;
- responsive/light/dark critical checks.

### 30.2 Prioritas domain

- cross-workspace ID substitution;
- location scope;
- entitlement vs permission vs installation vs limit error;
- package snapshot immutability;
- module provisioning idempotency;
- standalone module path;
- POS -> KDS/Inventory/Finance event idempotency;
- outbox retry/inbox duplicate;
- order/payment state transition;
- stock reversal/correction;
- Finance source-reference duplicate prevention;
- attendance append-only/correction;
- Floor layout bounds/overlap;
- table move mempertahankan session/order/bill;
- QR rotation/revocation;
- downgrade tidak menghapus data;
- S/M/L primary flow dan boundary widths.

## 31. Non-functional target R1

| Area | Target normal |
|---|---|
| API read p95 | <= 500 ms untuk query umum |
| API command p95 | <= 1 s di luar provider eksternal |
| POS critical acknowledgement p95 | <= 2 s |
| Cross-module propagation p99 | <= 5 s saat sehat |
| KDS visible update/fallback | <= 5 s |
| Backoffice initial interactive | target <= 3 s pada koneksi wajar setelah cache |

Availability target awal: 99,5% bulanan di luar maintenance terjadwal. Target harus diukur, bukan diasumsikan.

## 32. Explicitly out of scope Release 1

- Microservices, Kubernetes, Kafka, event sourcing penuh.
- Full offline POS/payment/stock/finance synchronization.
- Native production mobile apps.
- Dynamic QRIS/payment gateway sebelum external gate siap.
- Stored-value wallet.
- Advanced KDS routing/course management.
- Inventory batch/expiry/forecast/central kitchen.
- Formal GL/journal/balance sheet/tax automation.
- Payroll/recruitment/performance production.
- Continuous employee GPS tracking/production biometric.
- Advanced loyalty/campaign/delivery/marketplace.
- Complex building floor-plan editor, background plan, wall/door/decor objects, arbitrary table polygon, free rotation.
- Personal Finance production UI.

Future capability tetap boleh memiliki schema seam/manifest key, tetapi tidak boleh tampil seolah production-ready.

## 33. Release gate

Release/pilot belum dianggap siap sampai:

- dua workspace dapat berjalan tanpa data leakage;
- package/module-only memprovision installation idempotently;
- entitlement/permission/limit/installation menghasilkan reason berbeda;
- POS-only tidak error ketika KDS/Finance/Inventory tidak terpasang;
- POS + KDS + Inventory + Finance memproses event tanpa duplicate transaction;
- HC-only dapat onboard tanpa istilah F&B;
- Business Finance-only dapat mencatat transaksi tanpa Order/POS reference;
- Floor `Main Floor/Main Area` default bekerja;
- tiga shape table Basic, QR, session, move, dan Live Table View bekerja;
- merge/split tetap Pro-gated dan data model many-to-many siap;
- KDS dapat manual/API intake tanpa POS;
- downgrade/suspension tidak menghapus history;
- responsive baseline S/M/L lulus pada surface R1;
- light/dark + accessibility baseline lulus;
- backup/restore, monitoring, migration, dan staging smoke test tersedia.

## 34. Referensi dokumen

Urutan keputusan:

1. `CAFE-COMPANION-PRD-V2-MODULAR-PLATFORM.md` — scope/architecture product contract.
2. `CAFE-COMPANION-MODULE-TIERS-V1.md` — capability Basic/Pro/Advanced.
3. `CAFE-COMPANION-PACKAGES-LIMITS-V1.md` — package, limit, add-on, metering/enforcement.
4. `design-system.md` — visual/interaction contract.
5. `design-system-modules.md` — mapping UI per product module.
6. `DESIGN_SYSTEM_APP_AUDIT.md` — implementation gap snapshot; bukan source requirement.

Saat audit implementasi bertentangan dengan requirement, audit mencatat gap; audit tidak menurunkan requirement secara diam-diam.

## 35. Keputusan final

```text
Backend              : modular monolith
Database             : PostgreSQL shared database
Isolation boundary   : workspace_id (+ location scope)
Commercial model     : package snapshot + module tier + add-on + effective limit
Module activation    : installation/configuration, tanpa schema-per-workspace
Cross-module query   : public facade/read model
Cross-module change  : versioned event after commit
Delivery reliability : transactional outbox + idempotent inbox/consumer
Client model         : web/PWA sekarang, mobile client future pada backend sama
Finance model        : Finance Core + Business Finance + Personal Finance future
HC model             : standalone product module, employee != user
Floor model          : Location -> Floor -> Area -> Table -> Table Session
Responsive contract  : Small 320-767, Medium 768-1279, Large >=1280
```

Dokumen ini sengaja menjaga deployment R1 sederhana sambil membuat boundary cukup kuat agar module-only, package F&B, mobile, dan integrasi future tidak memerlukan pembongkaran fondasi.
