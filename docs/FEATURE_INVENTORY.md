# Feature Inventory - Merchant Operations Platform

**Status:** Source draft untuk penyusunan ulang `design-system.md`  
**Tanggal:** 3 Agustus 2026  
**Cakupan:** Semua fitur aplikasi yang direncanakan untuk paket biasa/core, paket subscription, custom module, dan add-on future  
**Sumber:** `architecture.md`, `docs/00-GLOBAL-PRODUCT-SCOPE.md`, `docs/versions/01-MVP-RELEASE-1.md`, dan `docs/packages/*`

## 1. Tujuan dokumen

Dokumen ini memetakan fitur produk agar design system berikutnya dapat dibuat dari kebutuhan aplikasi nyata, bukan dari komponen generik.

Gunakan dokumen ini untuk:

- menentukan surface utama yang perlu punya layout pattern;
- menurunkan kebutuhan component bank, form pattern, table pattern, status, chart, canvas, QR, print, dan empty/error state;
- membedakan fitur yang selalu ada, fitur yang muncul karena subscription, dan fitur add-on/future;
- menjaga UI agar tidak menampilkan data sensitif, identifier internal, token, audit payload, atau field yang bukan milik action pengguna.

Dokumen ini bukan pricing final, bukan kontrak legal, dan bukan pengganti PRD. Bila ada konflik, `architecture.md` dan PRD release terkait menjadi sumber teknis utama.

## 2. Legend availability

| Label          | Arti untuk produk                                                                            | Dampak untuk UI                                                                                  |
| -------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Core           | Selalu aktif untuk tenant yang subscription-nya usable. Tidak dijual sebagai checkbox paket. | Dibutuhkan oleh semua surface merchant, tetapi tidak selalu ditampilkan sebagai modul eksplisit. |
| Paket          | Fitur aktif berdasarkan paket komersial standar.                                             | Navigasi, halaman, empty state, dan locked state mengikuti entitlement.                          |
| Custom Modular | Fitur dapat diaktifkan sebagai modul pilihan dengan dependency rules.                        | UI harus mampu menyembunyikan modul nonaktif dan menampilkan dependency/upgrade secara aman.     |
| Add-on Future  | Direncanakan, tetapi bukan scope MVP/Version 1.                                              | Jangan dibuat sebagai flow produksi sebelum PRD dan gate eksternal selesai.                      |
| Platform-only  | Dipakai oleh operator SaaS, bukan merchant biasa.                                            | Harus terpisah dari merchant session dan tidak menampilkan payload sensitif.                     |

## 3. Paket dan cakupan komersial

| Paket                     | Target                                                 | Fitur utama                                                                                                                         | Tidak termasuk utama                                                                                                       |
| ------------------------- | ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Profile                   | Kafe/UMKM yang hanya perlu profil dan katalog digital. | Brand/outlet profile, menu publik, status buka/tutup, QR profil/menu, basic visitor/menu summary bila tersedia.                     | POS, cart/order, table layout, QR Self-Order, KDS, payment, inventory, finance, customer CRM.                              |
| POS Basic                 | Outlet yang mengganti pencatatan kasir.                | Core merchant, catalog, POS, manual payment, shift, cash control, sales report basic.                                               | QR Self-Order, visual table layout, KDS terpisah, inventory/recipe, finance basic penuh, integrated payment, loyalty/CRM.  |
| Cafe Digital              | Kafe dine-in dengan QR ordering.                       | Semua POS Basic, Cafe Profile, table layout per lantai, QR meja, customer self-order, KDS, operational order reports.               | Inventory, recipe, finance basic penuh, integrated payment, loyalty/CRM, delivery/reservation, multi-station KDS advanced. |
| Cafe Operations           | Paket operasional MVP lengkap.                         | Semua Cafe Digital, Inventory Basic, Finance Basic, Customer Basic, report operasional lengkap.                                     | Dynamic QRIS, settlement otomatis, advanced inventory, accounting formal, loyalty/campaign, marketplace.                   |
| Custom Modular            | Merchant dengan kombinasi modul khusus.                | Core Platform plus modul terpilih: Cafe Profile, POS, Table Layout/Self-Order, KDS, Inventory Basic, Finance Basic, Customer Basic. | Kombinasi invalid ditolak; dependency wajib terpenuhi.                                                                     |
| Integrated Payment Add-on | Merchant yang ingin payment request otomatis.          | Dynamic QRIS, provider config, webhook, idempotency, polling fallback, settlement/payout report, refund/dispute workflow.           | Bukan MVP; tidak membuat wallet, pinjaman, paylater, atau penyimpanan saldo konsumen.                                      |

