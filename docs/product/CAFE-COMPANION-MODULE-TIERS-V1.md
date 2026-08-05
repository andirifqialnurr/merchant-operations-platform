# Product Requirement Specification

# Cafe Companion Pro — Module Tiers and Capability Matrix

**Versi dokumen:** 1.2  
**Status:** Draft baseline produk dan entitlement  
**Tanggal:** 5 Agustus 2026  
**Dokumen induk:** CAFE-COMPANION-PRD-V2-MODULAR-PLATFORM.md  
**Pendamping:** CAFE-COMPANION-PACKAGES-LIMITS-V1.md

---

## 1. Tujuan dokumen

Dokumen ini menjawab dua pertanyaan:

1. Berapa level fitur yang dimiliki setiap product module?
2. Capability apa yang tersedia pada setiap level?

Dokumen ini tidak menentukan harga. Nilai limit di sini adalah rekomendasi default ketika tier dibeli secara standalone. Paket gabungan dapat memberikan limit berbeda tanpa mengubah capability tier. Nilai efektif workspace selalu berasal dari snapshot subscription, add-on, dan override yang berlaku.

---

## 2. Aturan tier

Semua product module menggunakan tiga tingkat yang konsisten:

| Tier | Posisi produk | Prinsip |
|---|---|---|
| Basic | Operasi inti untuk bisnis kecil atau penggunaan standalone sederhana | Sedikit konfigurasi, satu alur utama, report dasar |
| Pro | Operasi multi-location dan kontrol manajerial | Approval, automation, integrasi, report lebih dalam |
| Advanced | Kebutuhan kompleks atau enterprise | Policy lanjutan, konsolidasi, custom integration, governance |

Aturan wajib:

- Tier menentukan capability, bukan ukuran bisnis semata.
- Limit angka disimpan terpisah dari tier.
- Capability tier lebih tinggi mewarisi capability tier di bawahnya kecuali dinyatakan lain.
- Paket boleh menggunakan tier berbeda untuk setiap modul.
- Add-on tidak boleh diam-diam mengubah seluruh tier.
- Fitur keselamatan, audit, isolation, export data, dan correction tidak boleh dijadikan premium gate.
- Advanced bukan janji Release 1. Status delivery tetap mengikuti roadmap pada PRD induk.
- Nama UI dapat diterjemahkan, tetapi key tier dan capability harus stabil.

### 2.1 Status delivery

| Status | Makna |
|---|---|
| R1 | Ditargetkan tersedia pada Release 1 |
| R1+ | Dapat menyusul setelah alur Basic stabil |
| Future | Belum menjadi komitmen delivery |
| External gate | Membutuhkan mitra, legal, compliance, atau sertifikasi |

### 2.2 Responsive delivery contract

Responsive adalah baseline kualitas seluruh capability web dan **bukan capability premium**. Tier Basic, Pro, maupun Advanced tidak boleh memiliki versi fitur yang sengaja tidak dapat digunakan pada salah satu viewport yang didukung hanya untuk mendorong upgrade.

Kontrak global mengikuti PRD induk `33.6`:

| Kelas | Width CSS | Prinsip |
|---|---:|---|
| **Small (S)** | `320–767px` | Single-column/touch-first; detail melalui card, sheet, atau page |
| **Medium (M)** | `768–1279px` | Compact multi-pane bila cukup; touch/mouse hybrid |
| **Large (L)** | `≥1280px` | Multi-column dan management density lebih tinggi |

Aturan tier:

- Jika capability tersedia pada suatu tier, primary read dan mutation flow capability tersebut harus dapat digunakan pada S/M/L kecuali capability secara eksplisit membutuhkan hardware/surface khusus.
- Perbedaan layout karena viewport **bukan** perbedaan entitlement. Contoh: Finance Basic tetap Finance Basic ketika transaction table berubah menjadi cards pada Small.
- Package atau add-on boleh mengubah capacity, tetapi tidak boleh membuka “mobile responsive” atau “tablet responsive” sebagai capability berbayar.
- Capability Pro/Advanced yang belum ada di Basic tetap gated seperti biasa, tetapi setelah ter-entitle UI capability tersebut harus mempunyai responsive state.
- Responsive state tidak membuat business logic versi kedua; semua viewport memanggil application use case/API yang sama.
- Baseline QA setiap page R1: `390×844` (S), `1024×768` (M), dan `1440×900` (L), serta boundary width yang ditetapkan PRD induk.

### 2.3 Responsive expectation per module family

| Module family | Small | Medium | Large |
|---|---|---|---|
| Catalog/Menu | Cards/rows + full-screen edit | Compact grid/table + drawer | Grid/table + side panel |
| POS | Catalog primary + cart summary/sheet/page | Compact catalog + cart; landscape tablet target | Persistent catalog + cart |
| Floor/Table | Live view + list fallback; simplified editor form/sheet | Touch canvas + collapsible panels | Full canvas + palette/property panel |
| KDS | 1-column prioritized queue | 2–3 column typical | Adaptive multi-column grid |
| Inventory | Cards + single-column mutations | Compact table/cards | Dense table/list |
| Business Finance | KPI stack + transaction cards | 2-column KPI + compact transactions | Multi-column KPI/report + transaction table |
| HC | Employee/attendance cards + mobile schedule | Compact table/calendar + drawer | Table/calendar + detail panel |
| Customer/Self-Order | Mobile-first 1–2 column | 2–3 column catalog | Centered multi-column catalog |
| Reports/Analytics | Single-column charts/KPI | 2-column/stack | Multi-column dashboard |

