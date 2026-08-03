# Design System App Audit

Tanggal: 2026-08-03

Tujuan audit ini adalah memisahkan status nyata aplikasi dari status component bank. Banyak komponen domain sudah tersedia dan diuji di Storybook, tetapi belum semuanya sudah dipasang sebagai route aplikasi end-to-end.

## Ringkasan Status

- Design-system foundation sudah menjadi source of truth: token warna, typography, spacing, radius, icon, shell pattern, data guard, dan breakdown modul ada di `design-system.md` serta `design-system-modules.md`.
- Homepage `/` sudah memakai device-mode shell baru dan navigasi utama ke POS, KDS, Catalog, dan Inventory sudah tersedia.
- Backoffice Catalog sudah menjadi route aplikasi nyata melalui `/backoffice/catalog`.
- POS, KDS, dan Inventory sudah punya route, tetapi masih berupa surface ringkas, belum memakai layar domain penuh dari component bank.
- Finance, Customer, Table Management, QR Self-Order, Platform Admin, Reports, Settings, dan beberapa modul lain masih lebih siap di Storybook/component bank daripada di route aplikasi.
- Tahap 19 reliability/security masih aktif: `Rate limit login dan QR submit`, `CSRF/session/security header`, dan `Audit critical action` belum selesai.

## Route Aplikasi Saat Ini

| Route | Status | Catatan |
| --- | --- | --- |
| `/` | Selaras sebagian besar | Device-mode shell baru, sidebar, topbar, dan 4 entry fitur sudah valid. |
| `/design-system` | Dev/reference route | Cocok untuk review foundation, bukan route bisnis. |
| `/color-bank` | Dev/reference route | Token preview, bukan route bisnis. |
| `/typography` | Dev/reference route | Typography preview, bukan route bisnis. |
| `/foundation` | Dev/reference route | Layout/icon preview, bukan route bisnis. |
| `/backoffice/catalog` | Route bisnis aktif | Catalog backoffice sudah paling dekat dengan aplikasi nyata. |
| `/pos` | Placeholder operasional | Baru menjelaskan server acknowledgement dan navigasi. Belum POS shell penuh. |
| `/kds` | Placeholder operasional | Baru menjelaskan KDS/read model. Belum KDS kiosk shell penuh. |
| `/inventory` | Placeholder operasional | Baru menjelaskan stock acknowledgement. Belum inventory shell penuh. |

## Component Bank Yang Sudah Siap Untuk Dipasang

| Area | Komponen/story tersedia | Kesiapan route |
| --- | --- | --- |
| POS | `PosCatalog`, `PosCart`, `PosModifierPicker`, `PosPayment`, `PosManualFlow`, `PosShift` | Siap menjadi kandidat route redesign pertama. |
| KDS | `KdsTicket` dengan timer/SLA, alert, reconnect/refetch, history | Siap menjadi kandidat route setelah POS. |
| Inventory | `InventoryItemUnit`, `InventoryStock`, `InventoryOperations`, `InventoryOrderFlow`, `RecipeBom` | Siap menjadi route setelah POS/KDS. |
| Table Layout dan QR | `FloorSelector`, `TableTile`, `TableLayoutCanvas`, `TableLayoutTools`, `TableLayoutTray`, `TableQr`, `CustomerQrContext` | Komponen banyak, tetapi route staff/customer belum ada. |
| Finance | `FinanceMetric`, `FinanceBasicSummary`, `FinanceProfitEstimate`, `FinanceReconciliationSummary`, `FinanceValidatedReport` | Komponen siap, route Finance belum ada. |
| Customer | `CustomerBasicProfile`, `CustomerOrderSurface`, `CustomerQrContext` | Komponen siap, route customer/staff belum ada. |
| Platform Admin | `PlatformTenantSubscriptionMaster`, `PlatformEntitlementMatrix`, `PlatformSupportAudit` | Komponen siap, route platform admin penuh belum ada. |

