# Product Requirement Specification

# Cafe Companion Pro — Packages, Limits, Add-ons, and Enforcement

**Versi dokumen:** 1.2  
**Status:** Draft baseline komersial; harga belum ditetapkan  
**Tanggal:** 5 Agustus 2026  
**Dokumen induk:** CAFE-COMPANION-PRD-V2-MODULAR-PLATFORM.md  
**Matriks capability:** CAFE-COMPANION-MODULE-TIERS-V1.md

---

## 1. Tujuan dokumen

Dokumen ini menetapkan:

- paket F&B standar;
- paket module-only;
- tier modul yang termasuk pada setiap paket;
- batas kapasitas setiap paket;
- add-on yang dapat menambah kapasitas atau capability;
- cara menghitung usage;
- perilaku saat mendekati atau melewati limit;
- aturan trial, upgrade, downgrade, suspend, dan custom contract;
- perubahan terhadap paket pada PRD sebelumnya.

Angka pada dokumen ini adalah baseline untuk desain produk, UI, database, dan entitlement engine. Angka belum merupakan harga atau penawaran komersial final dan harus divalidasi melalui pilot, biaya infrastruktur, dan strategi go-to-market.

---

## 2. Pemisahan konsep

| Konsep | Mengatur | Contoh |
|---|---|---|
| Module tier | Capability yang dapat digunakan | Finance Basic tidak memiliki budget |
| Package | Preset beberapa module tier dan limit | Cafe Operations |
| Limit | Kapasitas efektif | 3 locations, 25 users |
| Add-on | Tambahan kapasitas atau capability khusus | Tambahan 50 employees |
| Override | Pengecualian khusus workspace | Trial Finance Pro selama 30 hari |
| Usage | Pemakaian aktual | 18 dari 25 users |

### 2.1 Responsive bukan limit atau add-on

Kemampuan menggunakan UI pada Small, Medium, dan Large adalah baseline produk, bukan dimensi komersial.

| Kelas | Width CSS | Package policy |
|---|---:|---|
| **Small (S)** | `320–767px` | Termasuk pada semua package yang memiliki capability web terkait |
| **Medium (M)** | `768–1279px` | Termasuk pada semua package yang memiliki capability web terkait |
| **Large (L)** | `≥1280px` | Termasuk pada semua package yang memiliki capability web terkait |

Aturan:

- Package, standalone preset, trial, add-on, dan Enterprise override **tidak boleh** mengenakan gate berdasarkan viewport/responsive layout.
- Limit mengatur jumlah resource/usage; responsive hanya mengatur presentation dan interaction dari capability yang sudah dimiliki.
- Jika package mempunyai Floor/Table Basic, maka Basic tetap dapat digunakan pada S/M/L. Cafe Digital tidak kehilangan mobile/tablet interaction hanya karena mempunyai limit floor/table lebih kecil daripada Cafe Operations.
- Upgrade capability tetap mengikuti Module Tiers. Contoh merge/split membutuhkan Floor Pro karena fungsi bisnisnya Pro, bukan karena UI Small/Medium/Large.
- Enforcement over-limit harus tetap dapat dibaca dan corrective action yang diizinkan tetap dapat dilakukan pada ketiga viewport.
- Baseline QA dan transformasi layout mengikuti PRD induk `33.6` dan tidak diduplikasi sebagai usage dimension di entitlement engine.

Prinsip utama:

> Tier menjawab “fitur apa”, sedangkan limit menjawab “berapa banyak”.

Package Builder tidak boleh menganggap semua modul dalam satu paket harus memakai tier yang sama.

---

## 3. Jenis limit

### 3.1 Hard count limit

Digunakan untuk resource yang dapat dihitung dan dikendalikan saat dibuat atau diaktifkan.

Contoh:

- active users;
- business units;
- active locations;
- register devices;
- KDS devices;
- active employees;
- active products;
- financial accounts;
- active API clients.

Ketika hard limit tercapai:

- data lama tetap dapat dibaca;
- resource aktif tidak dinonaktifkan otomatis;
- create/activate resource baru ditolak dengan domain error;
- archive/deactivate/export tetap dapat dilakukan;
- UI menampilkan usage, limit, alasan, dan CTA upgrade.

### 3.2 Soft metered limit

Digunakan untuk event operasional yang tidak boleh hilang.

Contoh:

- completed sales;
- self-orders;
- KDS tickets;
- stock movements;
- finance transactions dari integrasi;
- attendance events.

Ketika soft limit terlampaui:

- request tetap diproses;
- event tidak boleh dibuang;
- workspace diberi status OVER_LIMIT pada dimension terkait;
- owner dan Platform Admin menerima notifikasi;
- overage, add-on, atau perubahan paket ditangani oleh billing policy;
- suspension hanya dapat terjadi melalui lifecycle subscription, bukan akibat satu quota check di jalur transaksi.

### 3.3 Throttled limit

Digunakan untuk fungsi non-kritis yang aman ditunda atau dibatasi:

- bulk export;
- scheduled report;
- external API;
- outbound webhook non-operasional;
- campaign send;
- OCR/AI job future.

Saat limit tercapai, sistem dapat menunda atau menolak job baru tanpa mengganggu transaksi utama.

### 3.4 Capability gate

