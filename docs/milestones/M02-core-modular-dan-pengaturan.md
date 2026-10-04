# M2 — Core modular dan pengaturan

**Status:** Berjalan
**Tahap PRD:** B (Core modular)
**Bergantung pada:** M1

## 1. Tujuan

Mengubah entitlement dari "boolean per modul" menjadi platform modular yang sesungguhnya: paket berversi, instalasi modul, capability per tier, limit dan pemakaian, binding antarmodul, serta event yang dikirim dan diterima dengan aman. Owner dapat mengelola organisasi, pengguna, peran, perangkat, langganan, dan integrasi dari halaman Pengaturan. Struktur backend dipindah ke bentuk target agar batas modul bisa dijaga otomatis.

Setelah M2, setiap modul berikutnya cukup "dipasang" ke core tanpa menambah logika akses sendiri.

## 2. Cakupan

**Termasuk:** tabel `core_*` (schema B.2) dan penyesuaian tabel lama (B.1); evaluator akses efektif; dispatcher outbox dan inbox di worker; registry manifest modul; metering dan limit; perangkat dan sesi per surface; idempotency generik; penyimpanan berkas; halaman Pengaturan; state akses modul di UI; restrukturisasi backend dan kontrak.

**Tidak termasuk:** Package Builder dan pengelolaan langganan oleh operator platform (M8); laporan (M8).

## 3. Kriteria selesai

- [ ] Provisioning workspace dengan paket berversi dan provisioning satu modul sama-sama idempotent.
- [ ] Untuk setiap aksi, API membedakan alasan gagal: langganan, instalasi, capability, izin, lokasi, feature flag, limit.
- [ ] UI menampilkan `ModuleAccessState` dan `UsageLimitState` yang sesuai alasan, bukan error umum.
- [ ] Event dari outbox dikirim worker ke handler terdaftar; event ganda tidak diproses dua kali (inbox).
- [ ] POS-only tetap berjalan tanpa error ketika tidak ada modul penerima event.
- [ ] Downgrade dan suspend tidak menghapus riwayat; batas hard menolak pembuatan baru tanpa mematikan data lama.
- [ ] Lint batas modul aktif di CI dan lulus.
- [ ] Owner dapat mengundang pengguna, mengatur peran dan cakupan lokasi, mendaftarkan dan mencabut perangkat POS, serta melihat pemakaian vs batas.

## 4. Task

### FT — Fitur produk

- [ ] **M2-FT-01 Pengaturan organisasi** — ubah nama bisnis, brand, outlet (alamat, zona waktu, mata uang).
- [ ] **M2-FT-02 Pengguna dan undangan** — undang lewat email dengan peran dan lokasi; status menunggu; cabut akses.
- [ ] **M2-FT-03 Peran dan izin** — daftar peran sistem dan kustom; atur izin per peran dengan bahasa yang mudah dimengerti.
- [x] **M2-FT-04 Perangkat** `b4a3f62` — daftarkan perangkat POS/KDS dengan kode sekali pakai, lihat status terakhir terlihat, cabut. Secret tidak pernah tampil lagi setelah provisioning.
- [x] **M2-FT-05 Langganan dan pemakaian** `324e534` — paket aktif, modul dan tier, pemakaian vs batas per dimensi; saat batas tercapai tombol tetap tampil dengan penjelasan dan ajakan upgrade.
- [ ] **M2-FT-06 Integrasi antarmodul** — daftar binding (misalnya POS → Keuangan) dengan status `Aktif`/`Perlu setup`/`Gagal` dan tombol coba ulang.
- [x] **M2-FT-07 Gambar produk** — unggah gambar produk di Catalog dan tampilkan di kartu produk POS.
- [ ] **M2-FT-08 Persetujuan manager untuk refund** (dari `M1-FT-10`) — kasir tanpa izin refund meminta persetujuan manager dengan PIN (`flowchart.md` 5.4). PIN diatur dan direset di pengaturan pengguna (`M2-FT-02`). Selesai bila: PIN tersimpan ber-hash; salah PIN dibatasi; persetujuan diaudit dengan nama penyetuju.
- [ ] **M2-FT-09 Pajak dan service charge per outlet** (dari `M1-FT-14`) — pola "harga sudah termasuk" atau "ditambahkan di struk" dan tarif per outlet, diatur di pengaturan outlet (`M2-FT-01`). Bawaan tetap mengikuti keputusan `M1-OD-01`: harga menu adalah harga akhir. Selesai bila: total pesanan, struk, dan ringkasan shift konsisten untuk kedua pola.

### BE — Backend dan data