Tabel ini mengatur presentation contract saja. Capability, permission, limit, audit, dan data ownership tetap sama di semua viewport.

---

## 3. Catalog, Profile, and Menu

### 3.1 Tujuan

Mengelola identitas bisnis, menu atau produk, harga, modifier, dan availability. Catalog dapat mendukung POS, Self-Order, Inventory bridge, atau public profile.

### 3.2 Capability matrix

| Area | Basic | Pro | Advanced |
|---|---|---|---|
| Business profile | Nama, logo, alamat, jam buka, kontak | Profil per location, social link, announcement | Multi-brand governance dan approval |
| Product | Produk, kategori, variant sederhana, SKU opsional, harga, foto | Bundle sederhana, advanced variant, bulk edit | Product versioning dan approval |
| Modifier | Required/optional modifier sederhana | Nested rule terbatas dan quantity rule | Conditional modifier dan rule kompleks |
| Availability | Aktif/nonaktif manual | Jadwal availability dan sold-out per location | Rule per channel, time, dan inventory signal |
| Pricing | Harga utama dan override per location | Harga per channel dan scheduled price | Pricing rule dan customer segment |
| Tax/service metadata | Konfigurasi sederhana | Override per location/channel | Rule bertingkat dan effective dating |
| Import/export | CSV template dasar | Bulk import tervalidasi dan error report | Managed migration dan API bulk |
| Recipe bridge | Link recipe/BOM sederhana bila Inventory aktif | Versioned recipe, yield, dan substitute | Central recipe governance |
| Public catalog | Profil dan menu dasar | Custom section, highlight, theme ringan | Custom domain/branding dan content workflow |
| Audit | Perubahan penting | Field-level history pada price/availability | Approval trail dan compare version |

### 3.3 Capability keys utama

| Tier mulai | Capability |
|---|---|
| Basic | catalog.profile.manage |
| Basic | catalog.product.manage |
| Basic | catalog.category.manage |
| Basic | catalog.modifier.basic |
| Basic | catalog.availability.manual |
| Basic | catalog.public.read |
| Basic | catalog.variant.manage |
| Pro | catalog.bundle.manage |
| Pro | catalog.availability.schedule |
| Basic | catalog.price.by_location |
| Pro | catalog.price.by_channel |
| Basic | catalog.recipe.bind |
| Pro | catalog.import.bulk |
| Advanced | catalog.price.rule |
| Advanced | catalog.workflow.approve |
| Advanced | catalog.version.manage |
| Advanced | catalog.brand.centralize |

### 3.4 Default limit standalone

| Dimension | Basic | Pro | Advanced |
|---|---:|---:|---:|
| Active products | 300 | 3.000 | 25.000 |
| Categories | 30 | 200 | 1.000 |
| Modifier groups | 30 | 300 | 2.000 |
| Price lists | 3 | 10 | Custom |
| Product media storage | 1 GB | 10 GB | Custom |

### 3.5 Delivery

- Basic: R1.
- Pro: R1+ secara bertahap.
- Advanced: Future.

---

## 4. POS and Sales

### 4.1 Tujuan

Menyediakan order entry kasir, pembayaran tercatat, receipt, shift kas, serta event resmi untuk KDS, Inventory, Finance, dan Customer.

### 4.2 Capability matrix

| Area | Basic | Pro | Advanced |
|---|---|---|---|
| Order/cart | Create order, item, modifier, note, hold/resume | Merge/split order dan open-bill control | Workflow order khusus dan custom channel |
| Payment | Cash, metode manual, dan mixed payment sederhana | Split/partial payment rule dan tender control | Integrated payment orchestration |
| Receipt | Preview, print, reprint | Template per location, email/WhatsApp adapter | Custom fiscal/enterprise connector |
| Discount | Fixed/percent dengan permission | Rule, reason, limit, approval | Campaign/pricing engine integration |
| Cancel/void/refund | Cancel, refund record sederhana, manager approval | Refund penuh/sebagian dan configurable approval | Multi-step approval dan centralized policy |
| Shift | Open/close, expected vs actual cash | Blind close, cash movement, approval | Central treasury/cash control |
| Device | Register activation sederhana | Device assignment dan remote revoke | Fleet policy dan managed configuration |
| Offline | Reconnect/refetch; tidak ada offline mutation | Limited offline order queue setelah hardening | Advanced offline sync dan conflict policy |
| Report | Sales, payment, shift, discount, void | Cashier/product/channel comparison | Custom metric dan enterprise export |
| Integration | Event internal | External webhook dan accounting connector | Custom connector dan higher API quota |

### 4.3 Capability keys utama