Digunakan ketika fitur tidak termasuk tier, misalnya:

- split bill;
- multi-station routing;
- budget;
- mobile attendance;
- payroll.

Response harus menjelaskan capability yang dibutuhkan. Backend tetap menjadi enforcement utama.

---

## 4. Paket F&B standar

### 4.1 Komposisi modul

| Product module | Profile | POS Basic | Cafe Digital | Cafe Operations | Cafe Growth | Enterprise |
|---|---|---|---|---|---|---|
| Core Platform | Included | Included | Included | Included | Included | Included |
| Catalog/Profile | Basic terbatas | Basic | Basic | Basic | Pro | Custom |
| POS and Sales | — | Basic | Basic | Basic | Pro | Custom |
| Floor/Table/Self-Order | — | — | Basic | Basic | Pro | Custom |
| KDS | — | — | Basic | Basic | Pro | Custom |
| Inventory | — | — | — | Basic | Pro | Custom |
| Business Finance | — | — | — | Basic | Pro | Custom |
| Customer | — | — | Basic context | Basic | Pro | Custom |
| Analytics | Public/basic only | Embedded Basic | Embedded Basic | Embedded Basic | Pro Analytics | Custom |
| Human Capital | — | — | — | — | Optional add-on | Optional/custom |
| External API | — | — | Internal only | Internal only | Limited API add-on | Custom |

### 4.2 Posisi tiap paket

| Paket | Target | Nilai utama |
|---|---|---|
| Profile | Kafe yang hanya membutuhkan profil dan menu publik | Presence digital sederhana |
| POS Basic | Satu outlet yang mulai memakai kasir digital | Penjualan, payment record, shift, receipt |
| Cafe Digital | Kafe kecil dengan meja, QR order, dan dapur | Front-of-house dan kitchen flow |
| Cafe Operations | Bisnis F&B yang membutuhkan kontrol stok dan keuangan operasional | Operasi end-to-end Basic |
| Cafe Growth | Bisnis multi-location dengan automation dan kontrol manajerial | Tier Pro pada modul utama |
| Enterprise | Grup usaha dengan kebutuhan custom, governance, atau volume tinggi | Contract dan limit khusus |

### 4.3 Platform limit

| Dimension | Profile | POS Basic | Cafe Digital | Cafe Operations | Cafe Growth | Enterprise |
|---|---:|---:|---:|---:|---:|---:|
| Business units/brands | 1 | 1 | 1 | 2 | 5 | Custom |
| Active locations | 1 | 1 | 2 | 3 | 10 | Custom |
| Active users | 3 | 5 | 12 | 25 | 100 | Custom |
| Custom roles | 0 | 0 | 3 | 10 | 30 | Custom |
| Active API clients | 0 | 0 | 0 | 0 | 3 | Custom |
| Attachment/media storage | 1 GB | 2 GB | 5 GB | 20 GB | 100 GB | Custom |
| Manual exports per cycle | 5 | 20 | 50 | 100 | 500 | Custom |

Built-in roles tidak dihitung sebagai custom roles. Platform service account dan internal integration worker tidak dihitung sebagai active users.

### 4.4 Catalog dan POS limit

| Dimension | Profile | POS Basic | Cafe Digital | Cafe Operations | Cafe Growth | Enterprise |
|---|---:|---:|---:|---:|---:|---:|
| Active products | 100 | 300 | 500 | 1.000 | 5.000 | Custom |
| Categories | 15 | 30 | 50 | 100 | 300 | Custom |
| Modifier groups | 10 | 30 | 50 | 100 | 500 | Custom |
| Register devices | 0 | 2 | 4 | 9 | 30 | Custom |
| Active cashiers | 0 | 5 | 12 | 25 | 100 | Custom |
| Completed sales per cycle | 0 | 5.000 | 20.000 | 75.000 | 300.000 | Custom |
| Receipt templates | 0 | 1 | 2 | 5 | 20 | Custom |

Completed sale dihitung satu kali ketika sale pertama kali mencapai status COMPLETED. Retry, read, receipt reprint, refund, dan reversal tidak menambah meter completed sale.

### 4.5 Floor, Table, Self-Order, dan KDS limit

| Dimension | Profile | POS Basic | Cafe Digital | Cafe Operations | Cafe Growth | Enterprise |
|---|---:|---:|---:|---:|---:|---:|
| Active tables per location | 0 | 0 | 50 | 100 | 250 | Custom |
| Configured floors/layouts per location | 0 | 0 | 1 | 3 | 10 | Custom |
| Active areas per floor | 0 | 0 | 5 | 10 | 30 | Custom |
| Self-orders per cycle | 0 | 0 | 15.000 | 60.000 | 250.000 | Custom |
| KDS devices | 0 | 0 | 4 | 9 | 30 | Custom |
| Stations per location | 0 | 0 | 1 | 3 | 10 | Custom |
| Kitchen tickets per cycle | 0 | 0 | 20.000 | 75.000 | 300.000 | Custom |
| External order sources | 0 | 0 | 0 | 0 | 3 | Custom |

Internal POS dan Self-Order bukan external source. Satu kitchen ticket unik dihitung sekali; retry event tidak menambah usage.

Catatan capability Floor/Table:

- Cafe Digital dan Cafe Operations sama-sama mendapat Floor/Table Basic: tiga bentuk meja, capacity/chair visualization, drag snap-to-grid, rotasi 90 derajat, Live Table View, table session, move table, dan QR per meja.
- Perbedaan kedua paket pada domain ini adalah kapasitas, bukan pemotongan capability Basic: Cafe Digital dibatasi 1 configured floor/layout dan 5 area; Cafe Operations 3 floor/layout dan 10 area per floor.
- Cafe Growth memakai Pro sehingga memperoleh merge/split table session, service zone, dan advanced layout operations.
- Reservation/waitlist dan venue-layout kompleks tidak termasuk Cafe Growth secara default; keduanya Advanced/future atau explicit Enterprise contract.

### 4.6 Inventory, Finance, dan Customer limit

| Dimension | Profile | POS Basic | Cafe Digital | Cafe Operations | Cafe Growth | Enterprise |
|---|---:|---:|---:|---:|---:|---:|
| Active inventory items | 0 | 0 | 0 | 1.000 | 5.000 | Custom |
| Warehouses/stock locations | 0 | 0 | 0 | 6 | 25 | Custom |
| Stock movements per cycle | 0 | 0 | 0 | 50.000 | 250.000 | Custom |
| Active suppliers | 0 | 0 | 0 | 100 | 1.000 | Custom |
| Active recipes | 0 | 0 | 0 | 1.000 | 5.000 | Custom |
| Legal entities in Finance | 0 | 0 | 0 | 2 | 5 | Custom |
| Financial accounts | 0 | 0 | 0 | 20 | 100 | Custom |
| Finance transactions per cycle | 0 | 0 | 0 | 100.000 | 400.000 | Custom |
| Active customer profiles | 0 | 0 | 5.000 | 25.000 | 100.000 | Custom |
| Scheduled reports | 0 | 0 | 0 | 0 | 50 | Custom |

Inventory stock location dapat berupa satu storage area per outlet ditambah warehouse tambahan. Definisi tidak boleh memakai istilah location yang sama tanpa dimension key yang berbeda.

### 4.7 Status availability

| Paket | Target availability |
|---|---|
| Profile | R1 |
| POS Basic | R1 |
| Cafe Digital | R1 simple setelah POS dan KDS stabil |
| Cafe Operations | R1 bertahap setelah Inventory dan Finance Basic stabil |
| Cafe Growth | R1+ atau Future sesuai kesiapan tier Pro |
| Enterprise | Custom setelah capability yang dikontrak tersedia |

Paket tidak boleh ditawarkan sebagai ACTIVE bila salah satu module tier wajibnya masih Future. Package catalog dapat menampilkannya sebagai Coming Soon atau Private Preview.

---

## 5. Paket standalone

### 5.1 Prinsip

Paket standalone tetap memperoleh Core Platform dan internal kernel yang diperlukan. Internal kernel tidak muncul sebagai product module berbayar.

### 5.2 Standalone Basic

| Paket | Module tier | Internal support | Default platform limit |
|---|---|---|---|
| Catalog Only | Catalog Basic | Catalog Kernel | 1 location, 3 users |
| POS Only | POS Basic + Catalog Basic | Order dan Payment Ledger | 1 location, 5 users |
| KDS Only | KDS Basic | Order Intake Lite | 1 location, 5 users |
| Inventory Only | Inventory Basic | Inventory item master | 2 stock locations, 5 users |
| Finance Only | Business Finance Basic | Finance Core | 1 legal entity, 5 users |
| HC Only | HC Basic | Core Organization | 3 branches, 5 HR/admin users |
| Customer Only | Customer Basic | Customer Core | 1 location, 5 users |
| Personal Finance | Personal Finance future | Finance Core + PERSONAL workspace | Future |

### 5.3 POS Only limits

| Dimension | Basic | Pro | Advanced |
|---|---:|---:|---:|
| Locations | 1 | 5 | Custom |
| Active users | 5 | 50 | Custom |
| Register devices | 2 | 10 | Custom |
| Active products | 300 | 3.000 | Custom |
| Completed sales per cycle | 5.000 | 50.000 | Custom |
| Storage | 2 GB | 20 GB | Custom |

KDS, Inventory, Finance, dan HC tidak muncul. POS tetap menerbitkan event internal, tetapi tidak ada target handler bila module terkait tidak terpasang.

### 5.4 KDS Only limits

| Dimension | Basic | Pro | Advanced |
|---|---:|---:|---:|
| Locations | 1 | 10 | Custom |
| Active users | 5 | 50 | Custom |
| KDS devices | 2 | 15 | Custom |
| Stations per location | 1 | 10 | Custom |
| Tickets per cycle | 10.000 | 100.000 | Custom |
| External intake sources | 1 | 10 | Custom |
| API requests per minute | 60 | 600 | Custom |

KDS Basic standalone mendapatkan manual intake dan satu inbound source sederhana. Multi-station routing tetap membutuhkan KDS Pro.

### 5.5 Inventory Only limits

| Dimension | Basic | Pro | Advanced |
|---|---:|---:|---:|
| Active users | 5 | 50 | Custom |
| Stock locations | 2 | 25 | Custom |
| Active items | 500 | 5.000 | Custom |
| Stock movements per cycle | 10.000 | 150.000 | Custom |
| Active suppliers | 50 | 1.000 | Custom |
| Storage | 5 GB | 50 GB | Custom |

