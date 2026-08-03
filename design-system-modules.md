# Design System — Breakdown per Modul

**Status:** Companion doc dari `design-system.md`
**Cara pakai:** dokumen ini TIDAK mendefinisikan token baru. Setiap referensi `§` merujuk ke `design-system.md` (shell §3, komponen §4, status bucket §2.2, data guard §5). Kalau agent membangun modul di bawah, cukup buka bagian modul ini + rujukan §-nya di `design-system.md` — jangan mendesain ulang dari nol.

**Legend availability** mengikuti `feature-inventory.md` §2: Core / Paket / Custom Modular / Add-on Future / Platform-only.

---

## 1. Platform Management

- **Availability:** Platform-only
- **Shell:** §3.4 Platform Admin Shell
- **Layar:** Dashboard ringkas (tenant/outlet/user/usage/subscription count) → Tenant list → Tenant detail (tabs: profile, outlets, subscription, users) → Package/Module master → Support notes.
- **Komponen:** §4.6 data table dense (list tenant/outlet), §4.11 dialog konfirmasi (suspend/terminate tenant), §4.12 empty state (belum ada tenant), badge status pakai bucket Subscription (§2.2).
- **Pola khusus:** detail dibuka sebagai **drawer** dari sisi kanan (bukan halaman penuh) di atas tabel, supaya admin tetap lihat konteks list.
- **Data guard:** ID tenant/subscription/invoice/support-actor tidak pernah jadi teks — hanya label nama tenant/brand yang tampil. Audit event ditampilkan sebagai timeline ringkas, bukan payload mentah.

## 2. Tenancy dan Organization

- **Availability:** Core
- **Shell:** §3.4 (dikelola platform) dan §3.1 (context header dilihat merchant)
- **Layar:** Tenant → Brand → Outlet tree (platform side); Outlet switcher di topbar merchant (§4.2 topbar, tambahkan dropdown outlet di sebelah search).
- **Komponen:** context header/outlet switcher sebagai varian dari §4.2, status badge active/inactive/suspended (bucket Subscription §2.2), §4.11 dialog konfirmasi untuk deaktivasi outlet.
- **Data guard:** tenant/brand/outlet ID hanya untuk routing; yang tampil adalah nama, alamat, timezone, status.

## 3. Identity, Membership, RBAC, dan Device

- **Availability:** Core
- **Shell:** §3.1 Merchant Backoffice (Settings > Staff), §3.4 untuk platform admin user
- **Layar:** Staff list → Staff form (role, outlet assignment) → Permission matrix → Device registration list → Approval PIN dialog → Session/device table.
- **Komponen:** §4.6 table untuk staff/device/session, permission matrix sebagai grid checkbox (varian §4.6, header kolom = permission, baris = role), §4.11 dialog untuk approval PIN (input angka besar, numeric keypad style di device POS/KDS), role badge pakai bucket **neutral** (role bukan status operasional, warna netral saja supaya tidak tertukar dengan status bucket lain).
- **Data guard:** password hash, token, device secret, session cookie, actor ID **tidak pernah** dirender. Login history hanya tampilkan waktu, device, dan lokasi kasar (jika ada), bukan payload session.

## 4. Subscription dan Entitlement

- **Availability:** Core & Platform-only
- **Shell:** §3.4 (kelola oleh platform), banner di §3.1 (dilihat merchant)
- **Layar:** Package/module master (platform) → Tenant entitlement editor → Merchant-side: subscription status banner (persistent, di atas konten, sebelum topbar) + locked/upgrade state per module nav item (§3.1 aturan entitlement-aware nav).
- **Komponen:** status banner pakai bucket Subscription (§2.2), locked module state = ikon gembok + opacity turun pada nav item (§3.1), invoice/payment confirmation pakai §4.6 table, support note pakai timeline sederhana (list vertikal dengan garis penghubung, bukan komponen baru — cukup §4.6 row + divider).
- **Data guard:** raw entitlement override payload, subscription/invoice internal ID, support actor ID tidak tampil di sisi merchant.

## 5. Merchant Organization