- [x] **M2-BE-01 Penyesuaian tabel lama (B.1)** `2c913ed` — `tenants.type/template/currency/timezone`, `outlets.address`, kolom tambahan `outbox_events` dan `audit_logs`, `idempotency_keys.outlet_id` nullable.
- [x] **M2-BE-02 Paket berversi** `d5a29e6` — `core_packages`, `core_package_versions`, modul, capability, limit; versi `PUBLISHED` tidak dapat diubah; migrasi data dari `plans`.
- [x] **M2-BE-03 Langganan dan add-on** `10f1c76` — `subscriptions` merujuk versi paket; `core_subscription_addons`; status `DRAFT` dan `CANCELED_AT_PERIOD_END`.
- [x] **M2-BE-04 Override entitlement** `ff07cd5` — `core_entitlement_overrides` menggantikan `tenant_entitlements`, dengan alasan, masa berlaku, dan pelaku.
- [x] **M2-BE-05 Evaluator akses efektif** `3dec964` — projection `core_effective_entitlements`; guard memeriksa urutan `architecture.md` 6.3 dan mengembalikan kode alasan berbeda. Dikerjakan dalam tiga checkpoint: evaluator dan kode alasan (13.10), modul/tier dari versi paket dan projection (13.11), penghapusan tabel lama (13.12).
- [x] **M2-BE-06 Instalasi modul** `3fb7ced` — `core_module_installations` dan `core_module_configs` dengan lifecycle `architecture.md` 6.1; event `module.installed.v1`.
- [x] **M2-BE-07 Registry manifest** `90f4afb` — tiap modul mendeklarasikan izin, capability, event yang dihasilkan dan dikonsumsi, ketergantungan; dipakai navigasi dan validasi paket.
- [x] **M2-BE-08 Binding integrasi** `67ad6c3` — `core_integration_bindings` dengan status dan health; handler hanya berjalan bila binding aktif.
- [x] **M2-BE-09 Dispatcher outbox** `cc2e4e6` — worker mengambil `outbox_events`, mengirim ke handler, retry dengan backoff, tanda gagal permanen.
- [x] **M2-BE-10 Inbox** `cc2e4e6` — `core_inbox_events`, unik per consumer dan event; handler idempotent.
- [x] **M2-BE-11 Metering dan limit** `bd4c541` — `core_usage_dimensions` (25 dimensi), event pemakaian, counter, adjustment, notifikasi ambang; penegakan hard/soft/throttled sesuai `prd.md` 7.1.
- [x] **M2-BE-12 Perangkat** `2c44692` — `core_devices` dengan kredensial ber-hash; sesi perangkat untuk POS/KDS terpisah dari sesi pengguna.
- [ ] **M2-BE-13 Feature flag** — `core_feature_flags` dan pemeriksaan di guard.
- [ ] **M2-BE-14 Idempotency generik** — interceptor yang memakai tabel `idempotency_keys` dengan hash permintaan, untuk endpoint yang belum punya kunci domain sendiri.
- [x] **M2-BE-15 Penyimpanan berkas** `3b7a486` — URL unggah bertanda tangan ke object storage, validasi tipe dan ukuran, kunci objek per workspace.
- [ ] **M2-BE-16 Undangan pengguna** — token undangan ber-hash dengan masa berlaku; penerimaan undangan membuat keanggotaan.
- [x] **M2-BE-17 CommandContext** `b815343` — channel, perangkat, correlation, causation, client version pada setiap perintah dan event (`backend.md` 4.1).

### UX — Alur dan interaksi

- [x] **M2-UX-01 Navigasi dari manifest** `dc02f64` — menu Backoffice disusun dari modul terpasang, entitlement, dan izin.
- [~] **M2-UX-02 State akses modul** — membuka modul yang tidak dimiliki, belum dipasang, belum diatur, tanpa izin, atau kena limit menampilkan state yang tepat (`design-system.md` 16.1–16.2). Selesai (13.16): tidak dimiliki, belum dipasang/diatur, sedang disiapkan, dijeda, tanpa izin, langganan ditangguhkan. Selesai (13.24): state kena limit untuk pembuatan produk. Sisa: state kena limit di halaman pengaturan yang belum ada (brand, outlet, anggota, peran) dan aksi per state (menunggu halaman Pengaturan, `M2-UX-03`).
- [ ] **M2-UX-03 Halaman Pengaturan** — Organisasi, Pengguna, Peran, Perangkat, Langganan, Integrasi sesuai `flowchart.md` 12, satu halaman per bagian.
- [ ] **M2-UX-04 Alur undangan** — email undangan → halaman terima undangan → set kata sandi → masuk.
- [x] **M2-UX-05 Aktivasi perangkat POS** `cb10fc4` — layar aktivasi di perangkat dengan kode; sesudahnya POS terbuka di outlet perangkat.

### DS — Design system dan komponen

