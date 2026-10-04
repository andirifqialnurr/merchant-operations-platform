# Security — Cafe Companion Pro

**Status:** Kontrak keamanan dan privasi
**Tanggal:** 2 Oktober 2026

Dokumen ini mencatat kontrol yang **sudah berjalan** di kode, kontrol yang **harus ditambahkan** untuk Release 1, dan temuan yang perlu ditindaklanjuti. Dokumen ini bukan nasihat hukum; kewajiban hukum ditinjau profesional sebelum produksi (bagian 13).

Dokumen terkait: [`architecture.md`](./architecture.md), [`backend.md`](./backend.md), [`deploy.md`](./deploy.md).

---

## 1. Model ancaman ringkas

| Aset                 | Ancaman utama                                                       | Kontrol utama                                                                   |
| -------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Data antar-workspace | Pengguna satu workspace membaca atau mengubah data workspace lain   | Isolasi `tenant_id` di setiap query + foreign key komposit + test substitusi ID |
| Sesi                 | Pencurian cookie, sesi tidak dapat dicabut                          | Cookie `HttpOnly`, token di-hash di database, pencabutan sesi                   |
| Transaksi keuangan   | Pembayaran atau refund ganda, manipulasi nilai                      | Idempotency, nilai turunan dihitung server, audit, tidak ada hapus              |
| Akun                 | Tebak kata sandi                                                    | Argon2id, rate limit login                                                      |
| Data pribadi         | Telepon pelanggan, data karyawan bocor ke surface yang tidak berhak | Data minimization per DTO dan per surface                                       |
| Token QR meja        | Tebak atau pakai ulang token                                        | Token acak, hanya hash yang disimpan, rotasi dan pencabutan                     |
| Akses operator       | Operator platform membuka data pelanggan tanpa jejak                | Sesi platform terpisah, akses support beralasan dan berbatas waktu              |
| Secret               | Secret bocor lewat repositori, log, atau UI                         | Secret hanya di environment; tidak pernah di log atau response                  |

---

## 2. Status kontrol