## 4. Core domain yang selalu tersedia

Core adalah fondasi platform. Core bukan fitur jualan yang ditampilkan sebagai paket merchant, tetapi semua module bergantung pada sebagian core ini.

### 4.1 Tenancy dan organization

**Availability:** Core  
**Pengguna utama:** Platform operator, merchant owner, manager  
**Fitur:**

- Tenant registry.
- Brand registry.
- Outlet registry.
- Hierarki Platform -> Tenant -> Brand -> Outlet.
- Outlet timezone, alamat, status operasional, dan assignment.
- Tenant/outlet isolation untuk semua data bisnis.

**Design-system needs:**

- app shell yang dapat memisahkan platform admin dan merchant workspace;
- tenant/outlet switcher atau context header;
- status badge untuk active/inactive/suspended;
- empty state onboarding tenant/brand/outlet;
- destructive confirmation untuk deaktivasi.

**Data guard:** tenant ID, brand ID, outlet ID, actor ID, session ID, dan audit metadata tidak menjadi teks utama di UI merchant. ID hanya callback/internal value.

### 4.2 Identity, membership, RBAC, dan device

**Availability:** Core  
**Pengguna utama:** Owner, manager, platform admin, semua staff  
**Fitur:**

- User account.
- Tenant membership.
- Role default: Owner, Manager, Cashier, Kitchen, Waiter, Inventory Staff, Finance Staff.
- Custom role berbasis permission.
- Outlet assignment.
- Device registration untuk POS, KDS, Backoffice, dan Inventory.
- Manager approval PIN.
- Login history, session control, dan roadmap MFA.

**Design-system needs:**

- form user/staff;
- permission matrix;
- outlet assignment picker;
- role badge;
- device-mode selector;
- approval dialog;
- session/device table.

**Data guard:** password hash, token, session cookie, raw device secret, actor ID, dan audit payload tidak dirender.

### 4.3 Subscription dan entitlement core

**Availability:** Core dan Platform-only  
**Pengguna utama:** Platform owner/admin/support, merchant owner untuk konteks paket  
**Fitur:**

- Package dan module master.
- Plan module.
- Tenant entitlement.
- Trial, active, grace, suspended, terminated.
- Manual subscription invoice.
- Konfirmasi transfer subscription.
- Usage records/metering.
- Module gate frontend dan backend.
- Dependency resolution untuk module hard dependency.

**Design-system needs:**

- entitlement matrix;
- package cards untuk admin internal;
- subscription status banner;
- locked/upgrade state;
- invoice/payment confirmation table;
- support note timeline;
- audit event list.

**Data guard:** raw entitlement override payload, subscription internal ID, invoice internal ID, support actor ID, dan audit payload tidak tampil pada merchant UI.

### 4.4 Catalog core

**Availability:** Core  
**Pengguna utama:** Owner, manager, cashier, customer  
**Fitur:**

- Category.
- Product.
- Product image.
- Description.
- Base price.
- Variant.
- Modifier group dan option.
- Outlet product assignment.
- Outlet price override.
- Availability dan sold-out manual.
- Recipe link untuk produk F&B bila Inventory aktif.

**Design-system needs:**

- catalog table/list;
- product form;
- image uploader/preview;
- price input berbasis minor-unit display;
- variant/modifier editor;
- availability toggle;
- outlet override table;
- customer-safe menu card.

**Data guard:** harga tampil sebagai display/input sesuai role; cost/HPP tidak tampil di catalog customer/POS kecuali surface finance/inventory yang memang berhak.

### 4.5 Order, bill, payment ledger, audit, dan idempotency core

