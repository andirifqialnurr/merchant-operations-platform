# Architecture - Merchant Operations Platform

**Status:** Architecture baseline untuk Version 1  
**Tanggal:** 14 Juli 2026  
**Repository:** `merchant-operations-platform`  
**Arsitektur:** TypeScript modular monolith, multi-tenant, online-first PWA

## 1. Tujuan dokumen

Dokumen ini menjadi batas teknis Version 1. Isinya menjelaskan struktur sistem, modul, tech stack, data ownership, database, authorization, PWA, realtime, deployment, testing, dan fitur yang sengaja ditunda.

Jika implementasi berbeda dari keputusan di dokumen ini, perubahan harus dicatat sebagai architecture decision baru dan PRD terkait diperbarui.

## 2. Ruang lingkup Version 1

Version 1 harus mendukung alur lengkap kafe:

```text
Platform membuat tenant dan subscription
-> Owner mengatur brand, outlet, staff, menu, lantai, tata letak meja, recipe, dan stok
-> Order dibuat dari POS atau QR Self-Order
-> KDS menerima dan memproses order
-> Kasir mengonfirmasi pembayaran manual
-> Inventory mencatat consumption/reversal/waste
-> Finance Basic menyajikan sales, expense, HPP, dan estimasi laba
-> Owner melihat laporan outlet dan konsolidasi tenant
```

Payment gateway, dynamic QRIS, accounting formal, dan full offline tidak termasuk Version 1.

## 3. Hierarki dan istilah

```text
Platform
`-- Tenant
    `-- Brand
        `-- Outlet
```

- **Platform**: SaaS milik penyedia aplikasi.
- **Tenant**: pihak yang berlangganan dan memiliki data bisnis.
- **Brand**: identitas usaha yang dilihat consumer.
- **Outlet**: lokasi operasional dan scope transaksi.
- **Staff/User**: pengguna internal tenant.
- **Consumer/Guest**: pelanggan akhir merchant.

Core memakai nama generik agar dapat berkembang ke retail dan toko bangunan. Konsep meja, kitchen, modifier, dan recipe ditempatkan sebagai extension F&B, bukan inti semua merchant.

## 4. Prinsip arsitektur

1. Satu codebase monorepo dan satu modular monolith API.
2. Satu PostgreSQL shared schema untuk seluruh tenant.
3. `tenant_id` menjadi batas keamanan utama; `outlet_id` menjadi batas operasional.
4. Core domain selalu tersedia dan bukan checkbox paket.
5. Commercial module diaktifkan melalui entitlement.
6. RBAC mengatur tindakan user, bukan komunikasi internal antarmodul.
7. Modul hanya menulis data yang dimilikinya.
8. Cross-module read memakai application interface/read model; cross-module change memakai service atau domain event.
9. Order, bill, payment, fulfillment, stock, dan finance memiliki lifecycle terpisah.
10. Transaksi penting tidak dihapus permanen.
11. REST/database adalah source of truth; WebSocket hanya distribusi update.
12. Online-first pada Version 1; operasi finansial dan stok memerlukan server acknowledgement.

## 5. Tech stack

| Area | Pilihan Version 1 |
|---|---|
| Bahasa | TypeScript |
| Runtime | Node.js 24 LTS |
| Frontend | Next.js App Router + React |
| Backend | NestJS modular monolith |
| API | REST JSON + OpenAPI |
| Database | PostgreSQL 18 |
| ORM/migration | Prisma ORM + reviewed SQL migration |
| Realtime | Socket.IO/WebSocket |
| Queue | Redis + BullMQ |
| File storage | S3-compatible object storage |
| UI | Tailwind CSS + reusable component library |
| Server state | TanStack Query |
| Local UI state | Zustand secukupnya |
| Form/validation | React Hook Form + Zod |
| Monorepo | pnpm workspace + Turborepo |
| Local environment | Docker Compose |
| Testing | Unit/integration + Playwright |
| CI/CD | GitHub Actions |

Versi dependency harus dipin melalui lockfile. Upgrade major tidak dilakukan otomatis tanpa test dan migration review.

## 6. Topologi aplikasi

```text
Customer Browser
Merchant PWA
Platform Admin Web
        |
        v
Next.js Web Application
        | REST/WebSocket
        v
NestJS Modular Monolith API
        |
        +-- PostgreSQL
        +-- Redis/BullMQ
        +-- Object Storage
        `-- Worker Process
```