## Kesenjangan Terhadap Design-System Baru

1. Route bisnis belum lengkap.
   Komponen domain sudah ada di Storybook, tetapi belum dipasang menjadi screen aplikasi per shell: POS Shell, KDS Kiosk Shell, Merchant Backoffice Shell, Platform Admin Shell, dan Customer Mobile Shell.

2. POS route belum mengikuti `design-system.md` section 3.2.
   `/pos` belum memakai layout 3 kolom Order Line: sidebar navigasi, catalog/filter/menu grid, dan cart/context panel kanan.

3. KDS route belum mengikuti section 3.3.
   `/kds` belum full-screen kiosk dengan ticket grid, reconnect bar, audio readiness/alert state, dan history.

4. Inventory route belum mengikuti section 3.1 dan modul 15.
   `/inventory` belum memakai table/list, stock indicators, movement rows, operation forms, dan recipe/order waste components.

5. Finance route belum ada.
   Finance component bank sudah mencakup metric, summary, reconciliation, profit estimate, dan validated report, tetapi belum dipasang sebagai `/finance`.

6. Customer/QR Self-Order route belum ada.
   Komponen customer order dan QR context sudah ada, tetapi route mobile customer belum tersedia.

7. Platform Admin route belum ada.
   Komponen tenant/subscription, entitlement, dan support audit tersedia, tetapi belum ada shell route platform admin.

8. Security checkpoint masih belum selesai.
   Rate limit, CSRF/session/security header, dan audit critical action masih perlu implementasi API/source ketika write access ke source folder normal.

## Urutan Redesign Yang Disarankan

1. POS route checkpoint
   Ubah `/pos` dari placeholder menjadi POS Shell berbasis komponen yang sudah ada: category rail, product grid, cart summary, payment method cash/QRIS manual, dan server acknowledgement state. Jangan membuat API order baru pada checkpoint ini.

2. KDS route checkpoint
   Ubah `/kds` menjadi KDS Kiosk Shell dengan ticket grid, reconnect/refetch state, dan safe read model. Jangan tampilkan harga, HPP, payment, customer identity, token, atau ID internal.

3. Inventory route checkpoint
   Ubah `/inventory` menjadi merchant backoffice section untuk stock overview, movement rows, dan operation forms. Semua mutasi tetap callback/server acknowledgement, bukan optimistic success.

4. Finance route checkpoint
   Tambah `/finance` berbasis metric/summary/reconciliation/report components. Semua HPP/profit harus berlabel estimasi.

5. Table Management route checkpoint
   Tambah route staff untuk floor selector, canvas, table QR manager, dan safe table controls. QR token mentah tidak boleh tampil.

6. Customer QR route checkpoint
   Tambah route mobile customer untuk QR resolution, menu, cart, submit order, dan status. Data customer hanya public/safe model.

7. Platform Admin route checkpoint
   Tambah route platform-only untuk tenant/subscription/entitlement/support audit dengan guard privasi yang sudah ada di component bank.

## Gate Untuk Setiap Redesign Route

- Field inventory sebelum JSX: user input, read-only display, derived display, hidden/out of scope.
- Gunakan shell yang ditetapkan di `design-system.md` section 3.
- Gunakan komponen dari `packages/ui` lebih dulu sebelum membuat markup baru.
- Semua menu/link/action terlihat harus bisa diklik atau jelas disabled.
- Setiap route baru perlu test terkait, HTTP route smoke, dan responsive/light/dark check.
- Jangan menampilkan internal ID, raw token, provider payload, audit payload, actor ID, session data, atau field sensitif lain.

## Catatan Blocker Saat Audit

Pada saat audit ini dibuat, write access ke subfolder source seperti `apps/web/src`, `apps/api/src`, dan `packages/ui/src` masih ditolak oleh environment. File root masih bisa ditulis. Karena itu audit ini tidak mengubah source aplikasi.