**Availability:** Core, dipakai oleh POS/Self-Order/Finance/Inventory  
**Pengguna utama:** Cashier, waiter, kitchen, finance, owner, customer  
**Fitur:**

- Order lifecycle: draft, submitted, accepted, preparing, ready, served, completed, cancelled.
- Payment lifecycle manual: unpaid, verifying, paid, refund pending, refunded.
- Bill terpisah dari order.
- Payment allocation.
- Refund record.
- Idempotency key untuk submit order, payment confirmation, refund, stock adjustment.
- Audit log untuk action sensitif.

**Design-system needs:**

- timeline/status stepper;
- payment status badge;
- idempotent submit/loading state;
- confirmation dialog with reason;
- audit-safe history list;
- bill summary;
- retry and server-acknowledgement state.

**Data guard:** payment provider raw response, idempotency key, internal payment/bill/order ID, audit payload, dan actor ID tidak menjadi visible UI.

## 5. Platform Management

**Availability:** Platform-only  
**Pengguna utama:** Platform owner, platform admin, finance/support  
**Fitur:**

- Dashboard tenant, outlet, user, usage, dan subscription.
- CRUD tenant, brand, outlet, dan owner user.
- Package/module master.
- Entitlement tenant.
- Trial, active, grace, suspended, terminated.
- Invoice subscription manual.
- Transfer confirmation.
- Usage summary.
- Support notes.
- Support access dengan reason, expiry, dan audit.
- Platform analytics, monitoring, feature flag, dan notification template pada roadmap global.

**Design-system needs:**

- dense admin shell;
- admin data table;
- filter/search toolbar;
- status tabs;
- detail drawer;
- confirmation modal;
- audit timeline;
- empty/error/loading state;
- responsive admin views.

**Data guard:** platform session terpisah dari merchant session. Jangan tampilkan tenant/subscription IDs, raw payload, token, session, billing internal ID, atau audit actor ID sebagai teks biasa.

## 6. Merchant Organization

**Availability:** Core plus terlihat pada semua paket merchant  
**Pengguna utama:** Owner, manager  
**Fitur:**

- Brand profile: nama, logo, banner, deskripsi, kontak, media sosial.
- Outlet profile: alamat, Maps link, jam operasional, buka/tutup.
- Pajak dan service charge.
- Payment method manual: cash, merchant QRIS, transfer, EDC, other.
- Staff management.
- Role/permission management.
- Outlet assignment.
- Device management.
- Printer configuration dan test print.

**Design-system needs:**

- profile form;
- operating-hours editor;
- tax/service-charge form;
- payment-method setting list;
- staff table;
- role matrix;
- device/printer card;
- test-print and reconnect controls.

**Data guard:** konfigurasi payment manual boleh menampilkan label publik dan instruksi aman; jangan tampilkan credential provider, secret, token, atau raw webhook config.

## 7. Cafe Profile dan Digital Storefront

**Availability:** Paket Profile, POS Basic sebagai profile dasar, Cafe Digital, Cafe Operations, Custom Modular  
**Pengguna utama:** Owner, manager, customer/guest  
**Fitur:**

- Public brand/outlet profile.
- Logo, banner, address, Maps link, hours, contact.
- Public menu.
- Category/product display.
- Foto, description, price, variant, modifier sebagai informasi.
- Status tersedia/habis.
- QR menuju profile/menu.
- Platform-hosted URL.
- Visitor/menu-view summary bila pengukuran tersedia.
- Future: promo, custom domain, white-label bertahap.

**Design-system needs:**

- public storefront layout;
- mobile menu list;
- product detail;
- sold-out state;
- open/closed banner;
- QR/link share surface;
- merchant storefront theme preset.

**Data guard:** customer profile tidak menerima internal table layout, tenant/outlet internal ID, token QR mentah, session ID, payment data, atau audit metadata.

## 8. POS dan Cashier

**Availability:** POS Basic, Cafe Digital, Cafe Operations, Custom Modular POS  
**Pengguna utama:** Cashier, manager, owner  
**Fitur:**

