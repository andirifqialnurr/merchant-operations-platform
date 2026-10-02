# M8 — Platform Admin dan laporan

**Status:** Belum mulai
**Tahap PRD:** I (Platform Admin + Reports)
**Bergantung pada:** M2; laporan modul bergantung pada M3–M7

## 1. Tujuan

Operator SaaS mengelola workspace, paket berversi, langganan, override, limit, status integrasi, dan akses support dari Platform Admin. Pelanggan mendapat laporan dasar yang melekat pada tiap modul, dibangun dari projection yang dapat dibangun ulang.

## 2. Cakupan

**Termasuk:** surface `(platform)`; daftar dan detail workspace; buat workspace dengan template dan paket (provisioning); Package Builder dengan validasi ketergantungan; langganan dan add-on; override beralasan dan bermasa berlaku; pemakaian vs batas; status binding dan coba ulang event; akses support beralasan, berbatas waktu, dan diaudit; audit platform; laporan dasar per modul.

**Tidak termasuk:** penagihan otomatis dan payment gateway; analytics lintas modul tier Pro (setelah R1).

## 3. Kriteria selesai

- [ ] Workspace baru dibuat dengan template dan paket; provisioning lokasi bawaan, owner, dan instalasi modul idempotent.
- [ ] Versi paket yang dipublikasikan tidak dapat diubah; mengedit membuat versi baru; pelanggan lama tetap pada versinya.
- [ ] Paket yang ketergantungan modulnya tidak terpenuhi ditolak dengan alasan dan saran perbaikan.
- [ ] Akses support selalu beralasan, bermasa berlaku, menampilkan banner konteks, dan tercatat di audit.
- [ ] Laporan penjualan harian, KDS, inventory, keuangan, dan HC tersedia sesuai modul terpasang dan dapat dibangun ulang.

## 4. Task

### FT — Fitur produk

- [ ] **M8-FT-01 Daftar dan detail workspace** — langganan, modul dan tier, pemakaian, override, integrasi, audit.
- [ ] **M8-FT-02 Buat workspace** — nama, template, paket, email owner.
- [ ] **M8-FT-03 Package Builder** — draft modul, tier, capability, batas; validasi; publikasi versi.
- [ ] **M8-FT-04 Ganti paket dan add-on** — termasuk downgrade yang tidak menghapus data.
- [ ] **M8-FT-05 Override** — tambah/cabut dengan alasan dan masa berlaku.
- [ ] **M8-FT-06 Integrasi** — status binding, event gagal, coba ulang.
- [ ] **M8-FT-07 Akses support** — minta akses dengan alasan, cakupan, dan durasi; cabut.
- [ ] **M8-FT-08 Laporan penjualan** — harian per outlet dan gabungan; per produk, per metode bayar.
- [ ] **M8-FT-09 Laporan modul lain** — KDS (waktu siap), inventory (mutasi, waste), keuangan (periode), HC (kehadiran).
- [ ] **M8-FT-10 Ekspor laporan** — CSV, tidak pernah diblokir kuota.

### BE — Backend dan data

- [ ] **M8-BE-01 API platform** — memakai sesi platform terpisah; semua aksi diaudit.
- [ ] **M8-BE-02 Provisioning workspace** — satu perintah idempotent untuk lokasi bawaan, owner, instalasi, langganan.
- [ ] **M8-BE-03 Validasi paket** — ketergantungan modul dari manifest.
- [ ] **M8-BE-04 Support access grants** — `core_support_access_grants` dan guard yang menghormati cakupan dan masa berlaku.
- [ ] **M8-BE-05 Projection laporan** — `report_*` dibangun dari event; perintah bangun ulang.
- [ ] **M8-BE-06 Coba ulang event** — dari inbox gagal untuk binding tertentu.

### UX — Alur dan interaksi

- [ ] **M8-UX-01 Shell Platform Admin** — rute `(platform)`, tabel padat, navigasi sendiri.
- [ ] **M8-UX-02 Banner konteks support** — selalu tampil di Backoffice saat sesi support aktif.
- [ ] **M8-UX-03 Halaman laporan per modul** — filter periode dan lokasi, chart dan tabel tanpa data ganda.

### DS — Design system dan komponen

- [ ] **M8-DS-01 Rapikan komponen platform** — `PlatformEntitlementMatrix`, `PlatformSupportAudit`, `PlatformTenantSubscriptionMaster`.
- [ ] **M8-DS-02 Package Builder dan panel instalasi/binding** (design-system 21.2, P2).
- [ ] **M8-DS-03 Pola laporan** — kartu metrik, chart periode, tabel ringkasan, ekspor.

### AS — Aset

- [ ] **M8-AS-01 Format ekspor laporan** — nama berkas, kolom, dan pemisah terdokumentasi; dua bahasa untuk header kolom.

### SC — Keamanan dan privasi

- [ ] **M8-SC-01 Pemisahan identitas platform dan merchant** — test bahwa sesi platform tidak membuka API merchant tanpa grant support.
- [ ] **M8-SC-02 Rate limit endpoint sensitif platform.**
- [ ] **M8-SC-03 Audit semua aksi platform** — termasuk melihat data pelanggan saat support.

### QA — Kualitas kode dan test

- [ ] **M8-QA-01 Test provisioning ganda** — tidak membuat duplikat.
- [ ] **M8-QA-02 Test downgrade dan suspend** — riwayat tetap, akses sesuai aturan.
- [ ] **M8-QA-03 Test bangun ulang projection** — hasil sama dengan data sumber.

### OP — Operasional dan dokumentasi

- [ ] **M8-OP-01 Akun platform lokal** — dicatat di `CREDENTIALS.local.md`.
- [ ] **M8-OP-02 Runbook** — provisioning, pencabutan sesi dan kredensial, bangun ulang laporan.
- [ ] **M8-OP-03 Perbarui dokumen** — `flowchart.md` 13, `schema.md` B.2 dan B.9.

## 5. Urutan checkpoint yang disarankan

1. M8-BE-01, M8-UX-01, M8-FT-01, M8-DS-01, M8-SC-01, M8-OP-01.
2. M8-BE-02, M8-FT-02, M8-QA-01.
3. M8-BE-03, M8-DS-02, M8-FT-03, M8-FT-04, M8-FT-05, M8-QA-02.
4. M8-BE-06, M8-FT-06.
5. M8-BE-04, M8-FT-07, M8-UX-02, M8-SC-03, M8-SC-02.
6. M8-BE-05, M8-DS-03, M8-UX-03, M8-FT-08, M8-FT-09, M8-FT-10, M8-AS-01, M8-QA-03.
7. M8-OP-02, M8-OP-03.

## 6. Referensi

`prd.md` 4.1, 7, 8 · `flowchart.md` 13 · `schema.md` B.2, B.9 · `design-system-modules.md` 4, 13 · `security.md` 7, 12–13.