### Deployment unit Version 1

- `web`: Next.js public, merchant, dan platform routes.
- `api`: NestJS HTTP dan WebSocket gateway.
- `worker`: background jobs dan outbox processor.
- `postgres`: managed PostgreSQL direkomendasikan untuk production.
- `redis`: cache, queue, dan realtime fan-out bila diperlukan.

Tidak ada microservices, Kubernetes, Kafka, atau database per module pada Version 1.

## 7. Struktur monorepo

```text
apps/
  web/
  api/
  worker/
packages/
  database/
  contracts/
  domain-events/
  ui/
  eslint-config/
  typescript-config/
infrastructure/
  docker/
  deployment/
docs/
architecture.md
```

### Batas frontend

```text
apps/web/app/
  (public)/       cafe profile dan self-order
  (merchant)/     dashboard, POS, KDS, inventory, finance
  (platform)/     super admin
```

Core write operation tidak menggunakan business logic di Server Actions. Next.js memanggil NestJS API agar seluruh aturan domain berada pada satu backend.

## 8. PWA dan device mode

Version 1 menggunakan satu **Merchant Operations PWA**. Role dan device mode menentukan landing page serta surface yang tersedia.

| Surface | PWA | Catatan |
|---|---|---|
| POS | Ya | Tablet/desktop kasir |
| KDS | Ya | Kiosk/device mode khusus |
| Inventory/Backoffice | Melalui Merchant PWA | Tidak memerlukan app terpisah |
| Customer Self-Order | Tidak wajib | Mobile web dari QR |
| Platform Admin | Tidak | Responsive web |

Device terdaftar dengan tipe `POS`, `KDS`, `BACKOFFICE`, atau `INVENTORY`, serta memiliki tenant/outlet assignment. Device mode tidak menggantikan user permission.

Cache PWA Version 1 hanya mencakup application shell, menu terakhir, draft cart, dan last-known display. Submit order, payment confirmation, refund, stock adjustment, approval, dan shift closing memerlukan koneksi server.

## 9. Klasifikasi modul

### 9.1 Core domain - selalu aktif

- Tenancy dan Organization.
- Identity, Membership, dan Authorization.
- Subscription/Entitlement Core.
- Catalog Core.
- Order Core.
- Bill Core.
- Payment Ledger Core.
- Audit dan Idempotency.

Core domain bukan paket jualan dan tidak ditampilkan sebagai checkbox merchant.

### 9.2 Commercial modules

- Cafe Profile.
- POS.
- Table Layout dan QR Self-Order.
- KDS.
- Inventory Basic.
- Finance Basic.
- Customer Basic.

### 9.3 Integration bridges

- Order -> KDS.
- Order -> Inventory.
- Order/Bill/Payment -> Finance.
- Inventory -> Finance untuk HPP.
- Order -> Customer History.

Integration bridge diaktifkan sistem berdasarkan entitlement. User tidak diberi permission khusus hanya agar bridge berjalan.

## 10. Dependency module

| Commercial module | Hard dependency | Optional integration |
|---|---|---|
| Cafe Profile | Catalog Core | Customer Basic |
| POS | Catalog, Order, Bill, Payment Ledger | Inventory, Finance |
| Table Layout/Self-Order | Cafe Profile, Catalog, Order, Bill | KDS, Customer, Integrated Payment |
| KDS | Order Core | Multi-station routing |
| Inventory Basic | Catalog Core | Order consumption, Finance HPP |
| Finance Basic | Order, Bill, Payment Ledger | Inventory HPP |
| Customer Basic | Tenancy Core | Order history |

Hard dependency diaktifkan otomatis dan tidak perlu dibeli. Optional integration aktif hanya ketika kedua commercial module terkait aktif.

Finance tetap dapat berjalan tanpa Inventory, tetapi bagian HPP/margin berbasis recipe ditandai tidak tersedia. Inventory yang diaktifkan setelah transaksi berjalan membutuhkan opening stock; histori stok tidak direkayasa dari order lama.

## 11. Modul dan fitur Version 1

### Platform Management

- Tenant, brand, outlet, user owner, package, module, dan entitlement.
- Trial, active, grace, suspended, dan terminated.
- Invoice subscription manual dan konfirmasi transfer.
- Usage summary, support notes, dan audited support access.

### Merchant Organization dan IAM

- Brand/outlet profile, jam operasional, tax, service charge, payment method.
- User, membership, role, permission, outlet assignment, device, dan manager approval.

