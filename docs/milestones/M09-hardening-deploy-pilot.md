# M9 — Hardening, deploy, dan pilot

**Status:** Belum mulai
**Tahap PRD:** J (Hardening + pilot) dan D-10 (hosting)
**Bergantung pada:** M1–M8

## 1. Tujuan

Memastikan Release 1 aman, cepat, dapat dipulihkan, dan dapat diakses, lalu memasangnya di VPS sendiri dengan Docker dan Nginx, dan menjalankan pilot dengan 2–3 merchant nyata.

## 2. Cakupan

**Termasuk:** audit keamanan dan isolasi; uji beban terhadap target kinerja; audit aksesibilitas dan visual semua surface; CSP; rate limit di Redis; trust proxy; image Docker; Compose produksi; Nginx dan TLS; CI/CD; backup harian ke luar VPS dan uji restore; monitoring dan peringatan; runbook; staging; tinjauan kepatuhan; pilot.

**Tidak termasuk:** skala multi-server, Kubernetes, failover otomatis (setelah R1).

## 3. Kriteria selesai

- [ ] Semua gerbang Release 1 di [`README.md`](./README.md) bagian 5 tercentang.
- [ ] Uji isolasi dua workspace dan substitusi ID lintas workspace lulus untuk semua endpoint.
- [ ] Target kinerja `prd.md` 9.5 terpenuhi pada data seukuran pilot.
- [ ] Semua surface R1 lulus audit S/M/L, terang/gelap, `id`/`en`, keyboard, dan axe tanpa pelanggaran serius.
- [ ] Staging berjalan dengan migrasi otomatis dan smoke test; produksi di VPS dengan TLS.
- [ ] Backup harian tersimpan di luar VPS dan restore sudah dicoba berhasil.
- [ ] Monitoring dan peringatan aktif; runbook tersedia.
- [ ] Tinjauan kepatuhan (`security.md` 15) selesai.
- [ ] 2–3 merchant pilot memakai aplikasi minimal dua minggu; masalah kritis ditutup.

## 4. Task

### FT — Fitur produk

- [ ] **M9-FT-01 Onboarding merchant** — dari undangan platform sampai transaksi pertama, diuji dengan pengguna nyata.
- [ ] **M9-FT-02 Pemberitahuan versi baru** — POS dan KDS memuat ulang pada saat aman, tidak di tengah transaksi (`deploy.md` 10).
- [ ] **M9-FT-03 Halaman error dan pemeliharaan** — 404, 500, dan mode pemeliharaan dua bahasa.

### BE — Backend dan data

- [ ] **M9-BE-01 Optimasi query** — indeks minimum `schema.md` 9 diverifikasi dengan `EXPLAIN` pada data pilot.
- [ ] **M9-BE-02 Deteksi klien usang** — `clientVersion` di CommandContext.
- [ ] **M9-BE-03 Masa simpan data** — penerapan keputusan `OD-08`.

### UX — Alur dan interaksi

- [ ] **M9-UX-01 Audit semua surface** — checklist `design-system.md` 23.3 per halaman.
- [ ] **M9-UX-02 Alur error dan offline** — `flowchart.md` 15 diuji: pesan, coba lagi, data tetap.
- [ ] **M9-UX-03 Zoom 200% Backoffice.**

### DS — Design system dan komponen

- [ ] **M9-DS-01 Audit kontras** — semua token pada kedua mode ≥4,5:1 untuk teks.
- [ ] **M9-DS-02 Bersihkan komponen tak terpakai** — ekspor `packages/ui` yang tidak dipakai surface mana pun dihapus atau dicatat alasannya.

### AS — Aset

- [ ] **M9-AS-01 Optimasi aset** — font subset, ikon PWA final, gambar produk dengan ukuran turunan, cache header statis.
- [ ] **M9-AS-02 Dokumen untuk merchant** — panduan singkat dua bahasa: mulai kasir, tutup shift, cetak QR meja.

