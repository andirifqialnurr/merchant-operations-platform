# Rate Limit Login dan QR Submit Handoff

Tanggal: 2026-08-03

Dokumen ini adalah handoff checkpoint Tahap 19 untuk `Rate limit login dan QR submit`. Implementasi source sudah masuk pada 2026-08-03 untuk API login dan primitive QR submit key/policy. Dokumen ini mengunci scope agar checkpoint berikutnya tidak melebar ke redesign atau payment gateway.

## Scope

- Tambahkan rate-limit server-side untuk merchant login.
- Tambahkan rate-limit server-side untuk platform-owner login.
- Siapkan policy/key builder untuk QR self-order submit.
- Jangan membuat integrasi QRIS dinamis, payment gateway, webhook, settlement, atau provider pihak ketiga.
- Jangan membuat endpoint QR submit baru bila order/QR submit API belum tersedia pada checkpoint ini; cukup siapkan primitive/policy yang bisa dipakai saat endpoint ada.

## QRIS Boundary

QRIS di MVP adalah manual merchant QRIS:

- QRIS bukan layanan pihak ketiga yang dipanggil sistem pada checkpoint ini.
- Customer/kasir memakai QRIS merchant statis atau instruksi publik.
- Status `paid` hanya boleh terjadi setelah kasir/staff mendapat server acknowledgement dari action verifikasi.
- Dynamic QRIS, payment provider API, webhook, settlement, refund otomatis, dan polling payment adalah add-on future.

## Field Inventory

### Login

| Datum                     | Klasifikasi                        | Catatan                                                         |
| ------------------------- | ---------------------------------- | --------------------------------------------------------------- |
| Email                     | User input                         | Dinormalisasi lowercase/trim untuk rate-limit key.              |
| Password                  | User input                         | Tidak masuk key, log, error, atau response.                     |
| IP address                | Hidden/control                     | Dipakai server untuk limiter; tidak dirender.                   |
| User agent                | Hidden/control                     | Boleh tetap metadata session seperti sekarang, bukan key utama. |
| Rate-limit counter/window | Hidden/control                     | Tidak dikirim ke UI sebagai editable/display detail.            |
| Error 429                 | Read-only display via API response | Response generic `RATE_LIMIT_EXCEEDED`.                         |

### QR Submit

| Datum                                   | Klasifikasi         | Catatan                                           |
| --------------------------------------- | ------------------- | ------------------------------------------------- |
| QR token dari URL                       | Hidden/control      | Jangan disimpan mentah di limiter key; hash dulu. |
| IP address                              | Hidden/control      | Dipakai server untuk limiter.                     |
| Idempotency key                         | Hidden/control      | Tidak dirender dan tidak menjadi user input.      |
| Cart/order draft                        | User input          | Hanya payload pesanan customer yang valid.        |
| Table label publik                      | Read-only display   | Boleh tampil ke customer.                         |
| Internal table/session/order/payment ID | Hidden/out of scope | Tidak boleh tampil atau masuk response customer.  |
| Provider/payment payload                | Hidden/out of scope | Tidak ada pada MVP manual QRIS.                   |

## Target File

Prioritas implementasi saat write access pulih:

- `apps/api/src/auth/auth.service.ts`
- `apps/api/src/auth/auth.spec.ts`
- `apps/api/src/platform/platform-auth.service.ts`
- `apps/api/src/platform/platform-auth.spec.ts`
- Opsional bila ingin modul terpisah: `apps/api/src/security/rate-limit.service.ts` dan `apps/api/src/security/rate-limit.spec.ts`

Jika folder baru masih sulit dibuat, letakkan primitive limiter di `apps/api/src/auth/auth.service.ts` dahulu agar checkpoint tetap kecil. Refactor ke `security/` bisa dilakukan setelah akses tulis stabil.

## RED Tests Yang Harus Ditulis Dulu

1. Merchant login rate-limit
   - Buat `InMemoryRateLimitService` dengan limit kecil, misalnya 1 request per 60 detik.
   - Login pertama berhasil.
   - Login kedua dengan email sama setelah normalisasi dan IP sama melempar 429 `RATE_LIMIT_EXCEEDED`.
   - Repository credential lookup tidak dipanggil untuk request kedua.

2. Platform login rate-limit
   - Pola sama untuk `PlatformAuthService`.
   - Pastikan platform login memakai namespace key berbeda dari merchant login.

3. QR submit key privacy
   - `buildQrSubmitRateLimitKey({ ipAddress, qrToken })` menghasilkan key dengan hash token.
   - Key tidak mengandung token mentah dari URL.
   - Policy `qrSubmit` memiliki limit/window eksplisit.

4. Error contract
   - Saat limit habis, exception status adalah 429.
   - Response body minimal:

```json
{
  "code": "RATE_LIMIT_EXCEEDED",
  "message": "Terlalu banyak percobaan. Coba lagi nanti."
}
```

## Implementasi Minimal

Primitive yang cukup untuk checkpoint ini:

- `RateLimitPolicy = { limit: number; windowMs: number }`
- `InMemoryRateLimitService`
  - key -> `{ count, resetAt }`
  - reset saat `now >= resetAt`
  - throw 429 `RATE_LIMIT_EXCEEDED` bila count sudah mencapai limit
- `RATE_LIMIT_POLICIES`
  - `merchantLogin`
  - `platformLogin`
  - `qrSubmit`
- `buildLoginRateLimitKey`
  - `merchant-login:<ip>:<normalized-email>`
- `buildPlatformLoginRateLimitKey`
  - `platform-login:<ip>:<normalized-email>`
- `buildQrSubmitRateLimitKey`
  - `qr-submit:<ip>:<sha256(qrToken)>`

Untuk MVP/local single-process, in-memory limiter cukup sebagai reliability gate awal. Redis/distributed limiter masuk checkpoint terpisah bila aplikasi mulai multi-instance.

## Integration Point

Merchant login:

- `AuthService.login(input, metadata)`
- `consume` dipanggil sebelum `repository.findUserByEmail`.
- Password tidak pernah dipakai sebagai key atau metadata limiter.

Platform login:

- `PlatformAuthService.login(input, metadata)`
- Namespace limiter berbeda dari merchant login.

QR submit:

- Saat endpoint QR submit dibuat, panggil `consume(buildQrSubmitRateLimitKey({ ipAddress, qrToken }), RATE_LIMIT_POLICIES.qrSubmit)` sebelum resolve token/order mutation.
- Token tetap di-hash untuk key; token mentah hanya dipakai pada resolver yang memang membutuhkan verifikasi.

## Acceptance Gate

- Focused auth test lulus pada 2026-08-03.
- Focused platform auth test lulus pada 2026-08-03.
- API package `test`, `typecheck`, dan `lint` lulus pada 2026-08-03.
- Root `test`, `typecheck`, `lint`, dan `build` lulus bila tidak ada blocker environment.
- `TODO.md` boleh menandai `[x] Rate limit login dan QR submit` karena test/implementation sudah masuk source.

## Catatan Environment

Percobaan patch ke source folder sempat gagal pada 2026-08-03:

- `apps/api/src/auth/auth.spec.ts` gagal ditulis.
- `apps/web/src` gagal ditulis.
- `packages/ui/src/components` gagal ditulis.

Pada run lanjutan 2026-08-03, write access ke `apps/api/src` berhasil dan checkpoint ini diimplementasikan. `apps/web/src` dan `packages/ui/src/components` tidak disentuh karena tidak masuk scope API rate-limit.
