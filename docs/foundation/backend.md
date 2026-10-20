# Backend — Cafe Companion Pro

**Status:** Kontrak struktur dan aturan kode backend
**Tanggal:** 2 Oktober 2026
**Cakupan:** `apps/api`, `apps/worker`, `packages/contracts`, `packages/database`

Dokumen terkait: [`architecture.md`](./architecture.md), [`schema.md`](./schema.md), [`security.md`](./security.md).

---

## 1. Kondisi saat ini

```text
apps/api/src/
  main.ts                     bootstrap: observability, header keamanan, CSRF, prefix /api/v1, filter error, OpenAPI
  app.module.ts               Access, Auth, Catalog, Organization, Platform, PosSales
  health.controller.ts
  bootstrap/
    api-exception.filter.ts   pemetaan error -> { code, message, requestId, details? }
    http-security.ts          header keamanan dan CSRF (middleware global)
    openapi.ts                Swagger di /api/docs
  shared/
    validation/               ZodValidationPipe untuk header/params/body
  cli/                        skrip provisioning (akun platform, akun lokal); boleh merangkai seluruh aplikasi
  core/                       dipindah 3 Oktober 2026 tanpa perubahan perilaku (M2-QA-01)
    auth/                     login, sesi, cookie, hash password (argon2id)
    memberships/              (dulu access) role, membership, undangan, PIN persetujuan, konteks workspace, SessionPermissionGuard
    entitlements/             (dulu entitlement) langganan + entitlement boolean per modul
    workspaces/               (dulu organization) tenant, brand, outlet
    platform/                 sesi platform, master tenant/langganan/entitlement, CLI provisioning
    security/                 rate limit (memori proses atau Redis lewat `RATE_LIMIT_STORE=redis`)
    observability/            request ID, log terstruktur
    audit/                    audit aksi kritis
    manifest/                 registry manifest modul (kunci capability per tier, dimensi limit, izin, navigasi, event, ketergantungan)
    installations/            instalasi modul per workspace dan menu dari manifest
    events/                   registry handler event, dispatcher outbox, inbox
    integrations/             binding antarmodul: jeda, lanjut, coba ulang event tertahan
    metering/                 dimensi pemakaian, penghitung, penjaga limit, langganan dan pemakaian untuk pemilik
    devices/                  perangkat POS/KDS: daftar, aktivasi, cabut
    files/                    unggahan langsung ke object storage dengan URL bertanda tangan
    mail/                     templat dan pengirim email (belum ada pengirim produksi)
    feature-flags/            flag operasional per fitur dengan rollout bertahap
    idempotency/              `@Idempotent()` untuk endpoint tanpa kunci domain
  kernels/
    catalog/                  kategori, produk, varian, modifier, gambar, produk per outlet; satu use case per file di `application/commands` dan `application/queries`, adapter Prisma per kelompok tabel
    order-intake/             pesanan dan item; menu untuk memberi harga datang lewat port `SELLABLE_MENU_SOURCE`
    billing-payment-ledger/   tagihan, pembayaran, penjualan, refund
  modules/
    catalog-profile/          permukaan HTTP katalog (controller); aturan dan data milik kernel catalog
    pos-sales/                shift dan kas, pesanan kasir, keranjang tertahan
  module-manifests.ts         daftar manifest semua unit; satu-satunya tempat yang perlu diubah saat modul baru ditambahkan
  kernel-wiring.module.ts     menyambungkan port satu kernel ke kernel yang menjawabnya; kernel tidak saling mengimpor
  worker-runtime.ts           modul API tanpa server HTTP, untuk proses worker (handler memanggil use case yang sama)
  reliability/                test isolasi tenant/outlet
apps/worker/src/
  index.ts                    memuat `@merchant/api/worker-runtime`, menjalankan dispatcher outbox, dan worker BullMQ untuk antrean `system`; `--smoke` menguji Redis dan satu batch outbox
  queues.ts                   nama antrean, opsi job bawaan, koneksi dari REDIS_URL
  outbox-loop.ts              putaran dispatcher: lanjut selama ada event, jeda saat kosong atau gagal, berhenti dengan rapi
  queue-retry.ts              helper coba ulang/dead-letter
packages/contracts/src/       satu file per domain (http, money, charges, auth, platform, organization, catalog, entitlement, access, invitations, devices, files, module-manifest, packages-limits, events, support-access, table-qr, pos-shift, menu, orders, billing, held-carts); `index.ts` hanya mengekspor ulang
packages/database/            skema Prisma, 34 migrasi, klien, drill backup/restore; `test/` berisi harness PostgreSQL sekali pakai
```

Pola per modul saat ini: `*.controller.ts` → `*.service.ts` → `*.repository.ts`, dengan repository di-inject melalui token (`CATALOG_REPOSITORY`).

### 1.1 Endpoint yang berjalan (prefix `/api/v1`)