- Dine-in dan takeaway.
- Product search.
- Cart.
- Variant/modifier selection.
- Item/order note.
- Discount sederhana.
- Tax dan service charge.
- Pilih meja via list pada POS Basic.
- Read-only table layout view pada Cafe Digital/Operations.
- Hold order.
- Cancel/void dengan alasan.
- Manager approval.
- Reprint.
- Manual refund record.
- Manual payment: cash, merchant QRIS, transfer, EDC, other.
- Mixed payment sederhana.
- Open/close shift.
- Opening cash.
- Cash in/out.
- Counted cash dan variance.

**Design-system needs:**

- POS full-height shell;
- product grid/list;
- search input;
- cart panel;
- quantity stepper;
- modifier sheet/dialog;
- order note field;
- discount/tax/service row;
- payment method selector;
- payment confirmation dialog;
- receipt/reprint action;
- shift open/close forms;
- variance alert.

**Data guard:** POS tidak menampilkan cost/HPP, finance profit, customer private detail, payment provider payload, idempotency key, atau internal IDs. Payment confirmation dan shift closing wajib server acknowledgement.

## 9. Table Layout dan QR Self-Order

**Availability:** Cafe Digital, Cafe Operations, Custom Modular Table Layout/Self-Order  
**Pengguna utama:** Owner, manager, cashier, waiter, customer/guest  
**Fitur staff:**

- Floor/lantai.
- Area opsional.
- Service table.
- Label meja.
- Capacity.
- Bentuk sederhana: round, square, rectangle.
- Grid position dan grid size.
- Active state dan display order.
- Table layout editor per lantai dengan drag-and-drop snap-to-grid.
- POS read-only layout dengan status meja realtime.
- QR token per meja.
- Generate, print/download, revoke, dan rotate QR.
- Open/close table session.
- Pindah meja.
- Beberapa order batch dalam satu table session.
- Satu bill per table session pada UI Version 1.

**Fitur customer:**

- Scan QR meja.
- Resolver QR ke outlet dan label meja publik.
- Guest menu.
- Cart.
- Variant/modifier.
- Note.
- Submit order.
- Pesan lagi.
- Lihat status pesanan.
- Minta bill.
- Klaim sudah membayar dengan status verifying; kasir tetap verifikasi.

**Tidak termasuk Version 1:**

- Editor denah bangunan.
- Dinding, pintu, jendela, bar, dekorasi, background image.
- Arbitrary shape dan rotasi bebas.
- Full split bill UI.

**Design-system needs:**

- floor selector;
- table tile;
- table layout canvas;
- drag/keyboard movement;
- bounds/overlap validation;
- QR manager;
- print/download action;
- customer QR context;
- self-order mobile menu/cart;
- order-status tracker;
- request-bill control.

**Data guard:** customer tidak boleh menerima raw QR token, URL internal, internal table ID, floor/grid/coordinate layout, session/customer ID, payment data, atau audit metadata. Staff canvas hanya mengubah posisi grid, bukan order/session.

## 10. Kitchen Display System

**Availability:** Cafe Digital, Cafe Operations, Custom Modular KDS  
**Pengguna utama:** Kitchen staff, manager  
**Fitur:**

- Unified queue dari POS dan QR.
- Status: new, accepted, preparing, ready, served, completed.
- Kitchen ticket.
- Item quantity/name.
- Modifier.
- Note.
- Allergy/special note bila tersedia.
- Source dan table label.
- Elapsed time dari server/read model.
- SLA state read-only.
- Audio/visual new-ticket alert.
- Audio enable/muted/blocked state.
- Reconnect/refetch status.
- Riwayat hari berjalan.
- Satu station per outlet pada MVP.
- Future: multi-station routing kitchen/bar/dessert/packing.

**Design-system needs:**

- KDS kiosk shell;
- ticket grid;
- touch-size action;
- timer/SLA badge;
- new-ticket alert;
- connection status bar;
- history tab;
- large readable typography;
- light/dark and reduced-motion handling.

**Data guard:** KDS hanya menerima kitchen read model. Jangan tampilkan harga, HPP, payment, phone, customer identity, token, namespace/socket payload, event payload, internal ticket/order/table ID, atau audit metadata.

## 11. Inventory Basic

**Availability:** Cafe Operations, Custom Modular Inventory Basic  
**Pengguna utama:** Inventory staff, manager, owner  
**Fitur:**