Recipe auto-consumption tidak aktif tanpa Catalog/POS bridge yang valid.

### 5.6 Finance Only limits

| Dimension | Basic | Pro | Advanced |
|---|---:|---:|---:|
| Legal entities | 1 | 5 | Custom |
| Active users | 5 | 30 | Custom |
| Financial accounts | 10 | 100 | Custom |
| Finance transactions per cycle | 10.000 | 150.000 | Custom |
| Active budgets | 0 | 100 | Custom |
| Recurring rules | 0 | 500 | Custom |
| Import profiles | 0 | 20 | Custom |
| Storage | 5 GB | 50 GB | Custom |

Finance Basic mencakup manual income, expense, transfer, cashbook, manual reconciliation, dan report estimasi. Budget, AP/AR ringan, recurring, approval, dan import reconciliation dimulai pada Pro. Ledger/journal formal dimulai pada Advanced.

### 5.7 HC Only limits

| Dimension | Basic | Pro | Advanced |
|---|---:|---:|---:|
| Business units/companies | 1 | 5 | Custom |
| Branches | 3 | 25 | Custom |
| HR/admin users | 5 | 30 | Custom |
| Active employees | 50 | 500 | Custom |
| Attendance events per cycle | 10.000 | 250.000 | Custom |
| Trusted mobile devices | 0 | 600 | Custom |
| Leave policies | 5 | 50 | Custom |
| Approval workflows | 1 | 20 | Custom |
| Storage | 5 GB | 50 GB | Custom |

HC Basic memakai web/manual attendance. Mobile attendance, geofence, selfie evidence, timesheet approval, dan advanced leave policy dimulai pada Pro. Payroll, recruitment, performance, biometric connector, dan roster optimization dimulai pada Advanced.

### 5.8 Personal Finance illustrative limits

| Dimension | Basic | Pro | Advanced |
|---|---:|---:|---:|
| Workspace owners | 1 | 1 | Custom |
| Collaborators | 0 | 5 | Custom |
| Financial accounts | 5 | 25 | Custom |
| Transactions per year | 5.000 | 50.000 | Custom |
| Active budgets | 3 | 50 | Custom |
| Active goals | 3 | 25 | Custom |
| Storage | 1 GB | 10 GB | Custom |

Bagian ini adalah Future dan tidak boleh tampil sebagai paket purchasable pada Release 1.

---

## 6. Add-on catalog

### 6.1 Capacity add-on

| Add-on | Menambah | Syarat |
|---|---:|---|
| Extra Business Unit | +1 business unit | Package mendukung multi-unit terminology |
| Extra Location | +1 active location | Module terkait sudah terpasang |
| User Pack S | +5 active users | Core Platform aktif |
| User Pack M | +25 active users | Core Platform aktif |
| Register Device | +1 register | POS aktif |
| Table Pack | +50 active tables per contracted location | Floor/Table aktif |
| KDS Device | +1 KDS device | KDS aktif |
| KDS Station Pack | +3 stations per contracted location | KDS Pro |
| Product Pack | +1.000 active products | Catalog aktif |
| Inventory Item Pack | +1.000 active items | Inventory aktif |
| Employee Pack S | +50 active employees | HC aktif |
| Employee Pack M | +250 active employees | HC aktif |
| Customer Pack | +25.000 customer profiles | Customer aktif |
| Storage Pack S | +10 GB | Attachment capability aktif |
| Storage Pack L | +100 GB | Attachment capability aktif |

### 6.2 Volume add-on

| Add-on | Menambah per billing cycle | Syarat |
|---|---:|---|
| POS Volume S | +10.000 completed sales | POS aktif |
| POS Volume L | +100.000 completed sales | POS aktif |
| Self-Order Volume | +25.000 self-orders | Self-Order aktif |
| KDS Volume | +50.000 kitchen tickets | KDS aktif |
| Inventory Volume | +100.000 stock movements | Inventory aktif |
| Finance Volume | +100.000 finance transactions | Business Finance aktif |
| HC Attendance Volume | +100.000 attendance events | HC aktif |
| Export Volume | +500 manual/scheduled exports | Report/export capability aktif |

### 6.3 Capability add-on

| Add-on | Capability | Syarat minimum |
|---|---|---|
| External API | API clients, inbound/outbound webhook, usage log | Module aktif dan security setup |
| Advanced Reports | Cross-module dashboard dan scheduled export | Minimal dua module data sources |
| Mobile Attendance | Mobile check-in/out dan device registry | HC Pro atau explicit contract |
| Payroll | Payroll capability bundle | HC Advanced dan legal/product readiness |
| Integrated Payment | Gateway/PJP payment and settlement | External gate |
| Campaign Messaging | Campaign delivery connector | Customer Pro, consent, provider |
| Custom Integration | Dedicated connector/mapping | Technical assessment dan custom contract |

Capability add-on harus eksplisit. Capacity add-on tidak boleh otomatis membuka capability tier lebih tinggi.

---

## 7. Perhitungan effective limit

Effective limit dihitung per dimension:

**Effective limit = package snapshot + active add-ons + workspace override**

Aturan:

- Package version yang sudah dibeli disimpan sebagai snapshot.
- Perubahan package catalog tidak mengubah customer lama secara diam-diam.
- Override dapat positif, negatif, atau mengganti nilai, tetapi harus memiliki alasan dan periode berlaku.
- Unlimited disimpan sebagai tipe khusus, bukan angka sangat besar.
- Usage tidak boleh diubah manual; correction menggunakan metering adjustment yang diaudit.
- Platform safety cap dapat membatasi custom limit untuk melindungi sistem dan harus terlihat bagi Platform Admin.

### 7.1 Contoh

Cafe Operations memberikan:

- 3 locations;
- 25 users;
- 9 registers;
- 75.000 completed sales per cycle.

Customer membeli:

- 2 Extra Location;
- 1 User Pack M;
- 3 Register Device;
- 1 POS Volume L.

Effective limit menjadi:

- 5 locations;
- 50 users;
- 12 registers;
- 175.000 completed sales per cycle.

Capability modul tetap POS Basic. Split bill tidak aktif hanya karena customer membeli volume tambahan.

---

## 8. Definisi usage

| Dimension | Yang dihitung | Tidak dihitung |
|---|---|---|
| Active user | Membership ACCEPTED dan ACTIVE yang dapat login | Pending invite, suspended user, platform service worker |
| Business unit | Unit status ACTIVE | Archived unit |
| Location | Location status ACTIVE | Archived location |
| Register/KDS device | Device status ACTIVE dan tidak revoked | Revoked/decommissioned device |
| Product/item | Record status ACTIVE | Archived item |
| Employee | Employment status yang memerlukan seat aktif | Draft kandidat, terminated employee |
| Completed sale | Transisi pertama ke COMPLETED | Retry, reprint, read, refund event |
| Self-order | Order unik yang berhasil disubmit | Abandoned cart dan duplicate retry |
| Kitchen ticket | Ticket unik yang berhasil dibuat | Duplicate event dan replay |
| Stock movement | Movement ledger unik yang posted | Projection rebuild dan duplicate retry |
| Finance transaction | Transaction bisnis unik yang posted | Projection rebuild dan system-generated reversal dari event yang sama |
| Attendance event | Event unik yang diterima dan lolos idempotency | Duplicate offline sync |
| Storage | File aktif dan retained yang belum dipurge | System audit log dan generated thumbnails internal |
| API request | External API request yang diterima gateway | Internal event dan health check |

### 8.1 Metering period

- Meter bulanan mengikuti subscription billing cycle, bukan kalender bulan.
- Boundary waktu disimpan dalam UTC.
- UI menampilkan tanggal mulai/akhir dalam timezone workspace.
- Usage harus dapat direkonsiliasi dari source record.
- Late-arriving offline event dihitung berdasarkan received time untuk billing meter dan occurred time untuk report bisnis.

---

## 9. Threshold dan notifikasi

| Usage | State | Perilaku |
|---:|---|---|
| Di bawah 80% | NORMAL | Tidak ada warning |
| 80%–89,99% | APPROACHING | Banner ringan untuk owner/admin |
| 90%–99,99% | NEAR_LIMIT | Banner jelas, notification, CTA add-on/upgrade |
| 100% atau lebih | AT_LIMIT/OVER_LIMIT | Enforcement sesuai jenis limit |

Notifikasi minimum:

- in-app owner/admin;
- Platform Admin dashboard;
- email optional setelah notification foundation siap;
- satu reminder per threshold per cycle agar tidak spam;
- notifikasi ulang bila usage naik signifikan atau state memburuk.

Kasir, kitchen staff, dan employee tidak perlu melihat detail billing kecuali aksi mereka benar-benar ditolak. Pesan operasional tetap sederhana.

---

## 10. Enforcement per domain

### 10.1 Core

- User limit memblokir activate/invite acceptance baru, bukan login user aktif.
- Location limit memblokir location baru menjadi ACTIVE.
- Storage limit memblokir upload baru setelah tolerance policy; existing attachment tetap dapat dibaca.
- Export data milik customer tidak boleh dinonaktifkan hanya karena downgrade.

### 10.2 POS

- Completed-sale meter bersifat soft.
- Sale yang sudah dimulai selalu dapat diselesaikan.
- Refund, void, reversal, dan shift close tidak pernah diblokir oleh volume limit.
- Register hard limit memblokir aktivasi device baru.
- Subscription SUSPENDED ditangani oleh policy terpisah dengan emergency/export path.

### 10.3 Floor/Table, KDS, dan Self-Order

- Floor/area/table hard limit hanya memblokir pembuatan atau aktivasi resource baru; layout existing tetap dapat dibaca dan dipakai operasional.
- Active table session, move, close, waiter/bill request, dan penyelesaian order tidak boleh diblokir hanya karena workspace turun paket atau melewati quota.
- Shape meja dan jumlah kursi visual bukan meter komersial.
- Merge/split divalidasi sebagai capability Pro, bukan sebagai capacity add-on; membeli Table Pack tidak membuka merge/split.
- Event order yang sudah diterima tidak boleh hilang karena quota.
- KDS ticket meter bersifat soft.
- External API dapat di-throttle sesuai API add-on, tetapi harus memakai retryable response.
- Self-Order baru dapat dinonaktifkan terkontrol setelah subscription policy, bukan di tengah checkout yang sudah disubmit.