### Catalog

- Category, product, image, price, variant, modifier, outlet override, availability.
- Recipe link untuk produk F&B.

### POS

- Dine-in, takeaway, cart, modifier, note, discount sederhana, tax, service charge.
- Hold, cancel, reprint, manual refund record, dan approval.
- Cash, merchant QRIS, transfer, EDC, dan mixed payment sederhana.
- Open/close shift, cash in/out, counted cash, dan variance.

### Order/Table/Self-Order

- Order dari cashier, table QR, dan waiter.
- Lantai, area opsional, meja, QR token, table session, pindah meja, dan beberapa order batch.
- Table layout per lantai dengan canvas snap-to-grid yang hanya memetakan posisi meja.
- Table layout mendukung label, capacity, bentuk sederhana `ROUND`, `SQUARE`, atau `RECTANGLE`, grid position, grid size, active state, dan display order.
- Backoffice mengelola layout; POS memakai layout read-only dengan status meja realtime.
- QR unik dipetakan ke satu meja dan dapat dicetak, dinonaktifkan, atau dirotasi tanpa mengubah identitas meja.
- Guest menu, cart, note, submit, pesan lagi, status, dan minta bill.
- Satu bill per table session pada UI Version 1; schema memisahkan bill agar split bill dapat dikembangkan.

Table layout Version 1 bukan editor denah bangunan. Dinding, pintu, jendela, bar, kasir, dekorasi, background image, arbitrary shape, dan rotasi bebas tidak dimodelkan.

### KDS

- New, accepted, preparing, ready, served, completed.
- Audio alert, elapsed time, note, source, reconnect, dan riwayat hari berjalan.
- Satu station per outlet pada Version 1.

### Inventory Basic

- Ingredient/item, unit, conversion dasar, supplier, recipe/BOM, dan minimum stock.
- Opening stock, stock in/out, adjustment, opname, waste, transfer outlet.
- Pembelian dan penerimaan sederhana.
- Order consumption, cancellation reversal, dan waste.

### Finance Basic

- Sales revenue dari bill/payment valid.
- Other income, expense, category, attachment, dan cashbook.
- Shift/payment reconciliation manual.
- Estimasi HPP, gross profit, operational expense, dan operating profit.
- Per outlet dan consolidated tenant report.

### Customer Basic

- Nama/telepon opsional, note, transaction history, total visit, dan total purchase.
- Tidak mencakup loyalty, campaign, atau marketing automation.

## 12. Authorization model

Authorization memakai kombinasi:

```text
Authentication
AND active membership
AND active tenant/subscription
AND module entitlement
AND user permission
AND tenant/outlet scope
AND device mode bila relevan
AND contextual policy
```

### RBAC

Default role: `OWNER`, `MANAGER`, `CASHIER`, `KITCHEN`, `WAITER`, `INVENTORY_STAFF`, dan `FINANCE_STAFF`. Merchant dapat membuat custom role sebagai kumpulan permission.

Role default diprovisikan secara internal bersama owner pertama tenant. System role bersifat immutable; custom role tenant dapat mengubah nama, status, dan kumpulan permission. Membership unik per pasangan tenant-user, sedangkan outlet scope dinyatakan eksplisit sebagai seluruh outlet atau daftar `outlet_assignments`; daftar kosong tidak diartikan otomatis sebagai seluruh outlet.

Permission berbasis use case, misalnya:

- `order.create`, `order.cancel`, `order.move_table`.
- `table.view`, `table.manage`, `table.layout.manage`, `table.qr.manage`.
- `payment.confirm`, `payment.refund`, `payment.reconcile`.
- `shift.open`, `shift.close`, `cash_variance.approve`.
- `inventory.receive`, `inventory.adjust`, `inventory.stocktake`.
- `finance.dashboard.view`, `finance.expense.create`, `finance.report.export`.

### Aturan penting

- RBAC user tidak digunakan untuk menghalangi integration bridge.
- Finance user tidak memerlukan `pos.access` untuk melihat finance summary.
- KDS user menerima kitchen read model, bukan seluruh order/payment.
- Inventory user menerima consumption data tanpa memperoleh akses POS.
- RLS database fokus pada tenant isolation, bukan seluruh aturan role.
- Backend adalah sumber keputusan; menyembunyikan menu frontend bukan security.

Contextual policy menangani status dan approval. Contoh: cashier dapat membatalkan order sebelum produksi, sedangkan order preparing/paid memerlukan manager approval dan alasan.