- Ingredient/item master.
- Category.
- Unit dan conversion dasar.
- Supplier.
- Minimum stock.
- Recipe/BOM per menu.
- Opening stock.
- Stock in/out.
- Adjustment.
- Stock opname.
- Waste.
- Transfer outlet.
- Purchasing sederhana.
- Goods receipt/penerimaan barang.
- Auto-consumption dari order.
- Cancellation reversal sebelum produksi.
- Waste setelah produksi.
- Stock ledger.
- Low-stock alert.
- Estimasi HPP.

**Future advanced:**

- Multi-warehouse.
- Batch dan expiry.
- Purchase request dan approval.
- Purchase order formal dan retur.
- Forecasting.
- Central kitchen.
- Supplier portal.

**Design-system needs:**

- inventory item table;
- unit/conversion form;
- stock indicator;
- movement row;
- stock adjustment form;
- stocktake workflow;
- waste form;
- transfer form;
- supplier and purchase forms;
- recipe/BOM editor;
- low-stock alert.

**Data guard:** stock movement tidak dihapus permanen. Stock adjustment, financial/stock operation, dan transfer wajib server acknowledgement. Jangan jadikan calculated balance/cost sebagai user-entered field.

## 12. Finance Basic

**Availability:** Cafe Operations, Custom Modular Finance Basic  
**Pengguna utama:** Owner, finance staff, manager  
**Fitur:**

- Sales revenue otomatis dari bill/payment valid.
- Other income.
- Operational expense.
- Expense category.
- Attachment opsional.
- Cashbook.
- Cashier-shift reconciliation.
- Rekap payment method.
- Manual reconciliation untuk cash, QRIS, transfer, EDC.
- Estimated HPP.
- Gross profit.
- Operational expense summary.
- Operating profit.
- Report per outlet.
- Consolidated tenant report.

**Future advanced:**

- Chart of accounts.
- Journal.
- Ledger.
- Balance sheet.
- Tax.
- Asset depreciation.
- Closing period.
- Formal accounting integration.

**Design-system needs:**

- finance dashboard metrics;
- money/date filter bar;
- cashbook table;
- expense/income forms;
- attachment field;
- reconciliation panel;
- shift summary;
- report table;
- chart wrapper;
- estimated-label pattern.

**Data guard:** Finance Basic harus diberi label estimasi operasional, bukan accounting formal. HPP/margin tidak bocor ke POS, KDS, customer, atau catalog publik.

## 13. Customer Basic dan CRM Roadmap

**Availability:** Cafe Operations, Custom Modular Customer Basic  
**Pengguna utama:** Owner, manager, cashier bila berizin  
**Fitur MVP/basic:**

- Customer name opsional.
- Phone opsional.
- Note.
- Transaction history.
- Total visits.
- Total purchase.
- Customer order-status page untuk self-order.

**Future CRM:**

- Loyalty.
- Membership tier.
- Voucher personal.
- Segmentasi.
- Campaign.
- Feedback.
- Promotion engine advanced.

**Design-system needs:**

- customer list;
- customer detail;
- optional identity capture;
- history timeline/table;
- privacy-safe summary metrics;
- CRM locked/future state.

**Data guard:** customer data terisolasi per tenant. Customer identity/contact tidak diberikan ke KDS, table layout customer context, atau surface yang tidak membutuhkan PII.

## 14. Reports dan analytics

**Availability:** POS Basic ke atas untuk sales basic; Cafe Digital/Operations menambah operational reports; Cafe Operations menambah inventory/finance reports  
**Pengguna utama:** Owner, manager, finance, platform admin untuk usage  
**Fitur:**

- Sales harian/mingguan/bulanan.
- Sales per outlet, product, category, cashier, channel, dan payment method.
- Discount, cancel, refund, tax, service charge.
- Shift variance.
- Cashier order vs table QR order.
- Self-order count dan conversion.
- Order-to-accepted dan order-to-ready.
- Table-session summary.
- Stock, movement, low stock, waste, purchase, estimated HPP.
- Income, expense, gross profit, operating profit.
- Consolidated multi-outlet report.
- Export dan scheduled report pada roadmap.