| Tier mulai | Capability |
|---|---|
| Basic | pos.order.create |
| Basic | pos.order.cancel |
| Basic | pos.bill.hold |
| Basic | pos.payment.manual |
| Basic | pos.payment.mixed |
| Basic | pos.receipt.print |
| Basic | pos.shift.manage |
| Basic | pos.discount.basic |
| Basic | pos.refund.simple |
| Basic | pos.approval.manager |
| Basic | pos.report.basic |
| Pro | pos.bill.split |
| Pro | pos.payment.split |
| Pro | pos.refund.partial |
| Pro | pos.approval.manage |
| Pro | pos.shift.blind_close |
| Pro | pos.webhook.outbound |
| Advanced | pos.policy.central |
| Advanced | pos.offline.advanced |
| Advanced | pos.integration.custom |
| Advanced | pos.payment.integrated |

### 4.4 Default limit standalone

| Dimension | Basic | Pro | Advanced |
|---|---:|---:|---:|
| Register devices | 2 | 10 | Custom |
| Completed sales per billing cycle | 5.000 | 50.000 | Custom |
| Active cashiers | 5 | 50 | Custom |
| Receipt templates | 1 | 10 | Custom |
| External webhook endpoints | 0 | 5 | Custom |

### 4.5 Delivery

- Basic: R1.
- Pro: R1+; split bill/refund mengikuti prioritas pilot.
- Advanced: Future.
- Integrated payment: External gate.

---

## 5. Floor, Table, and Customer Ordering

### 5.1 Tujuan

Mengelola struktur floor/area, layout meja, operasi table session, QR menu, order dari meja, dan status order customer tanpa mewajibkan aplikasi native. `Floor` adalah struktur fleksibel, bukan hardcode Indoor/Outdoor: user membuat Floor (`Lantai 1`, `Lantai 2`, `Rooftop`) lalu Area (`Indoor`, `Outdoor`, `Smoking`, `VIP`, dan sebagainya).

### 5.2 Capability matrix

| Area | Basic | Pro | Advanced |
|---|---|---|---|
| Struktur lokasi | Multi-floor dan user-defined area; default Main Floor/Main Area | Service zone dan bulk layout management | Complex venue topology/custom policy |
| Table setup | Square, rectangle, round; label, capacity, visual size, active/inactive | Resizable footprint dan advanced table attributes | Custom shape/layout rule |
| Kursi | Auto-visualized dari capacity/shape | Advanced seat arrangement visual | Assigned-seat/service model bila dibutuhkan |
| Layout editor | Drag, snap-to-grid, 0/90-degree rotation | Multi-select, copy layout, service-zone mapping, richer resizing | Background floor plan/free rotation/custom editor |
| Live table view | Filter floor/area; available/occupied/closing/cleaning/inactive | Operational service-zone view dan richer utilization state | Reservation/waitlist-aware optimization |
| Table session | Open, guest count, multi-order batch, move, close | Merge/split beberapa meja dalam satu session | Reservation/group orchestration |
| QR | Rotating token per meja, print/download, rotate, revoke | Session policy dan branded QR | Custom-domain journey |
| Ordering | Browse, cart, submit, note, reorder, waiter call, request bill | Group order dan configurable service flow | Advanced orchestration |
| Customer status | Received, preparing, ready | Realtime milestone dan notification adapter | Custom notification journey |
| Menu | Catalog publik | Channel pricing dan scheduled availability | Personalization/segment rule |
| Moderation | Staff accept/reject | Auto-accept policy dan capacity control | Risk/routing policy |
| Report | Order count dan channel | Conversion, abandonment, service time | Funnel dan cohort advanced |
| Reservation/waitlist | Tidak termasuk | Optional add-on future | Built-in advanced |

### 5.3 Capability keys utama

| Tier mulai | Capability |
|---|---|
| Basic | floor.table.manage |
| Basic | floor.structure.manage |
| Basic | floor.layout.basic |
| Basic | floor.table_session.manage |
| Basic | floor.table_session.move |
| Basic | floor.qr.generate |
| Basic | floor.qr.rotate |
| Basic | self_order.menu.read |
| Basic | self_order.order.submit |
| Basic | self_order.status.read |
| Basic | self_order.reorder |
| Basic | self_order.waiter_call |
| Basic | self_order.payment_request |
| Pro | floor.layout.advanced |
| Pro | floor.service_zone.manage |
| Pro | floor.table_session.merge_split |
| Pro | floor.qr.session |
| Pro | self_order.policy.auto_accept |
| Pro | self_order.group_order |
| Advanced | self_order.brand.custom |
| Advanced | floor.reservation.optimize |

### 5.4 Default limit standalone

| Dimension | Basic | Pro | Advanced |
|---|---:|---:|---:|
| Active tables per location | 50 | 250 | Custom |
| Configured floors/layouts per location | 3 | 10 | Custom |
| Active areas per floor | 10 | 30 | Custom |
| Self-orders per billing cycle | 10.000 | 100.000 | Custom |
| Active QR tokens | 100 | 2.000 | Custom |

### 5.5 Delivery

- Basic: R1. Basic wajib sudah mencakup layout editor sederhana dan Live Table View; bukan sekadar daftar meja.
- Pro: R1+. Merge/split, service zone, advanced editor, dan advanced floor operations.
- Advanced: Future. Reservation/waitlist-aware optimization dan editor venue kompleks.
- Bentuk `SQUARE`, `RECTANGLE`, dan `ROUND` bukan add-on dan tidak boleh dipaywall terpisah dari Basic.
- Jumlah kursi visual bukan usage meter; yang dimeter adalah active service table.