### 10.4 Inventory

- Auto-consumption dan posted movement tidak dibuang saat meter terlampaui.
- Adjustment/reversal dan stocktake correction selalu tersedia.
- Item hard limit hanya memblokir active item baru.

### 10.5 Finance

- Event sale/payment yang diterima tidak boleh hilang.
- Reversal dan correction selalu tersedia.
- Financial account hard limit memblokir account baru, bukan posting ke account existing.
- Report/export milik customer tetap dapat diakses sesuai retention dan permission.

### 10.6 HC

- Check-out, correction, approval, dan safety-related attendance event tidak diblokir.
- Employee hard limit memblokir aktivasi employee baru.
- Offline attendance yang terlambat tetap diterima dan dimeter secara idempotent.
- Bila mobile capability berakhir, web/manual correction dan export history tetap tersedia.

---

## 11. Trial

### 11.1 Default trial

Baseline yang direkomendasikan:

- 14 hari;
- satu workspace;
- satu active location;
- maksimal 5 users;
- tier Basic atau Pro preview sesuai campaign;
- volume operasional cukup untuk uji wajar;
- tidak memperbolehkan external campaign atau integrated payment tanpa gate;
- data trial dapat dikonversi ke subscription tanpa import ulang.

### 11.2 Trial module

Workspace existing dapat memperoleh trial satu module:

- entitlement memiliki start dan end;
- installation dibuat terpisah;
- integration binding default SETUP_REQUIRED;
- reminder pada H-7, H-3, H-1;
- saat berakhir, module menjadi read-only/locked sesuai policy;
- data tidak dihapus;
- conversion mengaktifkan entitlement berbayar pada installation yang sama.

---

## 12. Upgrade, downgrade, dan package migration

### 12.1 Upgrade

- Dapat efektif segera atau pada cycle berikutnya.
- Limit baru dapat aktif segera setelah pembayaran/approval.
- Capability baru membutuhkan setup checklist bila ada dependency.
- Usage cycle tidak direset hanya karena upgrade.
- Package snapshot dan actor diaudit.

### 12.2 Downgrade

- Default efektif pada akhir cycle.
- UI menampilkan capability yang hilang dan resource yang melebihi limit.
- Data tidak dihapus.
- Automation capability yang hilang dihentikan pada effective time.
- Existing resource di atas limit tetap read-only/manageable untuk dikurangi.
- Resource baru tidak dapat ditambahkan sampai usage di bawah limit.
- Essential correction dan export tetap tersedia.

### 12.3 Module removal

- Entitlement berakhir.
- Installation menjadi SUSPENDED.
- Event consumer berhenti setelah cutoff yang terkontrol.
- Data tetap dimiliki module dan mengikuti retention.
- Binding menjadi DISABLED, bukan dihapus.
- Re-activation menggunakan installation dan data lama setelah compatibility check.

### 12.4 Package migration validation

Package Builder harus memeriksa:

- dependency capability;
- module status delivery;
- workspace type;
- business template;
- resource overage;
- binding yang akan berhenti;
- scheduled automation;
- external contract;
- unresolved invoice atau policy komersial;
- required setup sebelum activation.

---

## 13. Suspension dan grace

| State | Read | Export | Normal mutation | Corrective action | Integration intake |
|---|---|---|---|---|---|
| ACTIVE | Ya | Ya | Ya | Ya | Ya |
| GRACE | Ya | Ya | Ya dengan warning | Ya | Ya |
| SUSPENDED | Ya terbatas | Ya sesuai policy | Tidak | Admin/support path | Pause/retry queue |
| TERMINATED | Sesuai retention | Sesuai policy | Tidak | Support/legal path | Tidak |

Event yang datang saat target module SUSPENDED tidak boleh ditandai sukses palsu. Ia masuk retry/pause policy atau dead-letter dengan alasan subscription state.

---

## 14. Platform Admin requirements

### 14.1 Package Builder

Admin harus dapat:

1. memilih business template;
2. memilih module dan tier;
3. melihat capability yang diwariskan;
4. menambah atau menghapus capability add-on;
5. mengisi limit setiap dimension;
6. melihat dependency warning;
7. menentukan availability dan sales channel;
8. membuat version baru;
9. preview effective entitlement;
10. publish tanpa mengubah snapshot customer lama.

### 14.2 Workspace usage

Admin harus melihat:

- effective package/version;
- module tier;
- active add-on;
- override;
- usage/limit/percentage;
- meter period;
- source usage;
- last calculated time;
- threshold state;
- projected cycle-end usage;
- action upgrade/add-on/override;
- audit history.

### 14.3 Override

Override minimum menyimpan:

- workspace;
- dimension atau capability;
- operation: grant, revoke, add, replace;
- value;
- reason;
- start/end;
- actor;
- approval reference optional;
- audit timestamp.

---

## 15. Data model minimum