- **Availability:** Core, terlihat di semua paket
- **Shell:** §3.1, section "Settings"
- **Layar:** Brand profile form → Outlet profile form (jam operasional, pajak/service charge) → Payment method manual list → Staff & role (lihat modul 3) → Device & printer list.
- **Komponen:** form standar (input, textarea, upload gambar — logo/banner) sesuai §2.7 tipografi label, operating-hours editor sebagai list hari + time-range picker per baris, printer card = kartu kecil dengan status koneksi (bucket Connection §2.2) + tombol "Test Print" (secondary button §4.10) + "Reconnect".
- **Data guard:** payment method manual hanya tampilkan label publik & instruksi (mis. nomor rekening/QRIS statis untuk ditunjukkan ke pembeli), tanpa credential/token/secret apa pun.

## 6. Catalog / Product and Menu

- **Availability:** Core
- **Shell:** §3.1, contoh persis di referensi "Manage Dishes"
- **Layar:** Category sidebar list → Product grid (dengan checkbox seleksi) → Product form (image, deskripsi, harga, variant, modifier) → Outlet price override table → Availability toggle.
- **Komponen:** persis §4.4 (kategori chip/sidebar list) + §4.5 (product card), image uploader = kotak dashed placeholder identik dengan "Add New Dish" tile di referensi, variant/modifier editor = repeatable row list (nama + harga tambahan, tombol "+ Tambah Variant" gaya secondary), outlet override table pakai §4.6.
- **Status vocabulary:** availability = **success** (tersedia) / **danger** (habis, manual sold-out).
- **Data guard:** cost/HPP tidak boleh muncul di form catalog ini kecuali dibuka lewat surface Inventory/Finance yang berhak; harga yang tampil di sini adalah harga jual, bukan cost.

## 7. Order Core

- **Availability:** Core (dipakai POS/Self-Order)
- **Shell:** tidak punya shell sendiri — ini adalah **data model** yang muncul di §3.2 (POS), §3.3 (KDS), §3.5 (customer). Tidak ada layar "Order Core" berdiri sendiri untuk merchant selain riwayat/detail order.
- **Layar tambahan:** Order detail drawer (dibuka dari Order Line/riwayat) menampilkan timeline status.
- **Komponen:** §4.11's timeline/stepper varian — deretan status horizontal (draft → submitted → accepted → preparing → ready → served → completed) dengan titik aktif ditandai bucket **info**, titik selesai ditandai bucket **success**, batal ditandai bucket **danger** dan memutus rantai.
- **Data guard:** idempotency key, order internal ID, actor ID tidak tampil; hanya nomor order publik (mis. "#F0027") yang boleh terlihat, dan itu bukan ID database asli — mapping dilakukan di backend.

## 8. Bill Core

- **Availability:** Core
- **Shell:** muncul sebagai bagian dari §3.2 context panel (POS) dan §3.5 (customer request bill)
- **Layar:** Bill summary panel — identik pola §4.8 (list item, subtotal/tax/service/total), plus tombol "Request Bill" di sisi customer (primary button, muncul setelah minimal satu order submitted).
- **Komponen:** §4.8 penuh; tidak ada tambahan baru.
- **Data guard:** bill internal ID disembunyikan; yang tampil nomor bill publik + isi rincian saja.

## 9. Payment Ledger Core

- **Availability:** Core
- **Shell:** bagian dari §3.2 context panel + riwayat pembayaran di §3.1 (Reports/Finance)
- **Layar:** Payment confirmation dialog (saat cashier tandai lunas) → Payment status badge di order card & bill → Refund record form (alasan wajib) → Payment method rekap (masuk ke Reports, modul 19).
- **Komponen:** §4.11 dialog konfirmasi (khusus payment & refund selalu perlu "server acknowledgement" — tombol berubah ke loading state lalu ke state sukses/gagal eksplisit, tidak boleh optimistic-update tanpa konfirmasi server), badge pakai bucket Payment (§2.2).
- **Data guard:** payment provider raw response, internal payment ID, idempotency key tidak tampil.

## 10. POS dan Cashier