---

## 6. Kitchen Display System

### 6.1 Tujuan

Menerima order dari POS internal, Self-Order, input manual, atau integrasi eksternal dan mengubahnya menjadi kitchen ticket melalui use case yang sama.

### 6.2 Capability matrix

| Area | Basic | Pro | Advanced |
|---|---|---|---|
| Intake | Internal event, manual intake, dan satu API Lite source | Multiple external API/webhook sources | Custom connector dan managed migration |
| Station | Satu station default | Multi-station dan routing rule | Dynamic routing dan load balancing |
| Ticket | Accept, start, ready, served, complete | Item-level bump, recall, transfer station | Course/firing coordination |
| Alert | Audio/visual basic | SLA threshold per station | Escalation policy dan notification |
| Display | Satu standard layout | Expo screen dan configurable view | Custom role/display layout |
| History | Hari berjalan | Search dan retention view lebih panjang | Cross-location analytics |
| Printing | Tidak termasuk | Printer fallback | Managed print routing |
| Analytics | Ticket count dan average wait | Station/item/SLA breakdown | Forecast dan capacity analytics |

### 6.3 Capability keys utama

| Tier mulai | Capability |
|---|---|
| Basic | kds.ticket.manage |
| Basic | kds.intake.internal |
| Basic | kds.intake.manual |
| Basic | kds.intake.api_lite |
| Basic | kds.alert.basic |
| Basic | kds.report.basic |
| Pro | kds.intake.api |
| Pro | kds.station.manage |
| Pro | kds.routing.rule |
| Pro | kds.ticket.item_status |
| Pro | kds.sla.manage |
| Pro | kds.expo.display |
| Pro | kds.print.fallback |
| Advanced | kds.course.manage |
| Advanced | kds.routing.dynamic |
| Advanced | kds.integration.custom |

### 6.4 Default limit standalone

| Dimension | Basic | Pro | Advanced |
|---|---:|---:|---:|
| KDS devices | 2 | 15 | Custom |
| Stations per location | 1 | 10 | Custom |
| Tickets per billing cycle | 10.000 | 100.000 | Custom |
| External intake sources | 1 | 10 | Custom |
| API requests per minute | 60 | 600 | Custom |

### 6.5 Delivery

- Basic: R1.
- Pro: R1+.
- Advanced: Future.

---

## 7. Inventory

### 7.1 Tujuan

Menyediakan stock ledger mandiri serta konsumsi otomatis dari Catalog/POS/KDS bila integration binding diaktifkan.

### 7.2 Capability matrix

| Area | Basic | Pro | Advanced |
|---|---|---|---|
| Item master | Item, category, unit, conversion sederhana | Variant bahan dan bulk management | Attribute/quality specification |
| Stock | Opening, in, out, adjustment, transfer sederhana | Multi-warehouse dan transfer approval | Central inventory network |
| Stocktake | Full stocktake manual | Cycle count dan approval | Blind count dan variance workflow |
| Alert | Minimum stock | Reorder suggestion | Forecast-based replenishment |
| Supplier | Supplier, purchasing, dan goods receipt sederhana | Purchase order formal, history, dan approval | Contract, lead time, supplier score |
| Recipe/BOM | Recipe link dan auto-consumption sederhana bila bridge aktif | Version, yield, dan substitute | Central recipe governance |
| Cost | Last/simple average dan estimasi HPP | Moving average dan variance analysis | Cost method policy dan landed cost |
| Waste | Waste record sederhana | Structured waste dan approval | Waste analytics dan anomaly detection |
| Batch/expiry | Tidak termasuk | Optional add-on future | Batch, expiry, lot traceability |
| Report | Balance, movement, low stock | Usage, purchase, HPP, variance | Forecast, aging, cross-location |

### 7.3 Capability keys utama

| Tier mulai | Capability |
|---|---|
| Basic | inventory.item.manage |
| Basic | inventory.movement.record |
| Basic | inventory.adjustment.record |
| Basic | inventory.stocktake.basic |
| Basic | inventory.alert.low_stock |
| Basic | inventory.report.basic |
| Basic | inventory.transfer.manage |
| Basic | inventory.purchase.manage |
| Basic | inventory.receiving.manage |
| Basic | inventory.recipe.consume |
| Basic | inventory.waste.manage |
| Basic | inventory.cost.estimate |
| Pro | inventory.approval.manage |
| Advanced | inventory.batch.manage |
| Advanced | inventory.expiry.manage |
| Advanced | inventory.forecast |
| Advanced | inventory.central_kitchen |
| Advanced | inventory.cost.policy |

### 7.4 Default limit standalone

| Dimension | Basic | Pro | Advanced |
|---|---:|---:|---:|
| Active inventory items | 500 | 5.000 | Custom |
| Warehouses/stock locations | 2 | 25 | Custom |
| Stock movements per billing cycle | 10.000 | 150.000 | Custom |
| Active suppliers | 50 | 1.000 | Custom |
| Active recipes | 0 | 3.000 | Custom |