- [x] **M2-DS-01 `ModuleAccessState`** `c38ae7d` — varian per alasan; satu aksi relevan per varian.
- [x] **M2-DS-02 `UsageLimitState` dan meter pemakaian.** `7f0782a`
- [x] **M2-DS-03 `FileUpload`** `9c654bb` — pilih, pratinjau, progres, error, ganti; label lewat props.
- [x] **M2-DS-04 Komponen perangkat** `94ea01b` — `DeviceStatusBadge`, `NetworkSyncIndicator`, `StaleDataBanner`.
- [ ] **M2-DS-05 Matriks izin** — tampilan izin per peran yang mudah dipindai.
- [ ] **M2-DS-06 `PinInput`** (dari `M1-DS-08`) — isian PIN bertopeng untuk persetujuan manager; label lewat props.
- [ ] **M2-DS-07 `MultiSelect`** (dari `M1-DS-09`) — hanya bila ada layar yang membutuhkannya.

### AS — Aset

- [ ] **M2-AS-01 Template email** — undangan dan reset kata sandi, dua bahasa, teks polos + HTML sederhana, memakai wordmark M1.
- [x] **M2-AS-02 Placeholder gambar produk** `5057659` — ikon netral saat gambar belum ada (tanpa teks), ukuran thumbnail yang dihasilkan saat unggah.

### SC — Keamanan dan privasi

- [x] **M2-SC-01 Masa sesi per surface** `379aa77` — Backoffice lebih pendek, POS/KDS terikat perangkat (`SEC-F5`).
- [x] **M2-SC-02 Validasi unggah berkas** `3b7a486` — tipe raster saja untuk gambar, batas ukuran, tanpa path traversal, URL bertanda tangan berumur pendek.
- [x] **M2-SC-03 Pencabutan** `2415eb3` — mencabut perangkat atau pengguna mematikan sesi aktifnya.
- [x] **M2-SC-04 Test alasan akses** `0ff8a37` — satu test per alasan gagal di guard.
- [x] **M2-SC-05 Payload event aman** `634b639` — tidak ada PII atau secret di outbox; diuji.

### QA — Kualitas kode dan test

- [x] **M2-QA-01 Pindah ke `core/`, `kernels/`, `modules/`** `fba8446`..`a4f3eba` — satu folder per commit, perilaku tidak berubah (`backend.md` 2.2).
- [ ] **M2-QA-02 Pecah Catalog** — `kernels/catalog` + `modules/catalog-profile`, satu use case per file; repository 1.226 baris dipecah.
- [x] **M2-QA-03 Pecah `packages/contracts`** `8ffd658` — satu file per domain dengan indeks ekspor.
- [x] **M2-QA-04 Lint batas modul** `4380439` — aturan impor `backend.md` 3 dijalankan di lint dan CI.
- [ ] **M2-QA-05 Integration test PostgreSQL sekali pakai** — database test terisolasi untuk repository dan constraint (gerbang TODO Tahap 9).
- [x] **M2-QA-06 Test kombinasi modul** `67ad6c3` — POS-only, POS dengan binding mati, POS dengan binding aktif tanpa penerima.

### OP — Operasional dan dokumentasi

- [x] **M2-OP-01 Compose lokal** `dccb19f` — PostgreSQL, Redis, object storage lokal (MinIO) untuk pengembangan.
- [x] **M2-OP-02 Redis dan BullMQ** `3fd9486` — untuk worker dan rate limit lintas instance (`SEC-F3`).
- [ ] **M2-OP-03 Runbook** — provisioning workspace dan paket; binding gagal dan coba ulang event; antrean outbox menumpuk.
- [ ] **M2-OP-04 Perbarui dokumen** — `schema.md` B.1–B.2 menjadi "berjalan"; `architecture.md` 6–7; `backend.md` 1.

## 5. Urutan checkpoint yang disarankan

1. M2-QA-01, M2-QA-03, M2-QA-04 — restrukturisasi dulu agar kode baru langsung di tempatnya.
2. M2-BE-01, M2-OP-01, M2-OP-02.
3. M2-BE-02 → M2-BE-03 → M2-BE-04 → M2-BE-05 → M2-SC-04.
4. M2-BE-06, M2-BE-07, M2-UX-01, M2-DS-01, M2-UX-02.
5. M2-BE-09, M2-BE-10, M2-BE-08, M2-BE-17, M2-SC-05, M2-QA-06.
6. M2-BE-11, M2-DS-02, M2-FT-05.
7. M2-BE-12, M2-SC-01, M2-SC-03, M2-DS-04, M2-FT-04, M2-UX-05.
8. M2-BE-15, M2-SC-02, M2-DS-03, M2-AS-02, M2-FT-07.
9. M2-BE-16, M2-AS-01, M2-UX-04, M2-FT-02, M2-FT-03, M2-DS-05, M2-FT-01, M2-UX-03, M2-FT-06.
10. M2-BE-13, M2-BE-14, M2-QA-02, M2-QA-05, M2-OP-03, M2-OP-04.

## 6. Referensi

`prd.md` 6–8 · `architecture.md` 6–8 · `schema.md` B.1–B.2 · `backend.md` 2–6, 10–11 · `security.md` 7–8, 12 · `flowchart.md` 2.3, 12, 14.2 · `design-system.md` 16 · Module Tiers v1.2 · Packages and Limits v1.2.