| Kontrol                                                                                                                     | Status                               | Lokasi                                                        |
| --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ | ------------------------------------------------------------- |
| Hash kata sandi Argon2id (64 MiB, 3 pass) dengan perbandingan waktu-konstan                                                 | Berjalan                             | `apps/api/src/core/auth/password.ts`                          |
| Token sesi acak 32 byte; database hanya menyimpan SHA-256                                                                   | Berjalan                             | `auth/password.ts`, tabel `login_sessions`                    |
| Cookie sesi `HttpOnly`, `SameSite=Lax`, `Secure` di produksi                                                                | Berjalan                             | `auth/session-cookie.ts`                                      |
| Sesi platform terpisah dari sesi merchant                                                                                   | Berjalan                             | `platform/`                                                   |
| Rate limit login (5 per 15 menit per IP+email)                                                                              | Berjalan, di memori proses           | `security/rate-limit.service.ts`                              |
| Header keamanan (`nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, COOP, CORP, `Permissions-Policy`, HSTS di produksi) | Berjalan                             | `security/http-security.ts`                                   |
| Pemeriksaan header CSRF untuk mutasi bersesi                                                                                | Berjalan di API dan klien web        | `security/http-security.ts`, `apps/web/src/lib/api-client.ts` |
| Guard sesi + keanggotaan + izin + cakupan lokasi + entitlement modul                                                        | Berjalan                             | `access/session-permission.guard.ts`                          |
| Validasi Zod untuk header, params, body, response                                                                           | Berjalan                             | `zod-validation.pipe.ts`, `packages/contracts`                |
| Error tanpa detail internal pada 5xx                                                                                        | Berjalan                             | `api-exception.filter.ts`                                     |
| Audit aksi kritis                                                                                                           | Berjalan untuk modul yang ada        | `audit/critical-action-audit.ts`                              |
| Request ID dan log terstruktur                                                                                              | Berjalan                             | `observability/`                                              |
| Dokumentasi API tertutup di produksi kecuali sesi platform berizin                                                          | Berjalan                             | `openapi.ts`                                                  |
| Drill backup dan restore                                                                                                    | Berjalan sebagai skrip               | `packages/database/src/backup-restore-drill.ts`               |
| Test isolasi tenant/outlet dan constraint skema                                                                             | Berjalan                             | `reliability/`, `tenant-isolation-schema.spec.ts`             |
| Content-Security-Policy                                                                                                     | **Belum**                            | —                                                             |
| Rate limit lintas instance (Redis)                                                                                          | **Belum**                            | —                                                             |
| Rate limit API integrasi dan endpoint sensitif lain                                                                         | **Belum**                            | —                                                             |
| Idempotency pada endpoint                                                                                                   | **Belum** (tabel ada, belum dipakai) | —                                                             |
| Token QR ber-hash dengan rotasi                                                                                             | **Belum** (kontrak ada)              | —                                                             |
| Akses support beralasan dan berbatas waktu                                                                                  | **Belum** (kontrak ada)              | —                                                             |
| Registri perangkat dan kredensial perangkat                                                                                 | **Ada**                              | `core/devices`, `core_devices`                                |
| Lint batas modul                                                                                                            | **Belum** (kontrak ada)              | —                                                             |
| Integration test PostgreSQL sekali pakai                                                                                    | **Belum**                            | —                                                             |
| Upload berkas bertanda tangan                                                                                               | **Ada**                              | `core/files`                                                  |
| Row-level security PostgreSQL                                                                                               | **Belum diputuskan** (`SCH-02`)      | —                                                             |

---

## 3. Temuan yang perlu ditindaklanjuti

Temuan berikut berasal dari pembacaan kode pada 2 Oktober 2026 dan belum diverifikasi dengan menjalankan aplikasi.

| ID     | Temuan                                                                                                                           | Dampak                                                                                                        | Tindakan                                                                                                                                                                                                                                                                                                                          |
| ------ | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SEC-F1 | **Selesai.** API menolak `POST/PATCH/PUT/DELETE` bersesi tanpa header `x-csrf-token`, dan klien web sebelumnya tidak mengirimnya | Terkonfirmasi: permintaan tanpa header dijawab 403 `CSRF_TOKEN_REQUIRED`                                      | Klien API kini mengirim header pada setiap metode tidak aman; simpan data dari halaman Katalog terverifikasi di browser                                                                                                                                                                                                           |
| SEC-F2 | Pemeriksaan CSRF hanya memvalidasi keberadaan dan format header, tidak mengikat nilainya ke sesi                                 | Cukup sebagai pertahanan "custom header" selama CORS tidak dibuka; tidak cukup bila API diakses lintas origin | Pertahankan satu origin; bila kelak lintas origin, ikat token ke sesi                                                                                                                                                                                                                                                             |
| SEC-F3 | Rate limit bawaan disimpan di memori proses                                                                                      | Tidak efektif bila API berjalan lebih dari satu instance; hilang saat restart                                 | **Tersedia 3 Oktober 2026:** `RATE_LIMIT_STORE=redis` memakai penghitung atomik di Redis yang dibagi semua instance; kunci disimpan sebagai hash (tanpa email/IP mentah). Bila Redis tidak terjangkau, tiap instance tetap membatasi di memorinya sendiri dan mencatat peringatan. Wajib disetel di produksi                      |
| SEC-F4 | Alamat IP untuk rate limit diambil dari koneksi; di belakang reverse proxy semua permintaan tampak dari IP proxy                 | Satu pengguna dapat mengunci login pengguna lain, atau batas tidak efektif                                    | Konfigurasikan `trust proxy` untuk satu hop (Nginx) di produksi                                                                                                                                                                                                                                                                   |
| SEC-F5 | Sesi merchant dulu berlaku 720 jam (30 hari) secara bawaan                                                                       | Jendela penyalahgunaan panjang pada perangkat bersama (POS)                                                   | **Selesai 4 Oktober 2026.** Sesi Backoffice bawaan 12 jam. Masuk di perangkat POS/KDS yang aktif membuka sesi terikat perangkat (bawaan 16 jam) yang hanya berlaku bersama kredensial perangkat itu dan mati saat perangkat dicabut. Migrasi `20261004100000_login_session_surface` memotong sesi lama menjadi paling lama 12 jam |
| SEC-F6 | Pesan error server berbahasa Indonesia                                                                                           | Bukan celah, tetapi bertentangan dengan dua bahasa                                                            | Kode stabil + terjemahan klien (`backend.md` bagian 9)                                                                                                                                                                                                                                                                            |
| SEC-F7 | Belum ada Content-Security-Policy                                                                                                | Dampak XSS tidak dibatasi                                                                                     | Tambahkan CSP di Next.js (bagian 6)                                                                                                                                                                                                                                                                                               |

---

## 4. Autentikasi dan sesi

- Login tidak terikat workspace. Setelah login, pengguna memilih workspace bila memiliki lebih dari satu keanggotaan.
- Kata sandi: Argon2id dengan parameter yang tersimpan bersama hash, sehingga parameter dapat dinaikkan tanpa mematahkan hash lama.
- Kebijakan kata sandi: minimal 10 karakter; tanpa aturan komposisi yang memaksa; tolak kata sandi yang sangat umum.
- Token sesi: 32 byte acak, dikirim hanya lewat cookie `HttpOnly`. Database menyimpan hash; token mentah tidak dapat dipulihkan dari database.
- Pencabutan: logout mencabut sesi; mengganti kata sandi mencabut semua sesi lain; admin dapat mencabut sesi pengguna.
- Undangan yang berjalan sejak 4 Oktober 2026 (`core/memberships/invitation.*`):
  - Tautan undangan adalah bukti kepemilikan email, jadi hanya dikirim ke alamat itu. Jawaban API kepada pengundang dan daftar undangan tidak pernah memuat tautan atau secret-nya.
  - Secret 32 byte acak; hanya hash SHA-256 yang disimpan. Berlaku 7 hari, sekali pakai. Mengirim ulang membuat secret baru dan mematikan yang lama; mencabut mematikannya.
  - Secret berada di fragmen tautan (`/invite#token=…`) dan dikirim ke API di body (`POST /invitations/preview`, `POST /invitations/accept`), tidak di alamat, supaya tidak masuk log akses.
  - Tautan salah, kedaluwarsa, sudah dipakai, atau dicabut mendapat jawaban yang sama (`INVITATION_INVALID`). Percobaan dibatasi 20 kali per 15 menit per alamat jaringan.
  - Email tanpa akun: menerima undangan membuat akun dengan nama dan kata sandi dari orang itu (di-hash Argon2id), keanggotaan, dan menandai undangan diterima dalam satu transaksi. Email yang sudah punya akun cukup dengan tautan; nama dan kata sandinya tidak diubah.
  - Peran dan outlet yang diberikan diperiksa saat mengundang dan lagi saat diterima; batas pengguna paket juga.
  - Email tidak ditulis ke audit maupun event (data pribadi). Audit: `invitation.create`, `invitation.resend`, `invitation.revoke`, `invitation.accept`; yang menerima tercatat sebagai aktor keanggotaannya sendiri.
  - **Pengiriman:** undangan dikirim sebagai email dari template (`core/mail`). Di luar produksi email ditulis ke keluaran API (`mail_for_development`: penerima, subjek, teks) untuk pengembang. Di produksi, tanpa layanan email, mengundang ditolak `503 MAIL_NOT_CONFIGURED` dan tidak ada yang disimpan. Pengirim email sungguhan (SMTP atau penyedia) belum dipilih.
  - **Template email:** nama workspace di-escape di HTML dan dijadikan satu baris di subjek, sehingga tidak bisa menyisipkan markup atau header. HTML tanpa skrip, tanpa stylesheet luar, tanpa form.
  - **Halaman `/invite`:** secret dibaca dari fragmen tautan, lalu dihapus dari alamat dan riwayat browser; ia hanya dikirim di body permintaan. Akun yang baru dibuat langsung masuk dengan kata sandi yang baru dipilih, dan sesi orang lain yang kebetulan terbuka di browser itu diakhiri lebih dulu.
- Pencabutan yang berjalan sejak 4 Oktober 2026:
  - Menonaktifkan keanggotaan (`PATCH /access/memberships/:id` dengan `status: INACTIVE`) mengakhiri semua sesi orang itu di semua surface. Akses ke workspace itu sudah ditolak pada permintaan berikutnya karena keanggotaan diperiksa setiap permintaan.
  - `POST /access/memberships/:id/revoke-sessions` (izin `access.membership.manage`) mengakhiri semua sesi seorang anggota tanpa mengubah keanggotaannya, misalnya saat HP hilang. Jawabannya jumlah sesi yang diakhiri.
  - Mencabut perangkat menutup sesi yang dibuka di perangkat itu.
  - Akun yang dinonaktifkan (`users.status = DISABLED`) tidak punya sesi yang berlaku dan tidak bisa masuk.
  - Sesi bersifat per orang, bukan per workspace: orang yang sesinya diakhiri harus masuk lagi juga untuk workspace lain yang masih ia ikuti.
  - Audit: `membership.revoke_sessions` dengan jumlah yang diakhiri (`endedSignIns`). Belum ada: ganti kata sandi dan pencabutan sesi lain saat itu terjadi (menunggu alur akun, `M2-UX-04`).
- Sesi platform (`platform_session`) dan sesi merchant (`merchant_session`) memakai cookie, tabel, dan guard terpisah; tidak pernah saling diterima.
- Pesan login gagal tidak membedakan "email tidak ada" dari "kata sandi salah".
- Persetujuan manager di POS (PIN) tidak menggantikan identitas pengguna yang sedang masuk; keduanya dicatat di audit.
- MFA dan SSO: titik perluasan, bukan cakupan Release 1. MFA untuk pengguna platform diprioritaskan lebih dulu.

Platform user pertama dibuat lewat CLI `platform:user:provision` dengan variabel environment eksplisit. Tidak ada akun atau kata sandi bawaan.

---

## 5. CSRF dan origin

Web dan API berada di satu origin melalui rewrite Next.js; cookie sesi `SameSite=Lax`. Pertahanan CSRF:

1. `SameSite=Lax` mencegah cookie terkirim pada `POST` lintas situs.
2. Header kustom `x-csrf-token` wajib untuk semua metode tidak aman yang membawa cookie sesi. Formulir lintas situs tidak dapat menambahkan header kustom.
3. CORS **tidak dibuka** untuk API. Bila kelak dibuka, daftar origin eksplisit dan token CSRF diikat ke sesi.

Klien API web harus menambahkan `x-csrf-token` (nilai acak 16–255 karakter per tab) pada setiap `POST`, `PATCH`, `PUT`, dan `DELETE`.

---

## 6. Header dan kebijakan browser

Sudah diterapkan di API: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Resource-Policy: same-origin`, `Permissions-Policy` (kamera, mikrofon, lokasi, pembayaran dimatikan), dan HSTS di produksi.

Harus ditambahkan pada respons Next.js:

| Header                      | Nilai awal                                                                                                                                                                                                                                                  |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Content-Security-Policy`   | `default-src 'self'`; `img-src 'self' data: blob:` + origin object storage; `style-src 'self' 'unsafe-inline'` (kebutuhan ApexCharts dan gaya sebaris); `script-src 'self'` dengan nonce; `connect-src 'self'` + origin WebSocket; `frame-ancestors 'none'` |
| Header yang sama dengan API | Agar halaman juga terlindungi, bukan hanya `/api`                                                                                                                                                                                                           |

`Permissions-Policy` ditinjau ulang saat absensi mobile (kamera, lokasi) dibuat.

---

## 7. Otorisasi

Urutan pemeriksaan pada setiap permintaan:

```text
sesi -> keanggotaan aktif -> langganan dapat dipakai -> instalasi aktif
     -> capability -> izin -> cakupan lokasi -> feature flag -> limit
```

Aturan:

- Tolak secara bawaan: capability dan izin baru tidak diberikan ke siapa pun sampai ditetapkan.
- Header `x-tenant-id` dan `x-outlet-id` hanya **memilih** konteks. Bukti akses berasal dari sesi dan keanggotaan.
- ID lokasi selalu diverifikasi sebagai anak workspace yang sama.
- Record milik workspace lain dijawab `NOT_FOUND`, bukan `FORBIDDEN`, agar keberadaannya tidak bocor.
- Tampilan gabungan lintas lokasi tidak otomatis memberi hak mutasi lintas lokasi.
- Worker integrasi memakai identitas layanan, bukan peran pengguna palsu.
- Role sistem tidak dapat diubah; perubahan role dan keanggotaan diaudit.
- Menyembunyikan menu di frontend bukan kontrol keamanan.

---

## 8. Isolasi workspace

- Setiap tabel domain memiliki `tenant_id` non-null.
- Foreign key komposit `(tenant_id, x_id)` membuat database menolak relasi lintas workspace walaupun aplikasi salah.
- Keunikan berbatas workspace selalu menyertakan `tenant_id`.
- Kunci cache, kunci query frontend, dan kanal realtime menyertakan workspace dan lokasi.
- Handler event tidak memproses event tanpa konteks workspace.
- Setiap modul baru menambah test substitusi ID lintas workspace dan test kontrak skema.
- Workspace `PERSONAL` tidak mewarisi akses dari keanggotaan bisnis pengguna yang sama.

---

## 9. Integritas transaksi

- Mutasi kritis mewajibkan `Idempotency-Key`. Kunci sama + payload sama mengembalikan hasil pertama; kunci sama + payload berbeda ditolak.
- Total, pajak, selisih kas, saldo stok, dan nilai turunan lain dihitung server. Nilai dari klien untuk field tersebut diabaikan atau ditolak.
- Harga pesanan diambil server dari Catalog saat pesanan dibuat dan disimpan sebagai snapshot.
- Transaksi final tidak dapat dihapus; koreksi memakai void, refund, atau pembalikan yang meninggalkan jejak.
- Pembatalan, void, refund, penyesuaian kas, dan penyesuaian stok mewajibkan alasan.
- Pembayaran manual berstatus `VERIFYING` sampai kasir mengonfirmasi. UI tidak menampilkan "lunas" sebelum server menyimpan `PAID`.
- Konfirmasi ganda aman dan mengembalikan state terkini.
- Event duplikat tidak menggandakan ticket, mutasi stok, atau transaksi keuangan (inbox + referensi sumber unik).

---

## 10. Data pribadi dan data sensitif

### 10.1 Batas per surface

| Surface          | Tidak boleh menerima                                                             |
| ---------------- | -------------------------------------------------------------------------------- |
| KDS              | Harga, HPP, pembayaran, telepon pelanggan, payload audit                         |
| POS              | HPP, laba, data HR                                                               |
| Customer         | ID internal meja/sesi, koordinat tata letak, token mentah, data keuangan atau HR |
| Karyawan         | Data karyawan lain tanpa izin                                                    |
| Merchant         | Secret platform, payload mentah provider                                         |
| Platform Support | Data di luar cakupan, alasan, dan masa akses                                     |

Pembatasan dilakukan di DTO backend, bukan dengan menyembunyikan field di frontend. Guard KDS dan pemeta QR pelanggan yang sudah ada di `packages/ui` adalah lapisan kedua, bukan pengganti.

### 10.2 Aturan

- Data sensitif: kontak dan data kepegawaian karyawan, bukti absensi, telepon pelanggan, lampiran keuangan, akses support.
- Log, event, dan audit tidak memuat kata sandi, token, secret, payload pembayaran, foto, atau isi lampiran.
- Payload event dijaga di kode (`shared/command/event-payload.ts`, sejak 4 Oktober 2026): setiap penulisan outbox melewati `safeEventPayload`. Key yang menyebut secret (password, token, secret, session, signature, pin, raw, dan sejenisnya) atau data pribadi (email, phone, address, tanggal lahir, NIK, NPWP, nama pelanggan/nama lengkap) menggagalkan transaksi; teks bebas yang diketik orang (`reason`, `note`, `notes`, `comment`) tidak ikut ke event dan tetap tersimpan di audit. Handler yang butuh data orang membacanya dari pemiliknya lewat ID. Penjagaan ini berdasarkan nama key, bukan isi nilai; log belum dijaga dengan cara yang sama.
- Ringkasan sebelum/sesudah di audit disanitasi; nilai sensitif disamarkan.
- Ekspor data sensitif diaudit.
- Masa simpan audit, bukti absensi, data pelanggan, dan lampiran adalah keputusan terbuka (`OD-08`) yang harus selesai sebelum produksi.
- Absensi mobile (GPS, selfie) baru aktif setelah pemberitahuan privasi, persetujuan, dan tinjauan keamanan siap. Pelacakan lokasi terus-menerus tidak termasuk cakupan.

---

## 11. Token QR dan surface publik

- QR memakai token acak yang tidak dapat ditebak, bukan ID meja.
- Database hanya menyimpan hash, versi, dan status (`ACTIVE`, `ROTATED`, `REVOKED`, `EXPIRED`). Token mentah hanya ada saat QR dibuat.
- QR melekat pada meja, bukan sesi. Server menentukan sesi yang valid tanpa mengirim ID sesi ke klien.
- Rotasi membuat QR lama tidak berlaku dan diaudit.
- Resolusi QR idempotent: pindai berulang tidak membuat sesi ganda.
- Endpoint publik (resolusi QR, kirim pesanan tamu) memiliki rate limit per IP dan per token (kebijakan `qrSubmit`: 20 per menit).
- Respons publik hanya berisi konteks yang aman: nama merchant, lokasi, label meja, menu, dan status pesanan tamu itu sendiri.
- Input tamu (catatan pesanan) dibatasi panjangnya dan selalu di-escape saat ditampilkan di POS dan KDS.

---

## 12. Secret, berkas, perangkat, integrasi

**Secret**

- Hanya di environment atau secret manager; `.env` dan `CREDENTIALS.local.md` tidak masuk repositori (sudah di `.gitignore`).
- Tidak dirender di UI, log, analitik, atau pesan error.
- Secret perangkat dan API hanya tampil sekali saat dibuat; setelah itu hanya versi tersamar.
- Rotasi didukung tanpa mematikan layanan.

**Berkas**

- Upload melalui URL bertanda tangan ke object storage; API memvalidasi kepemilikan, tipe, dan ukuran.
- Yang berjalan sejak 4 Oktober 2026 (`core/files`):
  - `POST /files/uploads` menjawab URL unggah bertanda tangan untuk satu berkas. Izin mengikuti tujuan berkas (gambar produk: `catalog.manage`).
  - **Kunci objek dibuat server**: `tenants/{workspace}/{folder tujuan}/{uuid}.{ekstensi}`. Nama berkas dari pengguna tidak pernah dipakai, jadi tidak ada jalan untuk path traversal. Kunci di luar folder workspace sendiri diperlakukan seperti berkas yang tidak ada.
  - **Tipe:** hanya gambar raster (JPEG, PNG, WebP, AVIF). SVG dan tipe lain ditolak saat meminta tiket, dan lagi saat berkas diperiksa.
  - **Ukuran:** paling besar 5 MB untuk gambar produk. Tipe dan ukuran ikut ditandatangani, sehingga storage menolak unggahan dengan tipe atau ukuran lain.
  - **Umur URL:** 5 menit, untuk unggah maupun baca.
  - **Pemeriksaan sesudah unggah** (`verifyUpload`), sebelum berkas dipakai: berkas harus ada, tidak kosong, tidak melebihi batas, dan byte awalnya memang gambar bertipe yang diizinkan. Berkas yang gagal dihapus.
  - Secret storage tidak pernah keluar dari server; pesan error tidak memuat alamat, bucket, atau kredensial storage.
  - CORS bucket hanya membuka origin web (`WEB_URL`) untuk `PUT` dan `GET`; diatur dengan `pnpm --filter @merchant/api storage:cors`.
  - **Gambar produk (sejak 4 Oktober 2026):** `POST /catalog/product-images` memanggil `verifyUpload` sebelum gambar dilekatkan, dan menyimpan tipe yang ditemukan di berkas, bukan yang diklaim. Gambar ditampilkan lewat `GET /catalog/tenants/:tenantId/product-images/:imageId/content`: sesi diperiksa, pemanggil harus anggota aktif workspace itu, lalu dialihkan ke URL baca bertanda tangan. Workspace ada di alamat karena elemen gambar tidak bisa mengirim header.
  - Belum: pemindaian malware; pembersihan berkas yang diunggah tetapi tidak dipakai atau sudah dihapus dari produk.
- Gambar produk: hanya tipe raster yang diizinkan; kunci objek tidak boleh mengandung traversal jalur (aturan ini sudah ada di skema Catalog).
- Berkas privat (lampiran keuangan, bukti absensi) hanya diakses melalui URL bertanda tangan berumur pendek.

**Perangkat**

- Perangkat POS/KDS didaftarkan dengan mode, lokasi, dan kredensial ber-hash.
- Perangkat dapat dicabut tanpa menonaktifkan pengguna.
- Permintaan dari perangkat tetap memiliki aktor atau identitas layanan yang dapat diaudit.

Yang berjalan sejak 4 Oktober 2026 (`core/devices`):

- **Pendaftaran:** orang dengan izin `device.manage` mendaftarkan perangkat untuk satu outlet aktif. Jawabannya memuat kode aktivasi 8 karakter (huruf dan angka yang tidak mudah tertukar), hanya sekali; berlaku 15 menit. Kode baru bisa diminta selama perangkat belum pernah aktif.
- **Aktivasi:** perangkat mengirim kode ke `POST /device/activate` tanpa sesi pengguna. Kode salah, kedaluwarsa, atau sudah dipakai mendapat jawaban yang sama (`DEVICE_ACTIVATION_INVALID`); percobaan dibatasi 10 kali per 15 menit per alamat jaringan.
- **Kredensial perangkat:** 32 byte acak, dikirim hanya sebagai cookie `merchant_device` (`HttpOnly`, `SameSite=Lax`, `Secure` di produksi), tidak pernah di body. Cookie ini terpisah dari cookie sesi pengguna: keluar-masuk pengguna tidak mengubahnya, dan mencabut perangkat tidak menyentuh pengguna.
- **Pencabutan:** `POST /devices/:id/revoke` menghapus hash kredensial dan kode; permintaan berikutnya dari perangkat itu ditolak `DEVICE_NOT_ACTIVATED` dan cookienya dihapus.
- **Yang disimpan:** hanya hash SHA-256 dari kode dan kredensial. Daftar perangkat tidak pernah memuat keduanya.
- **CSRF:** permintaan tulis yang membawa cookie perangkat wajib menyertakan header CSRF, sama seperti cookie sesi.
- **Audit:** `device.register`, `device.reissue_code`, `device.activate`, `device.revoke`. Aktivasi tercatat tanpa aktor pengguna karena dilakukan perangkat.
- **Sesi per surface:** `login_sessions.surface` adalah `BACKOFFICE`, `POS`, atau `KDS`. Server yang menentukannya saat masuk: bila permintaan membawa kredensial perangkat aktif, sesi terikat ke perangkat itu (`device_id`); selain itu sesi Backoffice. Sesi terikat perangkat ditolak (`AUTH_SESSION_INVALID`) bila dipakai tanpa kredensial perangkat yang sama atau setelah perangkat dicabut. Sesi Backoffice tidak bergantung pada perangkat apa pun.
- **Cakupan sesi perangkat (sejak 4 Oktober 2026):** sesi yang dibuka di perangkat hanya berlaku untuk workspace dan outlet perangkat itu. Guard menolak workspace lain (`WORKSPACE_ACCESS_DENIED`), outlet lain (`LOCATION_SCOPE_DENIED`), dan rute yang butuh semua outlet, apa pun peran orangnya. `GET /access/workspaces` hanya mengembalikan outlet perangkat. Event dari POS membawa `deviceId`, diisi guard dari sesi, tidak dari header.
- **Layar aktivasi:** `/activate` tidak memerlukan sesi. Setelah kode diterima, sesi yang sedang terbuka di browser itu diakhiri supaya masuk berikutnya terikat ke perangkat.
- **Belum:** POS masih bisa dipakai dari browser tanpa perangkat aktif (dengan sesi Backoffice). Mewajibkan perangkat untuk POS adalah keputusan produk yang belum diambil.

**Integrasi eksternal (nanti)**

- Kredensial dibatasi per workspace dan capability.
- Webhook masuk: verifikasi tanda tangan, perlindungan pemutaran ulang, idempotency, rate limit.
- Add-on integrasi tidak pernah memberi akses langsung ke database.

---

## 13. Audit

Wajib diaudit: login dan pencabutan sesi; perubahan keanggotaan, role, dan izin; perubahan entitlement, paket, limit, instalasi, dan binding; akses support; perubahan harga, diskon, dan pajak; pembatalan, void, dan refund; konfirmasi pembayaran; penutupan shift dan penyesuaian kas; penyesuaian, transfer, dan finalisasi opname stok; posting, pembalikan, dan rekonsiliasi keuangan; perubahan status karyawan, publikasi jadwal, koreksi absensi, persetujuan cuti; rotasi dan pencabutan QR; ekspor sensitif.

Setiap entri memuat aktor, kanal, waktu server, alasan (bila diwajibkan), request ID, dan ringkasan aman. Audit tidak dapat diubah oleh pengguna merchant dan terpisah dari log aplikasi.

**Akses support:** operator platform membuka konteks workspace hanya dengan alasan, cakupan, dan masa berlaku. Banner konteks support tampil terus selama akses aktif dan seluruh tindakannya diaudit.

---

## 14. Operasi

- Database: pengguna aplikasi dengan hak minimum; pengguna migrasi terpisah.
- Backup terenkripsi dan uji restore terjadwal. Target awal: RPO ≤24 jam, RTO ≤8 jam.
- TLS di semua lingkungan selain lokal.
- Dependensi dikunci lockfile; pemeriksaan kerentanan dependensi di CI.
- Peringatan untuk: anomali akses lintas workspace, lonjakan login gagal, duplikasi pembayaran, antrean event menumpuk, provisioning gagal.
- Insiden: cabut sesi dan kredensial terdampak, simpan log, catat kronologi, beri tahu pihak terdampak sesuai kewajiban yang berlaku.

## 15. Gerbang kepatuhan sebelum produksi

Tinjauan profesional diperlukan untuk: perlindungan data pribadi dan pemberitahuan privasi; kewajiban penyelenggara sistem elektronik; pajak dan dokumen transaksi; ketenagakerjaan dan bukti absensi; kontrak penyedia jasa pembayaran; kebijakan masa simpan dan penghapusan data.

Batas yang tetap berlaku: Release 1 hanya mencatat pembayaran manual dan tidak memindahkan dana; tidak ada dompet atau saldo konsumen; akun Personal Finance adalah catatan, bukan rekening.

## 16. Checklist keamanan per checkpoint

- [ ] Setiap query membawa `tenant_id` (dan `outlet_id` bila berbatas lokasi).
- [ ] Guard capability, izin, dan cakupan lokasi terpasang.
- [ ] Input divalidasi skema; response divalidasi skema.
- [ ] Response tidak memuat field terlarang untuk surface tujuan.
- [ ] Mutasi kritis idempotent.
- [ ] Aksi sensitif diaudit dengan alasan bila diwajibkan.
- [ ] Tidak ada secret, token, atau PII di log dan event.
- [ ] Test substitusi ID lintas workspace ditambahkan.
- [ ] Endpoint publik memiliki rate limit.
- [ ] Error tidak membocorkan detail internal.