### 7.5 Delivery

- Basic: R1.
- Pro: R1+ bertahap; purchase dan recipe bridge dapat dipecah.
- Advanced: Future.

---

## 8. Business Finance

### 8.1 Keputusan jumlah level

Business Finance memakai tiga level komersial. Basic adalah pencatatan operasional, Pro adalah kontrol keuangan manajerial, dan Advanced adalah accounting-ready. Hanya Basic yang menjadi target Release 1.

### 8.2 Posisi tiap level

| Level | Cocok untuk | Bukan |
|---|---|---|
| Basic | Pemilik usaha yang membutuhkan cashbook, income, expense, dan estimasi laba | Software akuntansi formal |
| Pro | Bisnis multi-location yang membutuhkan budget, approval, AP/AR ringan, dan rekonsiliasi | Pengganti proses statutory tanpa review |
| Advanced | Tim finance yang membutuhkan ledger, journal, closing, dan laporan akuntansi | Jaminan kepatuhan pajak otomatis |

### 8.3 Capability matrix

| Area | Basic | Pro | Advanced |
|---|---|---|---|
| Account | Cash, bank, clearing sederhana | Account group, owner, location mapping | Chart of accounts penuh dan versioning |
| Transaction | Income, expense, transfer, adjustment | Recurring, allocation, approval | Double-entry journal dan journal template |
| POS integration | Revenue/payment/shift event | Mapping per channel/location dan exception queue | Central mapping dan connector enterprise |
| Inventory integration | HPP estimate bila bridge aktif | Purchase, waste, variance projection | Inventory accounting dan landed cost bridge |
| Reconciliation | Manual cash/QRIS/transfer/EDC | Bank CSV, matching rule, unresolved queue | Bank feed/custom connector |
| Budget | Tidak termasuk | Budget per category/location dan variance | Multi-dimensional budget dan forecast |
| Receivable/payable | Tidak termasuk | Invoice/bill dan due tracking sederhana | Aging, settlement, credit policy |
| Approval | Permission dasar | Expense/payment approval | Configurable multi-step workflow |
| Closing | Shift cash reconciliation | Monthly review checklist | Period close, lock, reopen approval |
| Report | Income, expense, cashbook, payment, estimate P&L | Budget variance, AP/AR, cashflow, comparison | GL, trial balance, P&L, balance sheet |
| Currency | Satu base currency | Transaction currency dengan manual rate | Multi-currency revaluation policy |
| Asset/tax | Tidak termasuk | Tax tag dan export field | Fixed asset/depreciation dan tax workflow helper |
| Audit | Reversal dan source trace | Approval/reconciliation history | Journal/close governance |

### 8.4 Capability keys utama

| Tier mulai | Capability |
|---|---|
| Basic | business_finance.account.manage |
| Basic | business_finance.income.record |
| Basic | business_finance.expense.record |
| Basic | business_finance.transfer.record |
| Basic | business_finance.transaction.reverse |
| Basic | business_finance.reconcile.manual |
| Basic | business_finance.intake.pos |
| Basic | business_finance.report.basic |
| Pro | business_finance.transaction.recurring |
| Pro | business_finance.budget.manage |
| Pro | business_finance.ap.manage |
| Pro | business_finance.ar.manage |
| Pro | business_finance.approval.manage |
| Pro | business_finance.reconcile.import |
| Pro | business_finance.cost_center.manage |
| Pro | business_finance.report.managerial |
| Advanced | business_finance.coa.manage |
| Advanced | business_finance.journal.manage |
| Advanced | business_finance.period.close |
| Advanced | business_finance.ledger.read |
| Advanced | business_finance.report.accounting |
| Advanced | business_finance.asset.manage |
| Advanced | business_finance.currency.revalue |
| Advanced | business_finance.integration.custom |

### 8.5 Default limit standalone

| Dimension | Basic | Pro | Advanced |
|---|---:|---:|---:|
| Legal entities/business units | 1 | 5 | Custom |
| Financial accounts | 10 | 100 | Custom |
| Finance transactions per billing cycle | 10.000 | 150.000 | Custom |
| Active budgets | 0 | 100 | Custom |
| Recurring rules | 0 | 500 | Custom |
| Bank/import profiles | 0 | 20 | Custom |
| Approval workflows | 0 | 20 | Custom |

### 8.6 Guardrail produk

- Basic selalu diberi label laporan operasional atau estimasi.
- Revenue dari sale dan movement pembayaran tidak boleh dihitung dua kali.
- Refund, reversal, dan correction tetap tersedia saat quota tercapai.
- Advanced baru boleh dipasarkan sebagai accounting-ready setelah definisi accounting, audit, dan review profesional diselesaikan.
- Fitur tax membantu tagging/export; tidak boleh menjanjikan kepatuhan atau pelaporan pajak otomatis tanpa validasi yurisdiksi.
- Integrated payment dan bank feed tetap External gate.

### 8.7 Delivery

- Basic: R1.
- Pro: R1+ setelah source transaction dan reconciliation stabil.
- Advanced: Future.

---

## 9. Human Capital

### 9.1 Keputusan jumlah level