| Area            | Endpoint                                                                                                                                                                                                                                                                                                                                                                                                          |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Health          | `GET /health`                                                                                                                                                                                                                                                                                                                                                                                                     |
| Auth            | `POST /auth/login`, `GET /auth/session`, `PATCH /auth/preferences`, `POST /auth/logout`                                                                                                                                                                                                                                                                                                                           |
| Access          | `GET /access/context`, `GET /access/workspaces`, `GET/POST /access/roles`, `PATCH /access/roles/:id`, `GET /access/members`, `GET/POST /access/memberships`, `PATCH /access/memberships/:id`, `POST /access/memberships/:id/revoke-sessions`                                                                                                                                                                      |
| Undangan        | `GET/POST /access/invitations`, `POST /access/invitations/:id/resend`, `POST /access/invitations/:id/revoke`; tanpa sesi: `POST /invitations/preview`, `POST /invitations/accept`                                                                                                                                                                                                                                 |
| PIN persetujuan | `GET/PUT /access/approval-pin`, `DELETE /access/members/:id/approval-pin`                                                                                                                                                                                                                                                                                                                                         |
| Organization    | `GET /organization`, `PATCH /organization/tenant`, `POST /organization/brands`, `PATCH /organization/brands/:id`, `POST /organization/outlets`, `PATCH /organization/outlets/:id`                                                                                                                                                                                                                                 |
| Langganan       | `GET /subscription`, `GET /subscription/usage`                                                                                                                                                                                                                                                                                                                                                                    |
| Modul           | `GET /modules/installations`, `POST/DELETE /modules/installations/:moduleKey`, `GET /modules/navigation`, `GET /modules/bindings`, `POST /modules/bindings/:id/pause`, `/resume`, `/retry`                                                                                                                                                                                                                        |
| Perangkat       | `GET/POST /devices`, `POST /devices/:deviceId/activation-code`, `POST /devices/:deviceId/revoke`; di perangkat: `POST /device/activate`, `GET /device/current`                                                                                                                                                                                                                                                    |
| Berkas          | `POST /files/uploads`                                                                                                                                                                                                                                                                                                                                                                                             |
| Catalog         | `GET /catalog`; `POST` + `PATCH /:id` untuk `categories`, `products`, `variants`, `modifier-groups`, `modifier-options`, `product-modifier-groups`, `product-images`; `GET /catalog/outlets/:outletId`, `POST /catalog/outlets/:outletId/products`, `PATCH /catalog/outlets/:outletId/products/:id`; `GET /catalog/tenants/:tenantId/product-images/:imageId/content`                                             |
| POS             | `GET /pos/menu`; `GET/POST /pos/orders`, `GET /pos/orders/:id`, `POST /pos/orders/:id/cancel`, `/payments`, `/refunds`, `GET /pos/orders/:id/receipt`, `GET /pos/orders/charges`, `GET /pos/orders/refund-approvers`; `GET /pos/shifts/current`, `POST /pos/shifts`, `POST /pos/shifts/:id/cash-movements`, `/close`; `GET/POST /pos/held-carts`, `POST /pos/held-carts/:id/resume`, `DELETE /pos/held-carts/:id` |
| Platform        | `POST /platform/auth/login`, `GET /platform/auth/session`, `POST /platform/auth/logout`, `GET /platform/context`, `POST /platform/tenants`, `GET/PATCH /platform/tenants/:id`, `POST /platform/tenants/:id/subscriptions`, `PUT /platform/tenants/:id/entitlements/:moduleKey`                                                                                                                                    |

Daftar ini dibaca dari controller pada 12 Oktober 2026. Sumber yang selalu benar adalah OpenAPI di `/api/docs`.

### 1.2 Yang perlu dibenahi

| Temuan                                      | Keadaan 12 Oktober 2026                                                                                                                                                                    | Sisa                                                                                                                   |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| Semua folder sejajar di `src/`              | **Selesai.** `core/`, `kernels/`, `modules/` dengan `public.ts` per unit; batas impor diperiksa `scripts/check-boundaries.mjs` di `pnpm lint`                                              | —                                                                                                                      |
| File Catalog terlalu besar                  | **Selesai untuk layanan dan repository.** 20 use case masing-masing satu file (terbesar 54 baris); repository Prisma dipecah per kelompok tabel (terbesar 159 baris) di belakang satu port | `catalog.controller.ts` masih 546 baris: satu controller untuk semua sumber daya katalog                               |
| `packages/contracts/src/index.ts` satu file | **Selesai.** Satu file per domain                                                                                                                                                          | —                                                                                                                      |
| Pesan error berbahasa Indonesia di server   | **Sebagian.** Klien menerjemahkan lewat kode error dan tidak pernah menampilkan pesan server                                                                                               | Pesan server lama di `core/workspaces` dan `core/memberships` masih berbahasa Indonesia; tidak terlihat pengguna       |
| Rate limit di memori proses                 | **Selesai.** Penyimpanan Redis tersedia (`RATE_LIMIT_STORE=redis`)                                                                                                                         | Wajib dipakai saat lebih dari satu instance (`deploy.md` 9.3)                                                          |
| Limit belum ditegakkan di semua titik       | **Sebagian.** Hard count dijaga saat membuat produk, brand, outlet, anggota (termasuk undangan), peran, dan perangkat, serta saat mengaktifkan kembali brand dan outlet                    | Mengaktifkan kembali anggota, peran, dan produk belum dijaga. Dimensi modul yang belum dibangun belum punya penghitung |
| Entitlement berupa boolean per modul        | **Selesai.** Entitlement efektif menyimpan tier, capability, dan limit per modul (`core_effective_entitlements`)                                                                           | —                                                                                                                      |

