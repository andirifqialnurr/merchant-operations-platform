# Runbook Operasional

Langkah yang dijalankan operator saat menyiapkan workspace atau saat sistem bermasalah. Setiap runbook berisi: kapan dipakai, cara memeriksa, cara memperbaiki, dan cara memastikan sudah beres. Daftar runbook yang wajib ada sebelum pilot ada di `deploy.md` 9.4; yang belum ditulis dicatat di bagian 5.

Aturan untuk semua runbook:

- Jalankan perintah pemeriksaan (`SELECT`) dulu. Perintah yang mengubah data ditandai **MENGUBAH DATA** dan dijalankan hanya setelah penyebabnya diketahui.
- Jangan menyalin isi `payload` event, token, atau kata sandi ke tiket atau chat. Pakai ID event, ID workspace, dan `request_id`.
- Catat siapa yang menjalankan, kapan, dan alasannya di tiket insiden. Perubahan lewat API sudah masuk audit log; perubahan lewat SQL tidak, jadi tiket adalah satu-satunya jejaknya.

---

## 1. Provisioning workspace dan paket

**Dipakai saat:** pelanggan baru perlu workspace, atau paket workspace diganti.

Semua langkah lewat API platform (`/api/v1/platform/*`) dengan sesi staf platform (cookie `platform_session`). Workspace tidak dibuat lewat SQL.

### 1.1 Staf platform (sekali per orang)

```bash
PLATFORM_USER_EMAIL=... PLATFORM_USER_DISPLAY_NAME=... PLATFORM_USER_ROLE=ADMIN \
PLATFORM_USER_PASSWORD=... pnpm --filter @merchant/api platform:user:provision
```

Peran: `OWNER`, `ADMIN`, `SUPPORT`. Kata sandi diberikan lewat variabel lingkungan, bukan argumen, supaya tidak tersimpan di riwayat shell bersama perintahnya.

### 1.2 Urutan

| Langkah           | Permintaan                                 | Isi                                                                                        |
| ----------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------ |
| 1. Masuk          | `POST /platform/auth/login`                | email, kata sandi                                                                          |
| 2. Buat workspace | `POST /platform/tenants`                   | `name`, `slug` (huruf kecil, angka, tanda hubung)                                          |
| 3. Pasang paket   | `POST /platform/tenants/:id/subscriptions` | `planCode`, `status` (`TRIAL` atau `ACTIVE`), `startsAt`, opsional `endsAt`, `graceEndsAt` |
| 4. Periksa        | `GET /platform/tenants/:id`                | organisasi, langganan, modul efektif                                                       |

Memasang paket sekaligus memasang modul yang termasuk di dalamnya (`provisionEntitled`), jadi workspace langsung bisa dipakai. Langganan `DRAFT` tidak memberi akses apa pun.

Menghidupkan atau mematikan satu modul di luar paket: `PUT /platform/tenants/:id/entitlements/:moduleKey` dengan `enabled`, `reason` (wajib, minimal 3 huruf, masuk audit), dan opsional `endsAt`.

### 1.3a Paket KDS dan versi lama

`planCode: KDS_ONLY` memasang KDS Basic tanpa POS/Catalog komersial. Versi 1 membatasi satu sumber eksternal aktif (Packages & Limits 5.4). Versi penerus paket F&B standar membatasi nol sumber eksternal; pesanan POS/self-order internal tetap berjalan.

Migrasi `20261018010000_kds_intake_package_limits` tidak memindahkan langganan lama atau mengubah isi snapshot terbit. `GET /platform/tenants/:id` menampilkan `packageVersion`; mengganti paket melalui langkah 1.2 memilih versi terbit terbaru dan merupakan perubahan eksplisit yang diaudit. Sebelum mengganti, review dampak kapasitas bersama pemilik. Sumber di atas kuota tetap aktif; pembuatan berikutnya ditolak `LIMIT_REACHED`. Jangan mengedit versi PUBLISHED lewat SQL atau mencabut sumber hanya untuk memaksa angka pemakaian turun.

### 1.3 Mata uang

Workspace baru memakai IDR. Pemilik bisa memilih USD di Pengaturan → Bisnis dan outlet → Bisnis **sebelum** ada harga atau transaksi pertama; sesudah itu mata uang terkunci dan tidak ada cara membukanya, termasuk lewat SQL (nominal lama akan berubah arti).

### 1.4 Yang belum ada