HC memakai tiga level: Basic untuk administrasi karyawan dan jadwal, Pro untuk workforce operations serta mobile attendance, dan Advanced untuk HR suite yang lebih lengkap.

### 9.2 Posisi tiap level

| Level | Cocok untuk | Fokus |
|---|---|---|
| Basic | Bisnis kecil dengan HR admin sederhana | Employee, schedule, attendance web, leave |
| Pro | Bisnis multi-branch dan tenaga kerja shift | Mobile attendance, policy, approval, timesheet |
| Advanced | Perusahaan dengan proses HR lengkap | Payroll, talent, recruitment, integration |

### 9.3 Capability matrix

| Area | Basic | Pro | Advanced |
|---|---|---|---|
| Employee | Master, status, assignment, job/department | Custom field, bulk import, document expiry | Position architecture dan lifecycle workflow |
| User linkage | Invite/link account | Bulk invitation dan self-service profile | SSO/SCIM provisioning |
| Schedule | Shift template dan weekly schedule | Rotation, open shift, swap request | Optimization dan demand planning |
| Attendance | Manual/web event dan correction audit | Mobile check-in, geofence, selfie evidence, device trust | Biometric/device connector dan advanced fraud rule |
| Policy | Working hours dan tolerance sederhana | Late, overtime, break, location policy | Rule engine dan collective policy |
| Leave | Type, balance sederhana, request, approve/reject | Accrual, multi-level approval, blackout/conflict | Complex entitlement and regional policy |
| Timesheet | Daily attendance summary | Timesheet review/approval | Project/job costing integration |
| Payroll | Tidak termasuk | Payroll input/export | Payroll calculation, component, payslip, posting |
| Performance | Tidak termasuk | Tidak termasuk | Goal, review, appraisal |
| Recruitment | Tidak termasuk | Tidak termasuk | Job, candidate, pipeline, onboarding |
| Training/benefit | Tidak termasuk | Document/reminder only | Training, certification, benefit |
| Report | Headcount, attendance, lateness, leave | Overtime, schedule coverage, policy exception | Workforce analytics dan custom export |

### 9.4 Capability keys utama

| Tier mulai | Capability |
|---|---|
| Basic | hc.employee.manage |
| Basic | hc.department.manage |
| Basic | hc.shift.manage |
| Basic | hc.schedule.manage |
| Basic | hc.schedule.publish |
| Basic | hc.attendance.web |
| Basic | hc.attendance.correct |
| Basic | hc.leave.manage |
| Basic | hc.leave.approve |
| Basic | hc.report.basic |
| Pro | hc.employee.import |
| Pro | hc.employee.document.manage |
| Pro | hc.attendance.mobile |
| Pro | hc.attendance.geofence |
| Pro | hc.attendance.selfie_evidence |
| Pro | hc.device.trust |
| Pro | hc.timesheet.approve |
| Pro | hc.leave.accrual |
| Pro | hc.approval.multi_level |
| Pro | hc.report.workforce |
| Advanced | hc.payroll.manage |
| Advanced | hc.payroll.post_finance |
| Advanced | hc.recruitment.manage |
| Advanced | hc.performance.manage |
| Advanced | hc.training.manage |
| Advanced | hc.biometric.integrate |
| Advanced | hc.roster.optimize |
| Advanced | hc.identity.scim |

### 9.5 Default limit standalone

| Dimension | Basic | Pro | Advanced |
|---|---:|---:|---:|
| Active employees | 50 | 500 | Custom |
| Branches/locations | 3 | 25 | Custom |
| HR/admin users | 5 | 30 | Custom |
| Attendance events per billing cycle | 10.000 | 250.000 | Custom |
| Trusted mobile devices | 0 | 600 | Custom |
| Leave policies | 5 | 50 | Custom |
| Approval workflows | 1 | 20 | Custom |

### 9.6 Guardrail produk

- Employee dan user tetap entity terpisah di semua tier.
- Attendance event, correction history, dan audit tidak boleh dihapus karena downgrade.
- Device time, GPS, dan selfie adalah evidence; server menentukan validitas.
- Mobile attendance hanya aktif bila client, privacy notice, consent/policy, dan security review siap.
- Payroll posting ke Finance memakai integration binding; HC tidak menulis tabel Finance.
- Biometric integration dan payroll adalah Future, bukan janji R1.

### 9.7 Delivery

- Basic: R1 simple.
- Pro: Future awal; mobile client dibangun terpisah di atas backend yang sama.
- Advanced: Future.

---

## 10. Customer and CRM

### 10.1 Capability matrix

| Area | Basic | Pro | Advanced |
|---|---|---|---|
| Profile | Nama/phone/note opsional | Field tambahan dan tag | Configurable profile schema |
| History | Visit dan spend projection | Product/channel preference | Cross-location/customer 360 |
| Deduplication | Warning sederhana | Merge workflow | Identity resolution |
| Consent | Consent field foundation | Consent history dan preference | Multi-channel policy |
| Loyalty | Tidak termasuk | Point, tier, voucher sederhana | Rule engine dan partner loyalty |
| Segment | Tidak termasuk | Saved segment | Dynamic/behavior segment |
| Campaign | Tidak termasuk | Manual audience export | Automation dan connector |
| Feedback | Tidak termasuk | Basic feedback | Survey/NPS workflow |
| Report | Visit dan spend summary | Retention dan segment | Cohort/LTV advanced |