---

## 2. Struktur target

```text
apps/api/src/
  main.ts
  app.module.ts
  bootstrap/                  middleware global, filter, pipe, OpenAPI
  shared/                     hanya util teknis tanpa logika domain
    money/                    operasi integer satuan terkecil
    time/                     UTC, zona waktu lokasi
    errors/                   DomainError + katalog kode
    result/
  core/
    auth/
    workspaces/               (organization sekarang)
    memberships/              (access sekarang)
    permissions/
    subscriptions/            paket berversi, langganan
    entitlements/             evaluator entitlement efektif
    installations/            lifecycle instalasi modul
    integrations/             binding
    metering/                 dimensi, event pemakaian, limit
    devices/
    audit/
    idempotency/
    events/                   outbox, inbox, registry handler
    manifest/                 registry manifest modul
    platform/                 sesi dan master platform
  kernels/
    catalog/
    order-intake/
    billing-payment-ledger/
    finance-core/
    reporting-projection/
  modules/
    catalog-profile/
    pos-sales/
    floor-self-order/
    kds/
    inventory/
    business-finance/
    human-capital/
    customer/
```

### 2.1 Struktur dalam satu modul

```text
modules/kds/
  domain/
    ticket.ts                 entity + transisi status (tanpa framework)
    ticket-status.ts
    events.ts                 definisi event yang dihasilkan
  application/
    commands/
      create-kitchen-ticket.ts
      start-ticket.ts
      mark-ticket-ready.ts
    queries/
      list-active-tickets.ts
    ports/
      ticket.repository.ts    interface
    dto/
  adapters/
    http/
      kds.controller.ts       auth, parsing, pemetaan error
    events/
      on-order-submitted.handler.ts
    persistence/
      prisma-ticket.repository.ts
  kds.module.ts               wiring NestJS
  manifest.ts                 manifest modul
  public.ts                   satu-satunya pintu untuk modul lain
```

### 2.2 Urutan migrasi struktur

Struktur dipindahkan bertahap; tidak ada "pindah besar" dalam satu commit.

1. Buat folder `core/`, `kernels/`, `modules/`, `shared/`, `bootstrap/` dan aturan lint batas modul.
2. Pindahkan `auth`, `access`, `organization`, `entitlement`, `platform`, `security`, `observability`, `audit` ke `core/` tanpa mengubah perilaku (satu commit per folder; test harus tetap hijau).
3. Pindahkan `catalog` ke `kernels/catalog` + `modules/catalog-profile`, lalu pecah file besarnya per use case.
4. Modul baru (POS, KDS, dan seterusnya) langsung dibuat dengan struktur target.

---

## 3. Aturan impor

| Dari                  | Boleh mengimpor                                                                                                          |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `modules/x`           | `core/*` (hanya `public.ts`), `kernels/*` (hanya `public.ts`), `shared/*`, `modules/y/public.ts` yang diizinkan manifest |
| `kernels/x`           | `core/*/public.ts`, `shared/*`                                                                                           |
| `core/x`              | `core/y/public.ts`, `shared/*`                                                                                           |
| `shared/*`            | Tidak mengimpor apa pun dari `core`, `kernels`, `modules`                                                                |
| `domain/` dalam modul | Tidak mengimpor NestJS, Prisma, atau `adapters/`                                                                         |
| `application/`        | `domain/`, `ports/`; tidak mengimpor Prisma atau HTTP                                                                    |
| `adapters/`           | `application/`, `domain/`                                                                                                |

Larangan keras:

- Mengimpor `domain/`, `application/`, atau `adapters/` milik modul lain.
- Mengimpor repository atau klien Prisma milik modul lain.
- Ketergantungan melingkar antarmodul.
- Menaruh logika domain di `shared/` untuk menghindari batas.

Aturan ini dijaga `apps/api/scripts/check-boundaries.mjs`, yang berjalan sebagai bagian dari `pnpm lint` (dan karena itu di CI). Skrip itu membaca impor yang sebenarnya, bukan pola nama, dan punya test sendiri (`check-boundaries.test.mjs`). Yang diperiksa:

- Unit lain (`core/x`, `kernels/x`, `modules/x`) hanya boleh diimpor lewat `public.ts`-nya.
- Arah ketergantungan sesuai tabel di atas; `bootstrap/` boleh memakai `core` dan `shared`; `cli/` dan berkas akar (`main.ts`, `app.module.ts`) merangkai semuanya.
- Di dalam unit berlapis: `domain/` tidak mengimpor NestJS, database, `application/`, atau `adapters/`; `application/` tidak mengimpor database atau `adapters/`.
- Berkas `*.spec.ts` dikecualikan: test boleh menjangkau isi unit.

Tidak ada pengecualian lagi di skrip. Kernel tidak mengimpor kernel lain, juga tidak lewat `public.ts`: `kernels/order-intake` menyatakan port `SELLABLE_MENU_SOURCE`, dan `kernel-wiring.module.ts` di akar menyambungkannya ke `CatalogService`. Izin antarmodul berdasarkan manifest belum ada; sampai registry manifest dibuat (`M2-BE-07`), modul tidak boleh mengimpor modul lain sama sekali.