## 13. Data ownership

| Domain | Pemilik data |
|---|---|
| Tenancy | Tenancy module |
| User/membership/role | Identity module |
| Product/menu/recipe link | Catalog module |
| Order dan order item | Order module |
| Bill dan allocation | Bill module |
| Payment/refund record | Payment module |
| Floor/table layout/QR/table session/KDS ticket | F&B fulfillment module |
| Stock ledger | Inventory module |
| Expense/cashbook/summary | Finance module |
| Customer profile | Customer module |
| Subscription/entitlement | Subscription module |

Module tidak menulis tabel domain lain secara langsung. Read model hanya mengekspos data yang diperlukan use case, misalnya KDS tidak menerima harga/HPP dan Finance summary tidak menerima kitchen note atau customer phone.

## 14. Skema database

Database menggunakan shared schema multi-tenant. Semua tabel bisnis memiliki `tenant_id`; tabel transaksi outlet juga memiliki `outlet_id`.

### Platform dan subscription

```text
platform_users, tenants, brands, outlets
modules, plans, plan_modules
subscriptions, tenant_entitlements, usage_records, subscription_invoices
```

### Identity

```text
users, tenant_memberships, outlet_assignments
roles, permissions, role_permissions, user_roles, login_sessions, devices
```

### Catalog dan F&B

```text
categories, products, product_variants
modifier_groups, modifier_options, product_modifier_groups
outlet_products, product_images
recipes, recipe_items
service_floors, service_areas, service_tables
table_layout_items, table_qr_tokens, table_sessions
kitchen_stations, kitchen_tickets, kitchen_ticket_items
```

### Table layout data rules

- `service_floors` dimiliki outlet dan menyimpan nama lantai, urutan, serta ukuran grid logical.
- `service_areas` bersifat opsional untuk zona seperti indoor, outdoor, atau smoking pada satu lantai.
- `service_tables` adalah identitas operasional meja dan tidak menyimpan session aktif sebagai mutable foreign key.
- `table_layout_items` menyimpan `grid_x`, `grid_y`, `grid_w`, `grid_h`, dan bentuk sederhana; satu meja hanya memiliki satu posisi aktif pada lantainya di Version 1.
- `table_qr_tokens` menyimpan token hash, status, waktu dibuat/dicabut, dan actor agar QR dapat dirotasi serta diaudit.
- URL QR membawa opaque random token; database menyimpan hash token dan resolver hanya menerima token, outlet, serta meja yang aktif.
- Layout coordinate memakai integer grid, bukan pixel absolut atau satu JSON blob.
- Server memvalidasi posisi berada dalam batas canvas dan tidak overlap. Client menggunakan drag-and-drop snap-to-grid.
- Memindahkan tile pada layout hanya mengubah posisi visual. Memindahkan order/table session memakai command `order.move_table` yang terpisah.
- Mengubah layout atau lantai tidak mengganti QR token. Regenerate QR tidak menghapus histori order/table session.

### Order, bill, dan payment

```text
orders, order_items, order_item_modifiers, order_status_events
bills, bill_items
payments, payment_allocations, refunds, payment_reconciliations
cash_shifts, cash_movements
```

### Inventory dan purchasing

```text
inventory_items, units, unit_conversions
stock_movements, stock_balances, stocktakes, stocktake_items
waste_records, stock_transfers
suppliers, purchases, purchase_items, goods_receipts, goods_receipt_items
```

### Finance/customer/system

```text
expense_categories, expenses, other_incomes, daily_financial_summaries
customers, customer_contacts, customer_notes, customer_consents
audit_logs, approval_requests, idempotency_keys, outbox_events, failed_jobs
```

### Tipe data

- Primary key: UUIDv7.
- Money final: `BIGINT amount_minor` + `CHAR(3) currency`; tidak memakai float.
- Quantity/cost calculation: `NUMERIC(20,6)`.
- Waktu: `TIMESTAMPTZ`, disimpan UTC; outlet menyimpan timezone.
- JSONB hanya untuk metadata nonkritis, bukan harga, stok, permission, atau payment status.
- File/image berada di object storage; database menyimpan object key dan metadata.

Index utama mengikuti pola `(tenant_id, outlet_id, created_at)` dan foreign key/unique constraint selalu menyertakan scope tenant bila dibutuhkan.

## 15. Lifecycle utama

### Order