### 10.2 Capability keys utama

| Tier mulai | Capability |
|---|---|
| Basic | customer.profile.manage |
| Basic | customer.history.read |
| Basic | customer.report.basic |
| Pro | customer.merge.manage |
| Pro | customer.segment.manage |
| Pro | customer.consent.manage |
| Pro | customer.loyalty.manage |
| Pro | customer.voucher.manage |
| Pro | customer.feedback.manage |
| Advanced | customer.campaign.automate |
| Advanced | customer.identity.resolve |
| Advanced | customer.analytics.advanced |

### 10.3 Default limit standalone

| Dimension | Basic | Pro | Advanced |
|---|---:|---:|---:|
| Active customer profiles | 5.000 | 100.000 | Custom |
| Saved segments | 0 | 100 | Custom |
| Loyalty members | 0 | 100.000 | Custom |
| Campaign sends per billing cycle | 0 | 0; add-on required | Custom |

### 10.4 Delivery

- Basic: R1 simple.
- Pro dan Advanced: Future.
- Campaign membutuhkan consent, messaging provider, dan compliance gate.

---

## 11. Reports and Analytics

### 11.1 Prinsip

Report dasar milik suatu modul selalu termasuk di tier modul tersebut. Customer tidak perlu membeli Analytics hanya untuk membaca transaksi miliknya. Analytics menjadi produk terpisah ketika menggabungkan beberapa modul, menjadwalkan distribusi, atau menyediakan custom BI.

### 11.2 Capability matrix

| Area | Basic embedded | Pro Analytics | Advanced Analytics |
|---|---|---|---|
| On-screen report | Report dasar per modul | Cross-module dashboard | Custom semantic model |
| Filter | Date/location/status | Saved filter dan compare period | Custom dimension |
| Export | CSV manual terbatas | Scheduled CSV/PDF | Warehouse/BI export |
| Dashboard | Default module widgets | Customizable cross-module widget | Custom dashboard builder |
| Distribution | Tidak termasuk | Scheduled email/link | Role/audience distribution |
| Freshness | Tampil pada report | Monitor projection lag | SLA dan pipeline health |
| API | Tidak termasuk | Read API terbatas | Bulk/data export API |

### 11.3 Capability keys utama

| Tier mulai | Capability |
|---|---|
| Basic embedded | reports.module.basic |
| Pro | analytics.cross_module |
| Pro | analytics.dashboard.configure |
| Pro | analytics.export.schedule |
| Pro | analytics.compare_location |
| Advanced | analytics.metric.custom |
| Advanced | analytics.dashboard.build |
| Advanced | analytics.warehouse.export |
| Advanced | analytics.api.bulk |

### 11.4 Default limit

| Dimension | Basic embedded | Pro Analytics | Advanced Analytics |
|---|---:|---:|---:|
| Manual exports per billing cycle | 20 | 500 | Custom |
| Scheduled reports | 0 | 50 | Custom |
| Custom dashboards | 0 | 20 | Custom |
| Data export jobs per day | 0 | 10 | Custom |

---

## 12. Personal Finance — future product

### 12.1 Status

Semua tier pada bagian ini bersifat illustrative future. Finance Core foundation dibuat sekarang, tetapi belum ada komitmen paket atau harga.

### 12.2 Capability matrix

| Area | Basic | Pro | Advanced |
|---|---|---|---|
| Account | Cash/bank/account representation | More accounts dan multi-currency entry | Net-worth asset/liability model |
| Transaction | Income, expense, transfer | Recurring rule dan smart category | Automation rule dan advanced import |
| Budget | Monthly category budget | Rollover dan envelope | Scenario/household planning |
| Goal | Saving goal sederhana | Multiple goal dan contribution rule | Goal forecast |
| Import | CSV manual | Bank file/connector bila tersedia | Multiple connector dan rule engine |
| Receipt | Attachment | OCR suggestion | Automated extraction/review |
| Sharing | Owner only | Household collaborator | Advisor/read-only role |
| Report | Cashflow dan spending | Budget, trend, net worth | Scenario dan custom report |

### 12.3 Default limit illustrative

| Dimension | Basic | Pro | Advanced |
|---|---:|---:|---:|
| Accounts | 5 | 25 | Custom |
| Transactions per year | 5.000 | 50.000 | Custom |
| Active budgets | 3 | 50 | Custom |
| Active goals | 3 | 25 | Custom |
| Collaborators | 0 | 5 | Custom |

### 12.4 Guardrail

- Personal Finance selalu menggunakan workspace PERSONAL.
- Ia tidak memberikan akses ke Business Finance dan sebaliknya.
- Account adalah representasi pencatatan, bukan saldo yang disimpan platform.
- Bank connector, OCR, dan financial advice membutuhkan review tersendiri.

---

## 13. Integration and API add-on

Integration bukan tier baru untuk semua modul. Ia dapat diberikan oleh tier atau add-on terpisah.