### SC — Keamanan dan privasi

- [ ] **M9-SC-01 Content-Security-Policy** di web (`SEC-F7`).
- [ ] **M9-SC-02 Rate limit di Redis** dan rate limit endpoint sensitif (`SEC-F3`).
- [ ] **M9-SC-03 Trust proxy** untuk satu hop Nginx (`SEC-F4`).
- [ ] **M9-SC-04 Keputusan CSRF** — pertahankan satu origin atau ikat token ke sesi (`SEC-F2`).
- [ ] **M9-SC-05 Uji penetrasi ringan** — OWASP top 10 pada surface publik dan login.
- [ ] **M9-SC-06 Rotasi secret** dan penyimpanan secret produksi.
- [ ] **M9-SC-07 Keputusan RLS PostgreSQL** (`SCH-02`).
- [ ] **M9-SC-08 Tinjauan kepatuhan** — data pribadi, PSE, pajak, ketenagakerjaan.

### QA — Kualitas kode dan test

- [ ] **M9-QA-01 Uji isolasi penuh** — test otomatis substitusi ID untuk setiap endpoint.
- [ ] **M9-QA-02 Uji beban** — POS konfirmasi p95 ≤2 detik, rambatan event p99 ≤5 detik.
- [ ] **M9-QA-03 Uji kombinasi modul R1** — POS-only, POS + KDS + Inventory + Finance, KDS-only, Finance-only, HC-only.
- [ ] **M9-QA-04 Suite browser end-to-end** — alur kritis per surface di CI.

### OP — Operasional dan dokumentasi

- [ ] **M9-OP-01 Dockerfile web, API, worker** — multi-stage, non-root.
- [ ] **M9-OP-02 Compose produksi** — web, API, worker, PostgreSQL dengan volume terpisah, Redis, object storage.
- [ ] **M9-OP-03 Nginx dan TLS** — header `Upgrade`/`Connection` untuk WebSocket, `X-Forwarded-*`, sertifikat otomatis.
- [ ] **M9-OP-04 CI/CD** — lint, typecheck, test, build image, migrasi, smoke, rilis (`deploy.md` 6–7).
- [ ] **M9-OP-05 Staging** — lingkungan terpisah dengan data contoh.
- [ ] **M9-OP-06 Backup dan restore** — harian ke luar VPS; drill restore terjadwal.
- [ ] **M9-OP-07 Monitoring** — health, log terstruktur, antrean outbox, error rate, peringatan.
- [ ] **M9-OP-08 Runbook lengkap** — `deploy.md` 9.4.
- [ ] **M9-OP-09 Rollback** — prosedur dan uji.
- [ ] **M9-OP-10 Pilot** — pilih merchant, onboarding, pendampingan, catatan masalah, keputusan harga (`OD-12`) setelahnya.

## 5. Urutan checkpoint yang disarankan

1. M9-QA-01, M9-QA-03, M9-SC-01 sampai M9-SC-04 (keamanan di kode).
2. M9-OP-01, M9-OP-02, M9-OP-04, M9-OP-05 (staging).
3. M9-QA-02, M9-BE-01, M9-QA-04.
4. M9-UX-01, M9-UX-02, M9-UX-03, M9-DS-01, M9-DS-02, M9-FT-03, M9-AS-01.
5. M9-OP-03, M9-OP-06, M9-OP-07, M9-OP-08, M9-OP-09, M9-SC-06 (produksi).
6. M9-SC-05, M9-SC-07, M9-SC-08, M9-BE-02, M9-BE-03, M9-FT-02.
7. M9-AS-02, M9-FT-01, M9-OP-10 (pilot).

## 6. Referensi

`prd.md` 9.5, 11.2, 12–14 · `architecture.md` 17 · `deploy.md` · `security.md` 3, 14–16 · `design-system.md` 22–23.