**Design-system needs:**

- dashboard metric card;
- date range picker;
- outlet/channel/payment filters;
- segmented report tabs;
- data table;
- chart;
- export action;
- no-data state;
- estimation/disclaimer label.

**Data guard:** report hanya menampilkan data outlet/tenant yang boleh diakses user. Jangan tampilkan raw IDs, raw calculation payload, atau data tenant lain.

## 15. PWA, device mode, dan offline boundary

**Availability:** Merchant PWA untuk POS, KDS, Backoffice, Inventory; customer self-order sebagai mobile web dari QR  
**Pengguna utama:** Cashier, kitchen, owner/manager, inventory staff, customer  
**Fitur:**

- Merchant app manifest.
- Installability.
- Application shell caching.
- Device mode: POS, KDS, Backoffice, Inventory.
- Last-known menu cache.
- Draft cart cache.
- Last-known display untuk UI.
- Server acknowledgement untuk submit order, payment confirmation, refund, stock adjustment, approval, shift closing.

**Tidak termasuk Version 1:**

- Full offline synchronization.
- Offline payment.
- Offline stock operation.
- Native Android/iOS app.

**Design-system needs:**

- install prompt/banner;
- device-mode selector;
- offline/online indicator;
- stale data banner;
- cached menu/cart state;
- retry state;
- server-acknowledgement error.

**Data guard:** jangan cache `/api/`, payment, stock operation, token, audit data, atau operational payload yang membutuhkan server acknowledgement.

## 16. Integrated Payment Add-on - future

**Availability:** Add-on Future; membutuhkan kerja sama dan approval PJP/payment gateway  
**Pengguna utama:** Merchant owner, cashier, finance, customer  
**Fitur direncanakan:**

- Merchant/sub-account onboarding.
- KYC status.
- Payment provider configuration per tenant/outlet.
- Dynamic QRIS pada POS dan Self-Order.
- Automatic amount dan external reference.
- Webhook signature verification.
- Idempotency.
- Payment state: pending, paid, expired, failed, refund pending, refunded.
- Polling/reconciliation fallback.
- Settlement dan payout report.
- Refund dan dispute workflow.
- Optional split platform fee bila disetujui PJP.
- Manual payment fallback.

**Tidak termasuk:**

- Wallet.
- Penyimpanan saldo konsumen.
- Pinjaman/paylater.
- Jaminan settlement di luar SLA PJP.
- Automatic use of static QRIS tanpa dukungan acquirer.

**Design-system needs nanti:**

- provider setup wizard;
- KYC status tracker;
- dynamic QR payment screen;
- webhook/reconciliation status;
- refund/dispute workflow;
- settlement report;
- payment fallback alert.

**Data guard:** API key, webhook secret, signature, provider raw payload, customer financial sensitive data, and settlement internal payload tidak dirender.

## 17. Future roadmap di luar MVP

Fitur berikut perlu disiapkan sebagai konsep desain jangka panjang, tetapi jangan dibuat sebagai flow MVP sebelum ada PRD/gate baru:

- Advanced Inventory dan Purchasing.
- Finance/Accounting Advanced.
- Promotion engine.
- Loyalty dan CRM advanced.
- Reservation.
- Delivery.
- Marketplace.
- Public API.
- Franchise/multi-brand advanced management.
- Central kitchen dan supply chain.
- White-label.
- Custom domain.
- Open API dan partner ecosystem.
- Forecasting dan recommendation.
- Enterprise security.
- MFA.
- Hardware integration lanjutan.
- Push/email/WhatsApp notification.

## 18. Kebutuhan design system lintas fitur

Bagian ini adalah daftar kebutuhan component/pattern yang sebaiknya dipertimbangkan saat menyusun ulang `design-system.md`.

### 18.1 Shell dan navigation

- Platform admin shell.
- Merchant backoffice shell.
- POS shell.
- KDS kiosk shell.
- Customer mobile self-order shell.
- Tenant/outlet context header.
- Device mode selector.
- Entitlement-aware navigation.
- Locked/upgrade module state.

### 18.2 Form dan input