| Level | Isi |
|---|---|
| Internal included | Binding antarmodul resmi di workspace yang sama |
| API add-on | API key, inbound/outbound webhook, usage dashboard, retry log |
| Custom integration | Dedicated mapping, custom connector, sandbox, support/SLA khusus |

Capability minimum:

- platform.api.client.manage
- platform.webhook.manage
- platform.integration.log.read
- platform.integration.retry
- platform.integration.custom

External integration harus tetap melalui public API/facade atau event adapter. Add-on tidak memberikan akses langsung ke database.

---

## 14. Aturan upgrade dan downgrade tier

### 14.1 Upgrade

1. Effective entitlement dihitung ulang.
2. Capability baru aktif sesuai tanggal efektif.
3. Setup task dibuat untuk capability yang membutuhkan konfigurasi.
4. Existing data tetap dipakai; tidak ada database migration per workspace.
5. Integration binding baru tidak otomatis ACTIVE bila mapping belum valid.

### 14.2 Downgrade

1. Data tidak dihapus.
2. Capability yang turun menjadi read-only atau hidden sesuai policy, tetapi export tetap disediakan.
3. Automation baru dihentikan pada tanggal efektif.
4. Resource yang melebihi limit baru tetap dapat dibaca dan dinonaktifkan; user tidak dapat menambah resource baru.
5. Refund, reversal, attendance checkout, correction, dan audit tetap dapat dilakukan.
6. Scheduled downgrade harus menampilkan dampak sebelum dikonfirmasi.

### 14.3 Tier compatibility

| Kombinasi | Validasi |
|---|---|
| POS Pro + Catalog Basic | Valid, tetapi capability harga/channel yang dibutuhkan POS harus ditambahkan atau upgrade Catalog |
| KDS Pro + POS Basic | Valid; KDS Pro dapat menerima event Basic dan memakai station/routing sendiri |
| Finance Pro + POS Basic | Valid; Finance mengelola mapping dan approval di domainnya |
| Inventory Pro + Catalog Basic | Valid untuk inventory standalone; recipe bridge membutuhkan capability Catalog recipe |
| HC Advanced + Finance Basic | Valid; payroll posting hanya aktif bila Finance mapping kompatibel |

---

## 15. Acceptance criteria

- Setiap capability memiliki module owner, minimum tier, status delivery, dan dependency.
- Package Builder dapat memilih tier berbeda untuk setiap modul.
- API mengembalikan reason yang membedakan entitlement, permission, feature flag, installation, dan limit.
- Tier Advanced tidak muncul sebagai tersedia untuk dibeli bila status delivery masih Future.
- Basic report tidak hilang ketika customer tidak membeli Analytics.
- Upgrade tidak membuat duplicate data atau duplicate integration event.
- Downgrade tidak menghapus transaksi, attendance, journal, stock movement, atau audit.
- Finance Basic tidak dilabeli sebagai laporan akuntansi formal.
- Mobile HC tidak dapat diaktifkan hanya dengan entitlement sebelum installation dan privacy/security setup selesai.
- Capability yang tersedia pada suatu tier tidak menghasilkan `upgrade required` hanya karena user membuka Small atau Medium viewport.
- Setiap page capability R1 dapat menyelesaikan primary read/mutation flow pada baseline Small, Medium, dan Large sesuai PRD induk `33.6`.
- Perubahan table ke card/sheet pada Small tidak mengubah API/use case, permission, audit, atau limit semantics.
- Floor Basic pada Small tetap dapat menjalankan Live Table View, memilih/membuat/mengubah konfigurasi meja, QR, table session, dan move table melalui interaction pattern yang sesuai layar sempit; precision drag tidak menjadi satu-satunya jalan.
- Pro merge/split tetap gated berdasarkan tier, bukan viewport; setelah ter-entitle operation dapat dijalankan pada S/M/L.

---

## 16. Keputusan yang masih terbuka

| ID | Keputusan | Target keputusan |
|---|---|---|
| MT-OD-01 | Apakah label komersial tetap Basic/Pro/Advanced atau memakai nama brand? | Sebelum pricing page |
| MT-OD-02 | Capability Pro mana yang masuk R1+ pertama? | Setelah pilot Basic |
| MT-OD-03 | Apakah mobile attendance termasuk HC Pro atau add-on tersendiri? | Sebelum mobile beta |
| MT-OD-04 | Apakah Finance Advanced dibangun sendiri atau melalui accounting partner? | Sebelum roadmap accounting |
| MT-OD-05 | Apakah campaign CRM dijual sebagai tier atau messaging add-on? | Sebelum CRM Pro |

---

## 17. Ringkasan keputusan

1. Product module memakai Basic, Pro, dan Advanced.
2. Tier mengatur capability; package dan add-on mengatur limit efektif.
3. Finance mempunyai tiga level dengan Basic sebagai pencatatan operasional, bukan accounting formal.
4. HC mempunyai tiga level dengan mobile attendance pada Pro dan payroll/talent pada Advanced.
5. Basic report tetap termasuk pada setiap module.
6. Advanced dan external-gated feature tidak boleh dipasarkan sebelum siap.
7. Downgrade tidak pernah menghapus data historis.
8. Responsive S/M/L adalah baseline delivery seluruh tier, bukan capability atau add-on berbayar.

---

**Akhir dokumen.**