- **Availability:** Paket POS Basic ke atas
- **Shell:** §3.2 POS Shell (referensi persis "Order Line")
- **Layar:** Order Line (grid produk + filter tab status) → Cart/context panel kanan → Hold order list → Shift open/close form → Cash in/out form → Variance alert.
- **Komponen:** §4.3 filter tab (All/Dine in/Wait List/Take Away/Served), §4.4 kategori chip, §4.5 product card + stepper, §4.8 context panel penuh (item, ringkasan bayar, metode bayar, tombol Print + Place Order), §4.11 dialog untuk void/cancel (wajib alasan) dan manager approval PIN.
- **Status vocabulary:** tab count & order card pakai bucket Order (§2.2): Wait List = warning, In Kitchen/preparing = info, Ready = info, Served/Completed = success.
- **Data guard:** POS tidak menampilkan cost/HPP, data pribadi customer di luar nama (jika ada), payment provider payload, atau ID internal apa pun. Shift closing & payment confirmation wajib dialog + server acknowledgement (§4.11, §4.12 retry state).

## 11. Cafe Profile / Digital Storefront

- **Availability:** Paket Profile ke atas
- **Shell:** §3.5 Customer Mobile Self-Order Shell (untuk publik), plus form editor di §3.1 (Settings > Profile, lihat modul 5)
- **Layar publik:** Header brand (logo, banner, nama, jam buka/tutup badge) → kategori chip horizontal → list menu (foto bulat + nama + harga) → product detail sheet (deskripsi, variant, modifier sebagai info, bukan cart jika paket Profile murni tanpa POS/Self-Order).
- **Komponen:** §4.4 kategori chip versi mobile (scroll horizontal), §4.5 product card versi list (bukan grid, untuk layar sempit), open/closed banner pakai bucket **success**/**neutral**.
- **Data guard:** tidak ada elemen table layout, session, atau payment yang bocor ke storefront publik murni (paket Profile tidak include order/table).

## 12. Table Layout dan Table Management

- **Availability:** Cafe Digital ke atas
- **Shell:** §3.1, referensi persis "Manage Tables"
- **Layar:** Floor tab (Main Dining/Terrace/Outdoor) → Legend status → Table layout canvas (drag grid) → Table tile detail (buka session, pindah meja) → Reservation list kiri → QR manager per meja (generate/print/revoke/rotate).
- **Komponen:** §4.9 table layout canvas penuh, legend memakai bucket Table (§2.2): available=success, on dine=info, reserved=warning, inactive=neutral. QR manager = card kecil per meja dengan thumbnail QR + tombol Print/Download (secondary) + Revoke (destructive, via dialog §4.11).
- **Data guard:** drag-and-drop hanya mengubah posisi grid (x/y, floor) — tidak pernah menyentuh data order/session dari tile yang sama. QR token mentah tidak ditampilkan sebagai teks, hanya sebagai gambar QR/tombol aksi.

## 13. QR Self-Order

- **Availability:** Cafe Digital ke atas
- **Shell:** §3.5 Customer Mobile Self-Order Shell
- **Layar:** Landing setelah scan (resolve ke outlet + label meja publik) → Guest menu (kategori chip + product card list) → Cart sheet (bottom sheet, bukan halaman baru) → Order status tracker → "Minta Bill" → "Klaim sudah bayar".
- **Komponen:** sticky cart bar (varian §4.8 versi ringkas, satu baris: total item + total harga + tombol "Lihat Keranjang"), order status tracker pakai varian stepper dari §7 (Order Core), status "verifying" (klaim bayar) pakai bucket **warning** sampai kasir verifikasi jadi **success**.
- **Data guard:** customer tidak pernah menerima QR token mentah, internal table ID, coordinate layout, atau session/payment data mentah — hanya label meja publik & status pesanan.

## 14. Kitchen Display System / KDS

- **Availability:** Cafe Digital ke atas
- **Shell:** §3.3 KDS Kiosk Shell
- **Layar:** Ticket grid utama (satu station) → Ticket detail expand (item, modifier, note, allergy) → History tab (hari berjalan) → Connection/reconnect bar.
- **Komponen:** ticket card = varian besar dari §4.7 order card, ukuran tipografi dinaikkan (§3.3), badge SLA/elapsed time pakai bucket KDS (§2.2): new=warning, accepted/preparing=info, ready=success, served/completed=neutral. Audio alert = indikator visual (border kiri berdenyut halus) + toggle mute/unmute ikon di header, bukan pop-up yang menutupi ticket lain.
- **Data guard:** tidak menampilkan harga, HPP, payment, kontak/identitas customer, token, atau ID internal ticket/order/table — hanya read model dapur (item, qty, modifier, note, label meja, waktu).

## 15. Inventory Basic

- **Availability:** Cafe Operations ke atas
- **Shell:** §3.1
- **Layar:** Ingredient/item list (§4.6) → Item form (unit/conversion) → Stock movement log → Adjustment form (alasan wajib) → Stock opname workflow (multi-step) → Waste form → Transfer form → Recipe/BOM editor (link ke Catalog modul 6) → Low-stock alert list.
- **Komponen:** §4.6 table untuk item & movement, §4.11 dialog untuk adjustment/waste/transfer (selalu perlu alasan + server acknowledgement), stock indicator pakai bucket Stock (§2.2): ok=success, low=warning, out=danger, adjustment/waste/transfer=neutral.
- **Data guard:** stock movement tidak pernah dihapus permanen di UI (hanya tombol "Sesuaikan" yang buat entri baru, bukan edit/hapus histori). Calculated balance/cost tidak jadi field yang bisa diketik user — selalu derived display.

## 16. Purchasing Basic

- **Availability:** Cafe Operations ke atas (bagian dari Inventory Basic)
- **Shell:** §3.1 (tab/section di dalam modul Inventory)
- **Layar:** Supplier list/form → Purchase order sederhana (pilih item, qty, supplier) → Goods receipt form (konfirmasi barang diterima, update stock).
- **Komponen:** §4.6 table supplier & PO, §4.11 dialog konfirmasi goods receipt (server acknowledgement wajib karena mengubah stock ledger).
- **Data guard:** sama seperti modul 15 — goods receipt menambah entri ledger baru, tidak mengedit historis.

## 17. Finance Basic

- **Availability:** Cafe Operations ke atas
- **Shell:** §3.1
- **Layar:** Finance dashboard (metric card: revenue, expense, gross profit, operating profit) → Cashbook table → Income/expense form (dengan attachment opsional) → Reconciliation panel per shift/metode bayar → Report per outlet/consolidated.
- **Komponen:** metric card = varian ringkas dari §4.9-style card tapi tanpa canvas, hanya angka besar (`text-price` diperbesar) + label kecil "estimasi" (§5 data guard) di bawahnya; §4.6 table untuk cashbook & report; date-range filter bar (input + preset chip "Hari ini/Minggu ini/Bulan ini").
- **Data guard:** semua angka margin/HPP di modul ini WAJIB diberi label estimasi (§5); tidak boleh bocor ke POS/KDS/customer-facing manapun.

## 18. Customer Basic

- **Availability:** Cafe Operations ke atas
- **Shell:** §3.1
- **Layar:** Customer list (§4.6) → Customer detail (nama/telepon opsional, catatan, riwayat transaksi, total visits/purchase) → Customer order-status page (sisi customer, pakai §3.5).
- **Komponen:** §4.6 table + detail drawer (bukan halaman penuh, konsisten dengan pola drawer di modul 1), history sebagai timeline sederhana.
- **Data guard:** data customer terisolasi per tenant; identitas/kontak tidak pernah dikirim ke KDS atau context customer di table layout/self-order.

## 19. Reports dan Analytics

- **Availability:** POS Basic ke atas (bertingkat sesuai paket)
- **Shell:** §3.1
- **Layar:** Dashboard metric card ringkas → Segmented report tabs (Sales/Operational/Inventory/Finance sesuai entitlement) → Filter bar (date range, outlet, channel, payment method) → Data table + chart per tab → Export action (jika aktif).
- **Komponen:** metric card sama seperti modul 17, chart wrapper (satu gaya chart konsisten — line untuk tren, bar untuk perbandingan kategori/outlet, keduanya pakai warna `color-brand-600` sebagai seri utama dan abu-abu untuk pembanding), no-data state pakai §4.12.
- **Data guard:** report hanya tampilkan data outlet/tenant yang diizinkan untuk role user tsb; tidak ada raw ID atau data tenant lain yang bisa bocor lewat filter.

## 20. Device, Printer, dan PWA

- **Availability:** Core (device/printer), Core-teknis (PWA) untuk semua device mode
- **Shell:** overlay di semua shell (bukan shell sendiri)
- **Layar:** Install prompt/banner (muncul di atas topbar, dismissable), device-mode selector (saat login pertama di device baru — pilih POS/KDS/Backoffice/Inventory), printer test-print card (lihat modul 5), offline/online indicator persistent kecil di topbar/header KDS.
- **Komponen:** connection indicator pakai bucket Connection (§2.2), stale-data banner (§4.12) muncul saat cache lebih lama dari X menit, retry button standar (§4.10 secondary).
- **Data guard:** cache tidak boleh menyimpan `/api/`, payment, stock operation, token, atau audit data — hanya last-known menu/cart/display untuk UI, semua aksi mutasi wajib tunggu server acknowledgement sebelum UI menandai sukses.

## 21. Audit, Idempotency, Security, dan Support

- **Availability:** Core & Platform-only
- **Shell:** §3.1 (merchant-side audit log ringkas di Settings), §3.4 (platform support tools)
- **Layar:** Audit-safe event list (merchant, hanya aksi miliknya sendiri) → Platform support access log (siapa buka data siapa, dengan reason & expiry) → Session/device security list (lihat modul 3).
- **Komponen:** §4.6 table + timeline, semua entri **read-only**, tidak ada tombol edit pada baris audit — hanya lihat detail (drawer).
- **Data guard:** actor ID mentah tidak tampil (tampilkan nama staff, bukan ID); audit payload mentah tidak pernah dirender; support access wajib menampilkan alasan & masa berlaku secara eksplisit ke merchant jika relevan (transparansi akses).

## 22. Integrated Payment Add-on *(Add-on Future)*

- **Availability:** Add-on Future — belum diproduksi sebagai flow nyata sampai PRD & approval PJP selesai
- **Shell konsep:** perluasan §3.2 (payment method selector POS) & §3.5 (checkout customer), plus §3.1 untuk provider setup
- **Konsep layar (desain jangka panjang, bukan untuk dibangun sekarang):** Provider setup wizard (multi-step) → KYC status tracker (pakai bucket Subscription-style: trial-like "pending", success "verified", danger "rejected") → Dynamic QR payment screen (QR + countdown timer + status polling) → Settlement report (§4.6 table) → Refund/dispute workflow (§4.11 dialog + status tracker §7).
- **Data guard:** API key, webhook secret, signature, provider raw payload, dan settlement internal payload tidak boleh dirender dalam bentuk apa pun — bahkan di rencana desain ini.

## 23. Promotion dan Pricing *(Future roadmap)*

- **Availability:** Add-on Future / roadmap (§17 feature-inventory)
- **Shell konsep:** §3.1, bersebelahan dengan modul Catalog (6)
- **Konsep layar:** Promo/discount rule builder (kondisi + aksi, form bertahap) → Promo list dengan status (bucket: active=success, scheduled=info, expired=neutral) → Preview dampak harga di catalog.
- **Catatan:** ini konsep desain jangka panjang saja — jangan dibangun sebagai flow produksi sebelum PRD tersedia (lihat `feature-inventory.md` §17).

## 24. Customer CRM / Loyalty *(Future roadmap)*

- **Availability:** Future CRM, di atas Customer Basic (modul 18)
- **Shell konsep:** perluasan §3.1 modul Customer Basic
- **Konsep layar:** Loyalty tier list → Voucher personal → Segmentasi/campaign builder → Feedback list.
- **Data guard:** tetap ikuti isolasi data customer per tenant (modul 18); campaign tidak boleh expose kontak customer ke surface yang tidak berhak.

## 25. Advanced Inventory dan Purchasing *(Future roadmap)*

- **Availability:** Future, di atas modul 15 & 16
- **Shell konsep:** §3.1, tab lanjutan di dalam modul Inventory
- **Konsep layar:** Multi-warehouse selector → Batch/expiry tracking di item detail → Purchase request/approval flow (pakai §4.11 dialog approval) → Purchase order formal + retur → Forecasting chart (§19 chart wrapper).

## 26. Finance / Accounting Advanced *(Future roadmap)*

- **Availability:** Future, di atas modul 17
- **Shell konsep:** §3.1, tab lanjutan di dalam modul Finance
- **Konsep layar:** Chart of accounts tree → Journal entry form → Ledger table → Balance sheet report → Closing period workflow.
- **Catatan:** harus jelas dipisah secara label dari Finance Basic (yang tetap berlabel "estimasi") agar user tidak salah anggap Finance Basic = akuntansi formal.

## 27. Notifications *(Future roadmap)*

- **Availability:** Future (push/email/WhatsApp — §17)
- **Shell konsep:** overlay lintas shell (notification center, ikon lonceng di topbar §4.2 yang sudah ada dikembangkan jadi dropdown/list penuh)
- **Konsep layar:** Notification list (grouped by hari) → Notification template management (platform-only, §3.4) → Preferensi channel per user.
- **Komponen:** list item = varian ringkas §4.7, badge unread pakai bucket **info**.

## 28. Integrations / API / Webhook *(Future roadmap)*

- **Availability:** Future (Public/Open API — §17); webhook config untuk Payment Add-on juga masuk sini secara konsep
- **Shell konsep:** §3.4/§3.1 Settings > Integrations
- **Konsep layar:** API key management (generate/revoke, tampilkan key hanya sekali saat generate) → Webhook endpoint list + delivery status (bucket Connection §2.2) → Integration partner list (card grid, mirip §4.4 kategori chip tapi untuk partner logo).
- **Data guard:** API key/secret ditampilkan penuh HANYA sekali saat pembuatan; setelah itu selalu masked (••••••••1234).

## 29. Marketplace / Delivery / Reservation *(Future roadmap)*

- **Availability:** Future (§17)
- **Shell konsep:** Delivery mengikuti §3.2 (order masuk sebagai channel baru di Order Line, chip channel tambahan di §4.3); Reservation mengikuti §3.1 seperti panel kiri "Manage Tables" yang sudah ada (reservation list sudah tersedia polanya di modul 12); Marketplace sebagai storefront gabungan mengikuti §3.5.
- **Catatan:** karena pola reservation & channel order sudah ada contoh visualnya (referensi "Manage Tables"), modul ini lebih mudah — cukup perluas komponen yang sudah ada, bukan bikin baru.

## 30. Franchise, Multi-brand Advanced, dan Central Kitchen *(Future roadmap)*

- **Availability:** Future (§17)
- **Shell konsep:** §3.4 Platform Admin Shell, dengan tambahan level hierarki brand-group di atas tenant switcher (modul 2)
- **Konsep layar:** Brand-group dashboard (agregat lintas brand) → Central kitchen stock transfer (perluasan modul 15/16 transfer outlet, di-generalisasi lintas brand) → Franchise royalty/report (perluasan modul 19).

---

## Cara pakai ringkas untuk agent

1. Buka modul yang sedang dikerjakan di dokumen ini.
2. Catat: shell (§3.x), komponen (§4.x), bucket status yang relevan (§2.2), dan data guard-nya.
3. Buka `design-system.md` untuk token pasti (warna/radius/spacing/tipografi) — jangan menebak dari deskripsi modul ini saja.
4. Untuk modul berlabel *(Future roadmap)*/*(Add-on Future)*: hanya buat sebagai **desain konsep/dokumentasi**, bukan kode produksi, sampai ada PRD resmi (sesuai `feature-inventory.md` §17).