- Text input, textarea, search.
- Select/combobox.
- Checkbox, radio, switch.
- Segmented control.
- Quantity stepper.
- Money input.
- Percent input.
- Date/date-range picker.
- File/image upload.
- Attachment field.
- QR/print controls.
- Reason/approval dialog.

### 18.3 Data display

- Dense table.
- List row.
- Metric card.
- Status badge.
- Timeline.
- Audit-safe event row.
- Empty/loading/error state.
- Alert/banner.
- Tooltip.
- Drawer/detail panel.

### 18.4 Operational surfaces

- POS product grid/list.
- Cart panel.
- Modifier picker.
- Payment method selector.
- Shift summary.
- Table tile.
- Table layout canvas.
- KDS ticket.
- Connection/retry status.
- Stock indicator.
- Movement row.
- Recipe/BOM editor.
- Finance chart/report table.
- Customer history row.

### 18.5 Status vocabulary

Design system perlu menyiapkan status tone yang konsisten untuk:

- tenant/subscription: trial, active, grace, suspended, terminated;
- order: draft, submitted, accepted, preparing, ready, served, completed, cancelled;
- payment: unpaid, verifying, paid, refund pending, refunded, expired, failed;
- table: available, occupied, reserved/closing, inactive;
- KDS: new, accepted, preparing, ready, served, completed;
- stock: ok, low, out, adjustment, waste, transfer;
- connection: online, offline, connecting, stale, reconnecting;
- audit/action: pending approval, approved, rejected, blocked.

### 18.6 Privacy dan data slicing

Setiap komponen fitur wajib memiliki field inventory:

- **User input:** data yang boleh diubah user pada action tersebut.
- **Read-only display:** konteks resmi dari sistem.
- **Derived display:** hasil kalkulasi yang tidak dikirim sebagai input user.
- **Hidden/out of scope:** ID internal, token, audit metadata, raw payload, data tenant lain, dan data yang tidak relevan.

Aturan penting:

- satu fakta hanya punya satu lokasi utama;
- jangan menjadikan status, timestamp, actor, audit, total, HPP, margin, atau calculated value sebagai editable field kecuali workflow memang memiliki mutasi itu;
- hidden ID hanya dipakai untuk callback, tidak menjadi teks UI;
- sensitive data hanya muncul pada role/surface yang punya tujuan produk jelas;
- backend tetap sumber security, UI hanya presentation gate.

## 19. Dependency ringkas antar module

| Module                  | Hard dependency                      | Optional bridge                          |
| ----------------------- | ------------------------------------ | ---------------------------------------- |
| Cafe Profile            | Catalog Core                         | Customer Basic                           |
| POS                     | Catalog, Order, Bill, Payment Ledger | Inventory, Finance                       |
| Table Layout/Self-Order | Cafe Profile, Catalog, Order, Bill   | KDS, Customer, Integrated Payment        |
| KDS                     | Order Core                           | Multi-station routing                    |
| Inventory Basic         | Catalog Core                         | Order consumption, Finance HPP           |
| Finance Basic           | Order, Bill, Payment Ledger          | Inventory HPP                            |
| Customer Basic          | Tenancy Core                         | Order history                            |
| Integrated Payment      | POS atau Self-Order                  | Settlement, reconciliation, platform fee |

Dependency invalid harus ditolak oleh backend dan tidak hanya disembunyikan oleh frontend.

## 20. Checklist sebelum merevisi design-system.md

- Pastikan setiap module di dokumen ini punya minimal satu layout pattern.
- Pisahkan shell platform admin, merchant backoffice, POS, KDS, dan customer mobile.
- Siapkan komponen untuk subscription/entitlement locked state.
- Siapkan pola data table yang dense untuk admin/backoffice.
- Siapkan pola touch-first untuk POS dan KDS.
- Siapkan pola mobile-first untuk customer self-order.
- Siapkan status vocabulary lintas order/payment/KDS/stock/subscription.
- Siapkan money/quantity/timer numeric style.
- Siapkan chart/report pattern dengan label estimasi untuk Finance Basic.
- Siapkan pattern untuk server acknowledgement, offline boundary, retry, stale state, dan reconnect.
- Terapkan field inventory dan data guard sebelum menulis JSX fitur.