Kontrak aturannya juga tersedia sebagai `moduleBoundaryRuleSchema` di `packages/contracts`.

---

## 4. Use case

Satu aksi bisnis = satu kelas use case = satu file.

```ts
// modules/kds/application/commands/create-kitchen-ticket.ts
@Injectable()
export class CreateKitchenTicket {
  constructor(
    @Inject(TICKET_REPOSITORY) private readonly tickets: TicketRepository,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(OUTBOX) private readonly outbox: Outbox,
  ) {}

  async execute(input: CreateKitchenTicketInput, ctx: CommandContext): Promise<KitchenTicketDto> {
    const existing = await this.tickets.findBySource(
      ctx.workspaceId,
      input.source,
      input.sourceReference,
    );
    if (existing) return toDto(existing); // idempotent

    const ticket = KitchenTicket.create(input, ctx);

    await this.uow.run(async (tx) => {
      await this.tickets.save(ticket, tx);
      await this.outbox.append(ticket.pullEvents(), tx);
    });

    return toDto(ticket);
  }
}
```

Aturan:

- Controller HTTP, handler event, adapter webhook, dan adapter impor memanggil kelas yang **sama**. Tidak ada logika KDS versi POS dan versi mandiri.
- Adapter hanya mengurus autentikasi, parsing, pemetaan input, dan pemetaan error. Validasi bisnis ada di use case dan domain.
- Use case menerima `CommandContext`; `workspaceId`, izin, dan identitas tidak pernah dipercaya dari body.
- Aggregate sumber dan event outbox disimpan dalam satu transaksi.
- Use case mengembalikan DTO, bukan entity ORM.
- Query (baca) dipisah dari command (tulis); query boleh langsung membaca read model.

### 4.1 CommandContext

```ts
interface CommandContext {
  workspaceId: string;
  locationId?: string;
  actorId?: string;
  actorType: "USER" | "DEVICE" | "SYSTEM" | "INTEGRATION";
  channel: "WEB" | "MOBILE" | "POS" | "KDS" | "API" | "IMPORT";
  deviceId?: string;
  idempotencyKey: string;
  correlationId: string;
  causationId?: string;
  occurredAt: string;
  receivedAt: string;
  clientVersion?: string;
}
```

Skemanya sudah ada (`commandContextSchema`). Konteks dibentuk oleh adapter dari sesi, header yang sudah divalidasi, dan request ID.

**Yang berjalan sejak 4 Oktober 2026** (`shared/command/command-origin.ts`):

- Tipe `CommandOrigin` membawa bagian konteks yang menjelaskan asal perintah: `actorId`, `channel`, `clientVersion`, `deviceId`, `requestId` (menjadi `correlationId` event), dan `causationId`. Semua `*MutationContext` di API adalah tipe ini.
- `commandOriginFromRequest` dipakai semua controller. Channel dibaca dari header `x-client-channel` (nilai di luar daftar ditolak `400`), versi klien dari `x-client-version`. Klien yang tidak menyebut channel dihitung `API`. Klien web mengirim `WEB` dan versinya.
- `commandOriginFromEvent` dipakai handler event: perintah yang dikeluarkan handler memakai `causationId` = ID event dan `correlationId` yang sama, dengan aktor `SYSTEM`.
- `eventOrigin` mengisi kolom envelope di `outbox_events`. Sebuah test menolak penulisan outbox tanpa `eventOrigin` dan controller yang merakit konteks sendiri.
- `deviceId` hanya diisi dari perangkat yang terautentikasi, tidak dari header: guard sesi menaruhnya di `AuthorizationContext.deviceId` untuk sesi yang terikat perangkat, dan controller POS meneruskannya lewat argumen ketiga `commandOriginFromRequest`. Bila ada pengguna yang masuk di perangkat itu, pengguna tetap menjadi aktor event dan perangkat dicatat di sampingnya; perangkat menjadi aktor hanya bila tidak ada pengguna.
- Belum dikerjakan: `idempotencyKey`, `occurredAt`, dan `receivedAt` masih dibawa sebagai argumen use case masing-masing, belum di dalam konteks; `audit_logs.channel` dan `audit_logs.correlation_id` belum diisi.

---

## 5. SOLID dalam praktik

| Prinsip                           | Aturan di repo ini                                                                                                                                                    |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **S** — satu tanggung jawab       | Satu use case per file. Controller tidak berisi aturan bisnis. Repository tidak berisi aturan bisnis. File di atas ±300 baris adalah tanda harus dipecah              |
| **O** — terbuka untuk perluasan   | Menambah sumber input berarti menambah adapter, bukan mengubah use case. Menambah reaksi antarmodul berarti menambah handler dan binding, bukan mengubah modul sumber |
| **L** — dapat disubstitusi        | Implementasi repository (Prisma, in-memory untuk test) mematuhi kontrak port yang sama; test use case berjalan dengan keduanya                                        |
| **I** — antarmuka kecil           | Port dipecah per kebutuhan (`TicketReader`, `TicketWriter`) bila konsumen hanya butuh sebagian. `public.ts` hanya mengekspor yang benar-benar dipakai modul lain      |
| **D** — bergantung pada abstraksi | Use case bergantung pada port (interface + token injeksi), bukan pada Prisma. Pola ini sudah dipakai (`CATALOG_REPOSITORY`) dan dilanjutkan                           |