| Table | Tujuan |
|---|---|
| core_packages | Identitas paket |
| core_package_versions | Snapshot definisi per version |
| core_package_modules | Module dan tier dalam package version |
| core_package_capabilities | Capability included/excluded |
| core_package_limits | Limit default per dimension |
| core_subscriptions | Package/version dan lifecycle workspace |
| core_subscription_addons | Add-on aktif dan quantity |
| core_entitlement_overrides | Grant/revoke/limit override |
| core_effective_entitlements | Projection entitlement efektif |
| core_usage_dimensions | Definisi meter dan enforcement type |
| core_usage_counters | Usage per workspace/dimension/period |
| core_usage_events | Source metering idempotent |
| core_usage_adjustments | Correction usage yang diaudit |
| core_limit_notifications | Threshold notification deduplication |

Aturan database:

- Package version immutable setelah published.
- Usage event memiliki idempotency key.
- Counter dapat dibangun ulang dari usage event/source data.
- Limit dimension memakai key stabil, bukan label UI.
- Nilai unlimited memakai explicit flag/type.
- Semua mutation subscription, add-on, override, dan adjustment masuk audit.

---

## 16. Limit dimension catalog

| Dimension key | Unit | Enforcement |
|---|---|---|
| core.business_units.active | count | Hard |
| core.locations.active | count | Hard |
| core.users.active | seat | Hard |
| core.roles.custom | count | Hard |
| core.storage.gb | GB | Hard dengan tolerance |
| catalog.products.active | count | Hard |
| pos.registers.active | device | Hard |
| pos.sales.completed.cycle | event | Soft metered |
| floor.tables.active_per_location | count | Hard |
| floor.floors.active_per_location | count | Hard |
| floor.areas.active_per_floor | count | Hard |
| self_order.orders.submitted.cycle | event | Soft metered |
| kds.devices.active | device | Hard |
| kds.stations.active_per_location | count | Hard |
| kds.tickets.created.cycle | event | Soft metered |
| inventory.items.active | count | Hard |
| inventory.stock_locations.active | count | Hard |
| inventory.movements.posted.cycle | event | Soft metered |
| finance.accounts.active | count | Hard |
| finance.transactions.posted.cycle | event | Soft metered |
| hc.employees.active | seat | Hard |
| hc.attendance.received.cycle | event | Soft metered |
| customer.profiles.active | count | Hard |
| reports.exports.cycle | job | Throttled |
| api.requests.cycle | request | Throttled |

---

## 17. Domain error contract

Error limit minimum:

| Code | Kondisi |
|---|---|
| ENTITLEMENT_REQUIRED | Capability/module tidak dibeli |
| TIER_UPGRADE_REQUIRED | Capability membutuhkan tier lebih tinggi |
| LIMIT_REACHED | Hard count limit tercapai |
| RATE_LIMITED | Throttled limit tercapai |
| INSTALLATION_SETUP_REQUIRED | Entitlement ada tetapi setup belum lengkap |
| SUBSCRIPTION_SUSPENDED | Subscription tidak usable |

Response harus membawa:

- code;
- user-safe message;
- module/capability/dimension;
- current usage;
- effective limit;
- reset/effective date bila relevan;
- allowed action;
- upgrade/add-on CTA reference;
- correlation ID.

Operational client seperti POS dan KDS tidak perlu menerima detail harga.

---

## 18. Acceptance criteria

### 18.1 Package

- Memilih Cafe Operations menghasilkan module, tier, capability, dan limit sesuai version snapshot.
- Publish package version baru tidak mengubah customer pada version lama.
- Workspace dapat membeli Finance Only tanpa POS.
- Workspace dapat membeli HC Only tanpa terminology F&B.
- Enterprise custom menggunakan contract snapshot, bukan conditional code khusus tenant.
- Package yang memiliki capability web terkait menyediakan responsive S/M/L tanpa entitlement, add-on, atau surcharge terpisah.
- Cafe Digital, Cafe Operations, dan Cafe Growth mempertahankan semantics capability yang sama saat berpindah viewport; perbedaannya tetap tier dan effective limit, bukan kualitas responsive.

### 18.2 Limit

- User ke-26 pada Cafe Operations tidak dapat diaktifkan tanpa add-on/override.
- Sale ke-75.001 tetap tersimpan dan workspace masuk state OVER_LIMIT.
- Duplicate sale event tidak menambah usage.
- Refund dan reversal tidak diblokir saat over limit.
- KDS retry tidak membuat ticket atau meter ganda.
- Attendance offline duplicate tidak menambah usage.
- Archive location menurunkan active location usage setelah projection diperbarui.
- Meja ke-51 pada Cafe Digital tidak dapat diaktifkan tanpa Table Pack/override, tetapi table session existing tetap dapat diselesaikan.
- Area ke-6 pada satu floor Cafe Digital ditolak oleh hard limit tanpa mengubah area/meja existing.
- Ketika hard/soft limit tercapai pada Small atau Medium, user tetap melihat usage state, reason, allowed corrective action, dan upgrade/add-on CTA yang sama secara semantik dengan Large.

### 18.3 Add-on

- Satu User Pack M menambah effective user limit sebanyak 25.
- Capacity add-on tidak membuka split bill atau capability Pro.
- Table Pack menambah kapasitas active table tetapi tidak membuka merge/split table session atau advanced editor.
- Add-on yang kedaluwarsa tidak menghapus resource existing.
- Custom override memiliki reason, actor, dan validity period.