- Brand, outlet pertama, dan pemilik pertama **belum** dibuat oleh API platform. Untuk lingkungan lokal dipakai `pnpm --filter @merchant/api local:users:provision`. Untuk pilot ini harus ditutup dulu (flowchart 13: "Provisioning: lokasi bawaan, owner, instalasi modul").
- Undangan pemilik lewat email belum bisa dikirim sampai layanan email ditentukan (keputusan terbuka M2).

### 1.5 Memastikan beres

`GET /platform/tenants/:id` menampilkan langganan dengan status yang benar dan modul paket berstatus terpasang. Pemilik masuk dan melihat menu modul paketnya. Bila modul ada di paket tetapi tidak muncul di menu:

```bash
pnpm --filter @merchant/api entitlements:rebuild
```

Perintah ini menghitung ulang hak modul efektif semua workspace dari langganan dan override; aman dijalankan berulang.

---

## 2. Integrasi antarmodul gagal

**Dipakai saat:** pemilik melihat status **Gagal** di Pengaturan → Integrasi, atau data satu modul tidak sampai ke modul lain (misalnya penjualan tidak masuk Keuangan).

### 2.1 Cara kerjanya

Satu integrasi (`core_integration_bindings`) menghubungkan satu jenis event dari modul sumber ke satu handler di modul tujuan. Setiap pengiriman dicatat per penerima di `core_inbox_events`:

| Status inbox | Arti                                                                                   |
| ------------ | -------------------------------------------------------------------------------------- |
| `PROCESSED`  | Sudah diproses. Tidak pernah diproses ulang                                            |
| `RETRYING`   | Gagal sementara; worker mencoba lagi sendiri                                           |
| `BLOCKED`    | Ditahan: integrasi dijeda, perlu setup, atau handler menolak karena data belum lengkap |
| `FAILED`     | Percobaan habis                                                                        |

Yang ditampilkan ke pemilik: `Aktif`, `Perlu setup`, `Gagal`, `Dijeda`, `Sedang diproses`.

### 2.2 Periksa

```sql
-- Integrasi yang bermasalah di satu workspace
SELECT id, source_module_key, target_module_key, event_type, status, health, last_error, updated_at
FROM core_integration_bindings
WHERE tenant_id = :workspace AND (status <> 'ACTIVE' OR health <> 'HEALTHY');

-- Pengiriman yang tertahan, per penerima
SELECT consumer_name, status, count(*), min(updated_at) AS paling_lama
FROM core_inbox_events
WHERE tenant_id = :workspace AND status IN ('BLOCKED', 'FAILED')
GROUP BY consumer_name, status;
```

`last_error` berisi satu baris pesan tanpa payload. Bila pesannya menunjuk ke setup (misalnya akun tujuan belum dipetakan), perbaiki setup di modul tujuan dulu: mencoba ulang tanpa memperbaiki penyebab hanya akan menahan event yang sama lagi.

### 2.3 Perbaiki

Setelah penyebabnya beres, pemilik menekan **Coba lagi** di Pengaturan → Integrasi. Dari sisi operator hal yang sama adalah:

```
POST /api/v1/modules/bindings/:id/retry
Header: Idempotency-Key: <uuid baru untuk tiap niat mencoba>
```

Butuh izin kelola organisasi dan cakupan semua outlet. Yang terjadi dalam satu transaksi: integrasi diaktifkan, kesehatannya ditandai menunggu worker (`Sedang diproses`), event `BLOCKED`/`FAILED` milik penerima dan workspace itu diantrekan lagi, dan audit dicatat. Event `PROCESSED`, workspace lain, penerima lain, event sebelum integrasi berlaku, dan event yang sedang dikerjakan worker tidak disentuh. Mengirim permintaan yang sama dengan kunci yang sama mengembalikan hasil pertama, jadi aman diulang saat koneksi putus.

**Jangan** mengubah status di `core_inbox_events` lewat SQL: event yang sudah `PROCESSED` bisa terproses dua kali.

### 2.4 Memastikan beres

Status integrasi kembali `Aktif` dan kueri kedua di 2.2 tidak mengembalikan baris untuk penerima itu. Bila setelah beberapa menit masih `Sedang diproses`, worker tidak berjalan: lanjut ke bagian 3.

---

## 3. Antrean outbox menumpuk

**Dipakai saat:** jumlah event yang belum terkirim terus naik, atau perubahan di satu modul terlambat terlihat di modul lain di banyak workspace sekaligus.

### 3.1 Cara kerjanya