Aturan tambahan:

- Domain murni: entity dan transisi status tidak mengimpor framework, sehingga dapat diuji tanpa database.
- Transisi status hanya melalui metode entity (`ticket.start()`), bukan dengan mengisi kolom status langsung.
- Tidak ada `any`. Input dari luar selalu melewati skema Zod.
- Fungsi murni untuk perhitungan (total, pajak, selisih kas) berada di domain dan memiliki unit test.

---

## 6. Integrasi antarmodul yang aman

### 6.1 Facade publik (sinkron)

```ts
// kernels/catalog/public.ts
export interface CatalogFacade {
  getSellableProduct(
    workspaceId: string,
    locationId: string,
    productId: string,
  ): Promise<SellableProductDto | null>;
}
export const CATALOG_FACADE = Symbol("CATALOG_FACADE");
```

- Mengembalikan DTO kecil, bukan entity atau repository.
- Boleh menjawab `UNAVAILABLE` bila modul target tidak terpasang.
- Tidak boleh menciptakan ketergantungan melingkar.

### 6.2 Event (asinkron)

```text
Use case sumber
  -> simpan aggregate + outbox (satu transaksi)
Worker dispatcher
  -> ambil event yang belum diproses (klaim dengan SELECT … FOR UPDATE SKIP LOCKED)
  -> untuk tiap binding ACTIVE yang cocok:
       cek instalasi target ACTIVE + entitlement
       cek inbox (workspace_id, consumer_name, event_id)
       jalankan handler -> use case target
       catat inbox
```

Aturan handler:

1. Idempotent: event yang sama dua kali menghasilkan satu efek.
2. Memanggil use case target, tidak menulis tabel langsung.
3. Tidak memproses bila instalasi target tidak `ACTIVE`; event masuk kebijakan jeda/coba ulang, bukan ditandai sukses.
4. Error sementara → coba ulang dengan jeda bertahap. Error konfigurasi/validasi → `BLOCKED` dengan alasan aman.
5. Kegagalan handler tidak pernah membatalkan transaksi sumber.
6. Hanya event setelah `effective_from` binding yang diproses; data lama tidak diproses otomatis.
7. Payload event hanya berisi fakta berupa ID dan nilai. Penulis outbox wajib memakai `safeEventPayload` (`security.md` bagian data sensitif); sebuah test menolak penulisan outbox yang melewatinya.

Reaksi milik core platform (`CORE_*`, misalnya projection entitlement dan metering) tidak memakai binding: core selalu aktif dan bukan integrasi yang bisa dimatikan workspace.

Limit dalam kode (`core/metering`, `shared/limits/limit-gate.ts`, berjalan sejak 4 Oktober 2026):

- **Hard count:** pemilik data bertanya ke `LimitGate.assertCanAdd(tenantId, dimensi)` sebelum membuat sesuatu. Bila penuh, hasilnya `409 LIMIT_REACHED` dengan `details` berisi `dimensionKey`, `limit`, `usage`. Data yang sudah ada tidak disentuh, juga saat pemakaian sudah di atas batas setelah turun paket.
- **Hitungan aktif** tidak dijumlah dari event. Pemilik data mendaftarkan penghitung ke `UsageGaugeRegistry` (`*.gauges.ts`). Tanpa limit, dengan limit tak terbatas, atau tanpa penghitung, pembuatan diloloskan.
- **Soft metered:** `MeteringService.record` tidak pernah menolak; ambang 80% dan 100% diumumkan sekali per periode lewat `usage.threshold_reached.v1`. Penjualan POS dihitung oleh handler `core.usage_pos_sales` dari `sale.completed.v1`.
- **Throttled:** `MeteringService.consumeThrottled` menghitung selama kuota siklus masih ada dan menolak dengan `429 RATE_LIMITED` (`details.retryAfter` = akhir periode) bila habis. Belum ada pemakainya; ekspor dan API eksternal memakainya saat dibangun.
- Refund, pembalikan, koreksi, dan penutupan shift tidak memanggil gerbang limit, jadi tidak pernah diblokir kuota.
- `shared/limits` hanya berisi kontrak dan token; `MeteringModule` bersifat global agar pemilik data tidak mengimpor `core/metering`.

Binding dalam kode (`core/integrations`, berjalan sejak 3 Oktober 2026):

- Binding hanya diperlukan bila modul penerima berbeda dari modul yang mengumumkan event. Reaksi di dalam satu modul berjalan tanpa binding.
- Binding dibuat `ACTIVE` saat instalasi modul penerima selesai, dengan `effective_from` = waktu instalasi. Saat modul dilepas, binding menjadi `DISABLED` (tidak dihapus); saat dipasang lagi, binding aktif kembali dengan `effective_from` baru.
- Keputusan dispatcher per handler: tanpa binding, `DISABLED`, `DRAFT`, atau event di luar masa berlaku → handler dilewati dan event selesai; `PAUSED`, `SETUP_REQUIRED`, `ERROR` → inbox `BLOCKED` dengan alasan aman, bisa diulang nanti; `ACTIVE` → lanjut ke cek instalasi dan handler.
- Hasil pengiriman terakhir dicatat di `health` dan `last_error` binding.
- Endpoint: `GET /modules/bindings`, `POST /modules/bindings/:id/pause` (wajib alasan), `POST /modules/bindings/:id/resume`. Perubahan status masuk audit (`integration_binding.*`).