### 18.4 Downgrade

- Downgrade Finance Pro ke Basic tidak menghapus budget, reconciliation, atau transaction.
- Automation Pro berhenti pada effective date.
- Historical Pro data tetap dapat diekspor.
- Employee di atas Basic limit tetap terbaca dan dapat dinonaktifkan, tetapi employee baru tidak dapat diaktifkan.

---

## 19. Perbandingan dengan PRD sebelumnya

| Area | PRD sebelumnya | Dokumen ini |
|---|---|---|
| Nama paket | Profile, POS Basic, Cafe Digital, Cafe Operations, Custom Modular, Payment add-on | Nama lama dipertahankan; Cafe Growth, Enterprise, dan standalone preset diperjelas |
| Isi paket | Daftar module tingkat tinggi | Tier setiap module ditentukan |
| Limit | Menyebut outlet/user/device/transaction secara konsep | Angka baseline per package dan dimension ditetapkan |
| Floor/Table | Table layout sederhana | Floor -> Area -> Table, editor/live view, tier Basic/Pro/Advanced, serta limit floor/area/table diperjelas |
| Finance | Finance Basic sebagai fitur operasional | Basic, Pro, Advanced dipisah dengan guardrail accounting |
| HC | HC simple/standalone baru | Basic, Pro, Advanced dan limit employee/device ditetapkan |
| Standalone | HC Only, KDS Only, Finance Only disebut | Default capacity setiap standalone package ditetapkan |
| Add-on | Payment dan custom modular | Capacity, volume, capability, API, dan custom integration dipisah |
| Enforcement | Error dan CTA upgrade umum | Hard, soft metered, throttled, dan safety exception ditetapkan |
| Overage | Belum rinci | Event operasional tidak dibuang; billing policy terpisah |
| Downgrade | Data tidak dihapus | Dampak capability, resource overage, automation, dan export dirinci |
| Package version | Paket sebagai preset | Published version immutable dan customer memakai snapshot |
| Responsive | Disebut sebagai concern UI umum | S/M/L ditegaskan bukan tier, limit, atau add-on; seluruh package mengikuti kontrak responsive global |

Keputusan lama yang tetap berlaku:

- Paket hanyalah konfigurasi, bukan fork aplikasi.
- Core Platform selalu tersedia.
- Manual payment tetap menjadi baseline R1.
- Integrated Payment tetap External gate.
- Finance Basic bukan accounting formal.
- Native HC dan Personal Finance tetap future client.

---

## 20. Keputusan terbuka sebelum harga dirilis

| ID | Keputusan | Data yang dibutuhkan |
|---|---|---|
| PKG-OD-01 | Harga setiap paket dan add-on | Infrastructure cost, support, competitor, willingness-to-pay |
| PKG-OD-02 | Apakah Profile gratis atau berbayar | Acquisition dan conversion test |
| PKG-OD-03 | Soft overage ditagih otomatis atau meminta upgrade | Billing provider dan sales policy |
| PKG-OD-04 | Apakah HC termasuk Cafe Growth | Pilot demand F&B |
| PKG-OD-05 | Mobile Attendance menjadi HC Pro atau add-on | Mobile operating cost dan positioning |
| PKG-OD-06 | Usage reset mengikuti invoice date final | Billing implementation |
| PKG-OD-07 | Data/report lookback per package | Cost, customer need, retention policy |
| PKG-OD-08 | Tolerance storage dan purge policy | Storage cost dan compliance review |

---

## 21. Rekomendasi rollout

### Phase 1

- Implement package version, entitlement, hard count limit, dan mock usage.
- Tawarkan Profile dan POS Basic.
- Validasi angka product/user/register/sales melalui pilot.

### Phase 2

- Tawarkan Cafe Digital.
- Aktifkan KDS/Self-Order meter.
- Uji device activation, event idempotency, dan over-limit notification.

### Phase 3

- Tawarkan Cafe Operations.
- Aktifkan Inventory dan Finance Basic meter.
- Pastikan event tidak hilang pada overage atau consumer retry.

### Phase 4

- Tawarkan HC Only Basic.
- Uji employee seat, attendance event, correction, dan downgrade.

### Phase 5

- Validasi Cafe Growth dan module Pro.
- Tambahkan add-on, API usage, scheduled report, dan custom contract.

---

## 22. Ringkasan keputusan

1. Paket F&B utama adalah Profile, POS Basic, Cafe Digital, Cafe Operations, Cafe Growth, dan Enterprise.
2. Module standalone tetap dapat dibeli tanpa paket F&B.
3. Tier mengatur capability; package/add-on mengatur kapasitas.
4. Hard limit hanya memblokir resource baru.
5. Meter operasional bersifat soft agar sale, KDS, Finance, Inventory, dan attendance event tidak hilang.
6. Corrective action dan export tidak boleh dijadikan hostage saat over limit atau downgrade.
7. Add-on capacity tidak membuka capability tier lebih tinggi.
8. Package version published bersifat immutable.
9. Angka adalah baseline produk dan harus divalidasi sebelum pricing final.
10. Responsive Small/Medium/Large adalah baseline kualitas capability dan tidak pernah menjadi limit atau add-on.

---

**Akhir dokumen.**