Setiap perubahan menulis event ke `outbox_events` dalam transaksi yang sama. Worker mengambil 20 event per putaran dengan kunci baris (`SKIP LOCKED`), jadi beberapa worker boleh berjalan bersamaan. Event yang gagal dicoba lagi dengan jeda yang membesar (mulai 2 detik, paling lama 15 menit) sampai 8 kali; sesudah itu `failed_at` diisi dan event disimpan tanpa dicoba lagi sendiri.

### 3.2 Periksa

```sql
-- Ukuran dan umur antrean
SELECT count(*) AS menunggu, min(occurred_at) AS paling_lama
FROM outbox_events
WHERE processed_at IS NULL AND failed_at IS NULL;

-- Event yang sudah menyerah
SELECT type, count(*), max(failed_at) AS terakhir
FROM outbox_events
WHERE failed_at IS NOT NULL
GROUP BY type ORDER BY count(*) DESC;

-- Apa yang membuat event berulang gagal
SELECT type, left(last_error, 120) AS pesan, count(*), max(attempt_count) AS percobaan
FROM outbox_events
WHERE processed_at IS NULL AND attempt_count > 0
GROUP BY type, left(last_error, 120) ORDER BY count(*) DESC LIMIT 20;
```

Lalu periksa worker:

```bash
pnpm --filter @merchant/worker smoke
```

Lulus berarti worker bisa menjangkau Redis dan database, dan satu putaran outbox berjalan. Log worker yang perlu dicari: `Outbox dispatcher problem: ...` (database), `Worker connection problem: ...` (Redis), `Job ... failed: ...`.

### 3.3 Perbaiki, menurut penyebab

| Gejala                                                | Penyebab                           | Tindakan                                                             |
| ----------------------------------------------------- | ---------------------------------- | -------------------------------------------------------------------- |
| `menunggu` naik, `attempt_count` tetap 0              | Worker mati atau tidak terhubung   | Nyalakan ulang worker; periksa `REDIS_URL` dan `DATABASE_URL`        |
| `menunggu` naik pelan, worker sehat                   | Beban lebih besar dari satu worker | Tambah instance worker (aman, lihat 3.1)                             |
| Satu `type` mendominasi dengan pesan yang sama        | Handler rusak setelah rilis        | Rollback atau perbaiki rilis; event menunggu dan dicoba lagi sendiri |
| Banyak `failed_at` setelah insiden yang sudah selesai | Percobaan habis saat insiden       | Antrekan ulang seperti di bawah                                      |

Mengantrekan ulang event yang sudah menyerah, **setelah penyebabnya diperbaiki** — **MENGUBAH DATA**:

```sql
UPDATE outbox_events
SET failed_at = NULL, attempt_count = 0, available_at = now()
WHERE failed_at IS NOT NULL AND type = :jenis_event AND failed_at >= :mulai_insiden;
```

Batasi dengan `type` dan rentang waktu insiden; jangan tanpa `WHERE`. Aman terhadap pengiriman ganda karena penerima yang sudah `PROCESSED` melewati event itu. Catat jumlah baris yang berubah di tiket.

Event **tidak dihapus**. Event yang memang tidak boleh diproses (misalnya data uji yang tersasar) dibiarkan dengan `failed_at` terisi dan dicatat di tiket.

### 3.4 Memastikan beres

Kueri pertama di 3.2: `menunggu` turun ke angka kecil yang stabil dan `paling_lama` hanya beberapa detik yang lalu. Kueri kedua tidak bertambah.

---

## 4. Rujukan cepat

| Kebutuhan                   | Tempat                                                                                        |
| --------------------------- | --------------------------------------------------------------------------------------------- |
| API hidup                   | `GET /api/v1/health`                                                                          |
| Worker hidup                | `pnpm --filter @merchant/worker smoke`                                                        |
| Melacak satu permintaan     | `request_id` di respons error, log API, `audit_logs.request_id`, dan event (`correlation_id`) |
| Siapa mengubah apa          | `audit_logs` (per workspace, dengan `action`, `actor_id`, sebelum/sesudah)                    |
| Status migrasi              | `pnpm --filter @merchant/database db:status`                                                  |
| Fitur dimatikan tanpa rilis | `core_feature_flags` (`status` `DISABLED` mengalahkan rollout)                                |

---

## 5. Runbook yang belum ditulis

Dari daftar `deploy.md` 9.4, masih terbuka: pemulihan dari backup (latihan ada di `pnpm --filter @merchant/database db:backup-drill`, langkah operatornya belum), pencabutan sesi dan kredensial, rollback rilis, dan rotasi secret. Keempatnya harus ada sebelum pilot.