### 6.3 Manifest modul

Setiap modul mendaftarkan `manifest.ts` (skema `moduleManifestSchema`): kunci, versi, jenis workspace yang didukung, ketergantungan, capability, izin, rute, navigasi, pengaturan, event yang dihasilkan, handler, langkah instalasi, dan versi skema konfigurasi. Manifest dipakai oleh penyelesai ketergantungan, provisioning, navigasi, guard rute, katalog izin, dan Package Builder. Manifest tidak memuat konfigurasi khusus pelanggan.

---

## 7. Kontrak bersama

`packages/contracts` dipecah per domain tanpa mengubah ekspor publik:

```text
packages/contracts/src/
  index.ts                 re-export
  common/                  header, pagination, error, id, money
  auth/
  organization/
  access/
  subscription/            paket, limit, pemakaian
  module/                  manifest, instalasi, binding, batas modul
  event/                   envelope, inbox
  command/                 command context
  catalog/
  pos/  floor/  kds/  inventory/  finance/  hc/  customer/
  error-codes.ts           katalog kode error (dipakai klien untuk terjemahan)
```

Aturan:

- Setiap endpoint memvalidasi header, params, query, body, **dan response** dengan skema dari paket ini.
- Tipe TypeScript diturunkan dari skema (`z.infer`), tidak ditulis ganda.
- Uang: string integer satuan terkecil (`moneyMinorSchema`).
- Waktu: string ISO 8601 UTC.
- Perubahan yang memutus kompatibilitas membutuhkan versi API atau versi event baru.

---

### 7.1 Pajak dan service charge per outlet

Satu fungsi, `computeCharges` di `packages/contracts/src/charges.ts`, memecah jumlah harga menu menjadi dasar, service charge, pajak, dan total. API memakainya saat membuat tagihan; layar kasir dan form outlet memakainya untuk menampilkan total sebelum bayar. Karena fungsinya sama, angka di layar dan di tagihan tidak bisa berbeda.

- Tarif disimpan dalam basis poin bilangan bulat (1100 = 11%). Semua hitungan memakai `bigint`; pembagian dibulatkan setengah ke atas.
- **Ditambahkan di struk:** service = harga menu × tarif service; pajak = (harga menu + service) × tarif pajak; total = jumlah ketiganya.
- **Sudah termasuk:** total = harga menu. Pajak dikeluarkan dulu dari total, lalu service dari sisanya; dasar adalah sisanya. Ketiganya selalu berjumlah persis total.
- Tarif dibaca saat membayar dan disalin ke tagihan. Permintaan bayar membawa `expectedTotalMinor`; bila berbeda dari hitungan server, permintaan ditolak `ORDER_TOTAL_CHANGED` dan tidak ada yang ditagih.
- Bawaan outlet (sudah termasuk, kedua tarif 0) adalah keputusan `M1-OD-01`: harga menu adalah harga akhir.

### 7.2 Dokumen finansial kunjungan (GAP06B-01/02)

`packages/contracts/src/visit-document.ts` menetapkan keluaran read-only; `modules/floor/domain/visit-financial-document.ts` memproyeksikan paid receipt snapshots dan order belum dibayar tanpa IO/mutasi. Transaksi payment dan refund dideduplikasi berdasarkan ID; snapshot bertentangan atau payment shared yang tidak tertutup lengkap dalam visit ditolak. Pending dipisahkan dari pricing/hutang; refund tidak membuka hutang baru. Nilai paid memakai snapshot lama, unpaid memakai `computeCharges` kini, seluruh agregasi bigint/string.