```text
DRAFT -> SUBMITTED -> ACCEPTED -> PREPARING -> READY -> SERVED -> COMPLETED
                         `-> CANCELLED sesuai policy
```

### Payment manual

```text
UNPAID -> VERIFYING -> PAID
PAID -> REFUND_PENDING -> REFUNDED
```

Tombol customer “sudah membayar” hanya menghasilkan `VERIFYING`. Kasir tetap memeriksa aplikasi/rekening merchant.

### Table session

```text
OPEN -> CLOSING -> CLOSED
```

### Subscription

```text
TRIAL -> ACTIVE -> GRACE -> SUSPENDED -> TERMINATED
```

## 16. Transaction, event, dan realtime

Perubahan kritis dilakukan dalam satu PostgreSQL transaction. Contoh order accepted:

```text
update order status
create/update kitchen ticket
write stock movement bila bridge aktif
write status history
write outbox event
commit
```

Worker memproses `outbox_events` untuk WebSocket, notification, dan summary. Version 1 tidak memakai Kafka atau event sourcing.

WebSocket menggunakan room tenant/outlet/station/table-session. Setelah reconnect, client selalu refetch state melalui REST; event realtime tidak menjadi satu-satunya bukti transaksi.

Queue dipakai untuk retry, notification, report/export, reconciliation, dan scheduled task. Job harus idempotent dan memiliki bounded retry/dead-letter handling.

## 17. Inventory dan finance boundary

`stock_movements` adalah source of truth; `stock_balances` adalah saldo cepat. Correction memakai adjustment/reversal, bukan mengubah histori.

```text
PURCHASE_RECEIPT
ORDER_CONSUMPTION
ORDER_CANCELLATION_REVERSAL
WASTE
STOCKTAKE_ADJUSTMENT
TRANSFER_IN / TRANSFER_OUT
```

Finance Basic mengambil sales dari bill/payment, bukan menyalinnya sebagai pemasukan manual. HPP berasal dari recipe dan cost bahan yang konsisten. Semua laba diberi label estimasi operasional, bukan laporan accounting formal.

## 18. API convention

- Base path `/api/v1`.
- REST resource dan command endpoint untuk operasi stateful.
- OpenAPI menjadi kontrak API; Swagger UI interaktif tersedia di `/api/docs` hanya pada environment yang diizinkan.
- Endpoint dokumentasi OpenAPI dinonaktifkan di production sampai dapat dilindungi oleh authentication dan permission platform admin.
- Shared Zod contract wajib menjadi boundary validation untuk header, path parameter, query, body, dan response yang relevan pada setiap endpoint baru.
- Frontend menggunakan tipe atau generated client dari contract yang sama agar payload kirim/terima tidak berbeda dari backend.
- Pagination cursor untuk transaction list besar.
- Idempotency key untuk submit order, payment confirmation, refund, dan stock adjustment.
- Error response memiliki stable code, message, request ID, dan safe details.
- Tenant/outlet context tidak dipercaya hanya dari request body; divalidasi dari membership dan resource.
- Tenant/brand/outlet registry application service boleh dibangun sebelum IAM, tetapi route HTTP tidak boleh diekspos sampai active membership, permission, dan tenant scope dapat memvalidasi actor.
- Route organization dan pengelolaan access-control memvalidasi cookie session, active user, active tenant membership, permission use-case, serta scope seluruh outlet karena operasinya tenant-wide. Header tenant/outlet hanya memilih context dan bukan bukti authorization; user outlet-scoped tidak dapat menaikkan scope melalui header.

## 19. Security minimum

- Password Argon2id; secure HttpOnly cookie/session dan CSRF protection.
- Rate limit login, QR submit, dan endpoint sensitif.
- Least privilege database/application role.
- Tenant isolation test dan RLS defense-in-depth untuk tabel kritis.
- Signed upload URL, size/type validation, dan object ownership.
- Secrets berada di environment/secret manager, bukan repository atau plain database.
- Audit untuk login, role, price, floor/table layout, QR rotation/revocation, stock, cancel, payment, refund, shift, support access, dan entitlement.
- Backup terjadwal, point-in-time recovery bila tersedia, serta restore drill.
- PII/sensitive value tidak ditulis ke log.

## 20. Development dan deployment

### Local

Docker Compose menyediakan PostgreSQL, Redis, S3-compatible local storage, mail catcher, API, worker, dan web. Windows development direkomendasikan memakai WSL2/Docker Desktop.

### Environment

- Development.
- Staging dengan database terpisah dan merchant demo.
- Production.

### CI gate

- Install dengan frozen lockfile.
- Lint dan typecheck.
- Unit test.
- Integration test dengan PostgreSQL asli.
- Build web/api/worker.
- Migration safety review.
- Playwright smoke test pada staging.

Production memakai container deployment, managed PostgreSQL, Redis, object storage, TLS, reverse proxy/CDN, dan region dekat target merchant. Schema production hanya berubah melalui migration yang tersimpan di repository.

## 21. Testing prioritas

- Tenant isolation dan outlet scope.
- Entitlement serta custom role.
- Order/payment state transition.
- Concurrent submit dan idempotency.
- KDS reconnect/refetch.
- Stock consumption, reversal, waste, dan transfer.
- Shift expected cash dan variance.
- Finance sales/HPP/expense calculation.
- Subscription suspend/reactivation.
- End-to-end POS dan QR Self-Order.
- Tenant/outlet isolation untuk floor, table layout, dan QR token.
- Table layout bounds, overlap, reorder, serta persistence setelah reload.
- QR rotation/revocation dan resolusi token ke tenant/outlet/table yang benar.

## 22. Observability

- Structured JSON log dengan request ID, tenant ID, outlet ID, dan actor ID.
- Error tracking dan uptime monitor.
- Slow query dan database connection monitoring.
- Queue failure/retry monitoring.
- WebSocket connection health.
- Audit log terpisah dari application log.

## 23. Explicitly out of scope Version 1

- Payment gateway, dynamic QRIS, split settlement, dan automatic refund.
- Full offline POS/synchronization.
- Native Android/iOS application.
- Microservices, Kubernetes, Kafka, dan event sourcing penuh.
- Multi-station KDS advanced.
- Batch/expiry, forecasting, central kitchen, dan purchasing approval.
- General ledger, journal, balance sheet, tax, dan accounting formal.
- Loyalty, campaign, advanced promotion, reservation, delivery, marketplace, dan public API.
- Retail barcode/self-checkout dan toko bangunan multi-unit advanced.
- Editor denah bangunan: dinding, pintu, jendela, fasilitas, dekorasi, background image, dan rotasi objek bebas.

Schema core tidak boleh memakai nama F&B untuk konsep generik. Extension vertikal dapat ditambahkan sebagai `fnb_*`, `retail_*`, atau `building_supply_*` tanpa mengubah Order, Bill, Payment, Tenant, dan Catalog Core.

## 24. Release gate Version 1

Version 1 siap pilot jika:

- Dua tenant dapat berjalan tanpa kebocoran data.
- Owner multi-outlet memperoleh laporan terisolasi dan konsolidasi.
- POS dan Self-Order menghasilkan order pada KDS yang sama.
- Owner dapat menyusun meja per lantai; POS menampilkan posisi dan status meja dari layout yang sama.
- Setiap QR aktif terhubung tepat ke satu meja, sedangkan QR yang dicabut tidak dapat membuat order.
- Manual cash/QRIS/transfer dapat diselesaikan dan direkonsiliasi.
- Recipe menghasilkan stock movement; cancel menghasilkan reversal/waste.
- Finance Basic menghasilkan sales, expense, HPP, gross profit, dan operating profit.
- Entitlement menolak module nonaktif tanpa memblokir integration bridge aktif.
- RBAC, outlet scope, device mode, approval, dan audit diuji.
- Backup/restore, monitoring, migration, dan staging smoke test tersedia.

## 25. Referensi produk

- [Global Product Scope](./docs/00-GLOBAL-PRODUCT-SCOPE.md)
- [PRD MVP Release 1](./docs/versions/01-MVP-RELEASE-1.md)
- [Package and Pricelist Index](./docs/README.md)

## 26. Referensi teknis resmi

- Node.js releases: https://nodejs.org/en/about/previous-releases
- Next.js App Router/PWA: https://nextjs.org/docs/app dan https://nextjs.org/docs/app/guides/progressive-web-apps
- NestJS/WebSocket: https://docs.nestjs.com dan https://docs.nestjs.com/websockets/gateways
- PostgreSQL versioning/RLS: https://www.postgresql.org/support/versioning/ dan https://www.postgresql.org/docs/current/ddl-rowsecurity.html
- Prisma Migrate: https://docs.prisma.io/docs/orm/prisma-migrate
- BullMQ: https://docs.bullmq.io/