`GET /floor/sessions/:id/document` memakai `ReadVisitDocument`, facade publik OrderIntake/BillingReceiptQueries/Organization, dan repository Floor pemilik session. Guard modul Floor + `order.create` mengikuti receipt POS aktual (bukan izin baru `order.view`); response `visitDocumentSchema`/OpenAPI `VisitDocument`, `private, no-store`. Seluruh order visit dibaca tanpa pagination/cutoff; bill semua status dibaca agar paid bill rusak tidak hilang sebagai unpaid. Invariant/scope salah atau alokasi tak lengkap menghasilkan 409 `RECEIPT_ALLOCATION_UNAVAILABLE`. UI/cetak tersedia melalui B-03 pada flow kunjungan yang ada dan hanya memakai query ini; tidak ada perubahan ledger/schema/migrasi atau command uang dari cetak. Inventaris, state, bukti dan checkpoint berikutnya: [`M04-struk-kunjungan.md` bagian 7](../milestones/M04-struk-kunjungan.md#7-gap06b--checkpoint-dan-kontrak).

## 8. Persistence

- Hanya `adapters/persistence` yang mengimpor klien Prisma.
- Setiap query membawa `tenant_id`; query berbatas lokasi juga membawa `outlet_id`. Tidak ada query domain tanpa keduanya.
- Repository mengembalikan record domain, bukan tipe Prisma mentah.
- Transaksi dikelola melalui port `UnitOfWork`; use case tidak memanggil `prisma.$transaction` langsung.
- Tidak ada `delete` pada master dan transaksi; pakai perubahan status.
- Pelanggaran keunikan (`P2002`) dipetakan menjadi `DomainError` konflik di repository atau use case, bukan dibiarkan menjadi 500.
- Daftar besar memakai pagination cursor dan proyeksi kolom yang aman.

---

### 8.1 Snapshot query lintas pemilik data

Port teknis `shared/query/read-snapshot.ts` menyediakan `READ_SNAPSHOTS.run(scope, callback)`; implementasi `core/read-snapshots` membuka satu transaksi `RepeatableRead` dengan `SET TRANSACTION READ ONLY` (timeout 10 detik, max wait 3 detik). Capability internal frozen menyimpan scope tenant/outlet dan kedaluwarsa setelah callback selesai/gagal. `readDatabase` hanya untuk adapter pemilik data; transaksi disimpan di registry WeakMap selama callback, bukan ambient/global current transaction. Application/domain hanya membawa capability, tidak menerima/mengimpor Prisma.

Facade/repository read terkait menerima capability eksplisit; query kunjungan menggunakannya untuk session/meja, order, ledger/refund, serta currency/tarif/metadata outlet. Tanpa capability, read lama tetap memakai client biasa; tidak ada perubahan perilaku command. Capability salah scope/kedaluwarsa ditolak; database menolak write dalam callback. Jangan memakai callback untuk jaringan/IO eksternal, command atau pekerjaan panjang. Ini snapshot konsisten pada waktu read, bukan lock/promise atas perubahan sesudah response atau pengganti pemeriksaan izin di controller.

## 9. Error

Bentuk respons (sudah berjalan):

```json
{ "code": "ROLE_NOT_FOUND", "message": "…", "requestId": "req_…", "details": {} }
```

Aturan baru untuk dua bahasa:

- `code` adalah kontrak stabil berformat `UPPER_SNAKE_CASE` dan terdaftar di `packages/contracts/error-codes.ts`.
- `message` di server ditulis dalam **Bahasa Inggris netral** sebagai cadangan dan untuk log; klien menampilkan teks dari kamus berdasarkan `code`.
- `details` membawa parameter untuk pesan (misalnya `limit`, `usage`, `field`), bukan kalimat.
- Error 5xx tidak pernah membawa detail internal.

Kode akses minimum:

| Kode                          | HTTP | Kondisi                                                                   |
| ----------------------------- | ---- | ------------------------------------------------------------------------- |
| `AUTH_SESSION_INVALID`        | 401  | Sesi tidak ada atau kedaluwarsa                                           |
| `WORKSPACE_ACCESS_DENIED`     | 403  | Bukan anggota aktif workspace; dikembalikan sebelum data langganan dibaca |
| `CSRF_TOKEN_REQUIRED`         | 403  | Header CSRF tidak ada                                                     |
| `PERMISSION_DENIED`           | 403  | Pengguna tidak punya izin                                                 |
| `LOCATION_SCOPE_DENIED`       | 403  | Lokasi di luar cakupan                                                    |
| `ENTITLEMENT_REQUIRED`        | 403  | Modul/capability tidak dibeli                                             |
| `TIER_UPGRADE_REQUIRED`       | 403  | Butuh tier lebih tinggi                                                   |
| `INSTALLATION_SETUP_REQUIRED` | 409  | Setup modul belum lengkap                                                 |
| `FEATURE_DISABLED`            | 403  | Feature flag belum membuka fitur                                          |
| `SUBSCRIPTION_SUSPENDED`      | 403  | Langganan tidak dapat dipakai                                             |
| `LIMIT_REACHED`               | 409  | Batas hard tercapai                                                       |
| `RATE_LIMIT_EXCEEDED`         | 429  | Batas laju                                                                |
| `VALIDATION_ERROR`            | 400  | Input tidak valid; `details.issues` berisi field                          |
| `IDEMPOTENCY_KEY_REUSED`      | 409  | Kunci sama dengan payload berbeda                                         |
| `NOT_FOUND`                   | 404  | Termasuk record milik workspace lain (tanpa membocorkan keberadaannya)    |

---

Kode akses di atas (selain sesi, CSRF, rate limit, validasi, dan idempotency) dihasilkan satu tempat: `evaluateAccess` di `apps/api/src/core/entitlements/access-evaluator.ts`. Fungsi itu memeriksa menurut urutan `architecture.md` 6.3 dan berhenti pada kegagalan pertama, jadi alasan yang dikembalikan selalu yang paling mendasar. `details` membawa parameter (`moduleKey`, `capability`, `requiredTier`, `dimensionKey`, `limit`, `usage`). `SessionPermissionGuard` mengumpulkan fakta lalu memanggilnya; langkah instalasi, capability, feature flag, dan limit sudah didukung evaluator tetapi belum punya sumber data (`M2-BE-06`, `M2-BE-07`, `M2-BE-11`).

## 10. Guard dan otorisasi

Guard yang ada (`SessionPermissionGuard` dengan `@RequirePermission`, `@RequireModule`, `@RequireAllOutlets`, `@CurrentAccess`) dipertahankan dan diperluas:

```ts
@Post("tickets/:id/ready")
@RequireCapability("kds.ticket.manage")   // menggantikan @RequireModule
@RequirePermission(PERMISSIONS.kdsTicketManage)
@Idempotent()
markReady(@Param(...) params, @CurrentAccess() access, @Command() ctx) { … }
```

- `@RequireCapability` memeriksa langganan, instalasi, dan capability sekaligus, dan mengembalikan kode yang berbeda untuk tiap kegagalan.
- `@Idempotent()` mewajibkan header `Idempotency-Key`, menyimpan hasil pertama, dan menolak kunci yang sama dengan payload berbeda.
- Implementasi draft M2-BE-14 berada di `core/idempotency`, dipakai `POST /modules/bindings/:id/retry`. Respons JSON non-secret direkam per tenant/outlet/route; actor, device, metode, params, query, dan body termasuk hash. Hasil COMPLETED dapat diputar ulang 24 jam dengan status HTTP yang sama. Kunci PENDING/FAILED tetap tertahan dan membutuhkan pemeriksaan hasil, tidak dilepas otomatis saat timeout/kedaluwarsa. Interceptor tidak membuat mutasi domain dan penyimpanan respons menjadi satu transaksi; jika proses mati di antaranya, kunci tetap tertahan agar tindakan tidak diulang. Domain finansial yang sudah punya kunci transaksionalnya sendiri tetap memakai mekanisme tersebut. Respons berisi secret (aktivasi perangkat, autentikasi, undangan) tidak memakai interceptor ini.
- Header konteks hanya **memilih** workspace dan lokasi; guard membuktikan keanggotaan dan cakupan.
- Sesi platform dan sesi merchant tidak pernah saling diterima.

---

## 11. Worker

`apps/worker` menjadi proses kedua dari codebase yang sama:

| Tugas                | Keterangan                                                                            |
| -------------------- | ------------------------------------------------------------------------------------- |
| Outbox dispatcher    | Mengklaim event, memanggil handler terdaftar, mencatat inbox, coba ulang, dead-letter |
| Pembangun projection | Saldo stok, rekap harian, counter pemakaian                                           |
| Job terjadwal        | Kedaluwarsa sesi, pengingat limit, pembersihan kunci idempotency                      |

Worker memakai modul yang sama dengan API (use case dan repository), bukan salinan logika: `apps/worker` mengimpor `@merchant/api/worker-runtime`, yang membuat konteks aplikasi NestJS tanpa server HTTP. Karena itu `apps/worker/tsconfig.json` ikut memuat sumber API (dekorator), dan worker dijalankan dari sumber TypeScript dengan `tsx`, tidak dari `dist`. Dispatcher mengklaim event dengan `FOR UPDATE SKIP LOCKED` dan masa sewa (`available_at`), jadi beberapa worker bisa berjalan bersamaan dan event kembali tersedia bila worker mati. Handler didaftarkan modul saat aplikasi mulai dan harus sama persis dengan `eventHandlers` di manifest; bila tidak, worker menolak mulai. Shutdown harus bersih: berhenti mengklaim, menyelesaikan pekerjaan berjalan, lalu keluar. Redis/BullMQ baru ditambahkan bila dispatcher berbasis polling database tidak lagi memadai.

---

## 12. Test

| Jenis              | Lokasi                                                     | Yang diuji                                             |
| ------------------ | ---------------------------------------------------------- | ------------------------------------------------------ |
| Unit domain        | `domain/*.spec.ts`                                         | Transisi status, perhitungan                           |
| Unit use case      | `application/**/*.spec.ts`                                 | Alur dengan repository in-memory; idempotency          |
| Kontrak API        | `*.controller.spec.ts`, `api-contract.spec.ts`             | Skema request/response, kode error                     |
| Isolasi            | `reliability/*.spec.ts`, `tenant-isolation-schema.spec.ts` | Substitusi ID lintas workspace; constraint skema       |
| Integrasi database | (belum ada)                                                | PostgreSQL sekali pakai; constraint, transaksi, outbox |
| Kontrak event      | `packages/contracts`                                       | Envelope dan payload per versi                         |

Setiap checkpoint backend minimal lulus: lint, typecheck, unit dan kontrak terkait, test API, test skema/migrasi bila ada, dan regresi keamanan sesuai cakupan. Perintah: `pnpm lint`, `pnpm typecheck`, `pnpm test`.

---

## 13. Checklist sebelum menulis endpoint

- [ ] Modul pemilik data dan tabelnya jelas.
- [ ] Use case, input, DTO keluaran, dan event yang dihasilkan ditetapkan.
- [ ] Capability, izin, dan cakupan lokasi ditetapkan.
- [ ] Skema Zod untuk header, params, query, body, dan response ada di `packages/contracts`.
- [ ] Kode error baru terdaftar.
- [ ] Idempotency ditetapkan untuk mutasi kritis.
- [ ] Audit ditetapkan untuk aksi sensitif.
- [ ] Dimensi limit yang terdampak ditetapkan.
- [ ] Tidak ada impor lintas modul selain `public.ts`.
- [ ] Response tidak memuat field yang dilarang untuk surface tujuannya.
- [ ] Test isolasi lintas workspace ditambahkan.
