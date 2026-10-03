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
    memberships/              (dulu access) role, membership, konteks workspace, SessionPermissionGuard
    entitlements/             (dulu entitlement) langganan + entitlement boolean per modul
    workspaces/               (dulu organization) tenant, brand, outlet
    platform/                 sesi platform, master tenant/langganan/entitlement, CLI provisioning
    security/                 rate limit
    observability/            request ID, log terstruktur
    audit/                    audit aksi kritis
    manifest/                 registry manifest modul (kunci capability per tier, dimensi limit, izin, navigasi, event, ketergantungan)
  catalog/                    kategori, produk, varian, modifier, gambar, produk per outlet (dipecah di M2-QA-02)
  kernels/
    order-intake/             pesanan dan item
    billing-payment-ledger/   tagihan, pembayaran, penjualan, refund
  modules/
    pos-sales/                shift dan kas, pesanan kasir, keranjang tertahan
  module-manifests.ts         daftar manifest semua unit; satu-satunya tempat yang perlu diubah saat modul baru ditambahkan
  reliability/                test isolasi tenant/outlet
apps/worker/src/
  index.ts                    worker BullMQ untuk antrean `system` + smoke check lewat Redis; belum ada dispatcher outbox
  queues.ts                   nama antrean, opsi job bawaan, koneksi dari REDIS_URL
  queue-retry.ts              helper coba ulang/dead-letter
packages/contracts/src/           satu file per domain (http, money, auth, platform, organization, catalog, entitlement, access, module-manifest, packages-limits, events, support-access, table-qr, pos-shift, menu, orders, billing, held-carts, openapi); index.ts hanya mengekspor ulang
packages/database/            skema Prisma, 9 migrasi, klien, drill backup/restore
```

Pola per modul saat ini: `*.controller.ts` → `*.service.ts` → `*.repository.ts`, dengan repository di-inject melalui token (`CATALOG_REPOSITORY`).

### 1.1 Endpoint yang berjalan (prefix `/api/v1`)

| Area | Endpoint |
|---|---|
| Health | `GET /health` |
| Auth | `POST /auth/login`, `GET /auth/session`, `POST /auth/logout` |
| Access | `GET /access/context`, `GET /access/workspaces`, `GET/POST /access/roles`, `PATCH /access/roles/:id`, `GET/POST /access/memberships`, `PATCH /access/memberships/:id` |
| Organization | `GET /organization`, `PATCH /organization/tenant`, `POST /organization/brands`, `PATCH /organization/brands/:id`, `POST /organization/outlets`, `PATCH /organization/outlets/:id` |
| Catalog | `GET /catalog`; `POST` + `PATCH /:id` untuk `categories`, `products`, `variants`, `modifier-groups`, `modifier-options`, `product-modifier-groups`, `product-images`; `GET /catalog/outlets/:outletId`, `POST /catalog/outlets/:outletId/products`, `PATCH /catalog/outlets/:outletId/products/:id` |
| Platform | `POST /platform/auth/login`, `GET /platform/auth/session`, `POST /platform/auth/logout`, `GET /platform/context`, `POST /platform/tenants`, `GET/PATCH /platform/tenants/:id`, `POST /platform/tenants/:id/subscriptions`, `PUT /platform/tenants/:id/entitlements/:moduleKey` |

### 1.2 Yang perlu dibenahi

| Temuan | Dampak | Perbaikan |
|---|---|---|
| Semua folder sejajar di `src/`; tidak ada pemisahan core, kernel, modul | Batas modul tidak terlihat dan tidak dapat di-lint | Struktur target bagian 2 |
| `catalog.repository.ts` 1.226 baris, `catalog.service.ts` 667 baris, `catalog.controller.ts` 546 baris | Sulit diuji dan ditinjau | Pecah per use case (bagian 4) |
| `packages/contracts/src/index.ts` satu file | Konflik merge, sulit dicari | Pecah per domain (bagian 7) |
| Pesan error ditulis dalam Bahasa Indonesia di server | Tidak mendukung dua bahasa | Kode stabil + terjemahan di klien (bagian 9) |
| Rate limit di memori proses | Tidak berlaku lintas instance | Pindah ke Redis saat lebih dari satu instance |
| Belum ada dispatcher outbox, inbox, registry manifest, instalasi, binding, metering | Integrasi antarmodul belum dapat berjalan | Tahap B di `prd.md` |
| Entitlement berupa boolean per modul | Tidak mengenal tier, capability, limit | Diganti evaluator entitlement efektif |

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

| Dari | Boleh mengimpor |
|---|---|
| `modules/x` | `core/*` (hanya `public.ts`), `kernels/*` (hanya `public.ts`), `shared/*`, `modules/y/public.ts` yang diizinkan manifest |
| `kernels/x` | `core/*/public.ts`, `shared/*` |
| `core/x` | `core/y/public.ts`, `shared/*` |
| `shared/*` | Tidak mengimpor apa pun dari `core`, `kernels`, `modules` |
| `domain/` dalam modul | Tidak mengimpor NestJS, Prisma, atau `adapters/` |
| `application/` | `domain/`, `ports/`; tidak mengimpor Prisma atau HTTP |
| `adapters/` | `application/`, `domain/` |

Larangan keras:

- Mengimpor `domain/`, `application/`, atau `adapters/` milik modul lain.
- Mengimpor repository atau klien Prisma milik modul lain.
- Ketergantungan melingkar antarmodul.
- Menaruh logika domain di `shared/` untuk menghindari batas.

Aturan ini dijaga `apps/api/scripts/check-boundaries.mjs`, yang berjalan sebagai bagian dari `pnpm lint` (dan karena itu di CI). Skrip itu membaca impor yang sebenarnya, bukan pola nama, dan punya test sendiri (`check-boundaries.test.mjs`). Yang diperiksa:

- Unit lain (`core/x`, `kernels/x`, `modules/x`, `catalog`) hanya boleh diimpor lewat `public.ts`-nya.
- Arah ketergantungan sesuai tabel di atas; `bootstrap/` boleh memakai `core` dan `shared`; `cli/` dan berkas akar (`main.ts`, `app.module.ts`) merangkai semuanya.
- Di dalam unit berlapis: `domain/` tidak mengimpor NestJS, database, `application/`, atau `adapters/`; `application/` tidak mengimpor database atau `adapters/`.
- Berkas `*.spec.ts` dikecualikan: test boleh menjangkau isi unit.

Pengecualian yang masih ada, tercatat di skrip: `kernels/order-intake` membaca `catalog` (lewat `public.ts`) sampai Catalog menjadi kernel dengan port sendiri (`M2-QA-02`). Izin antarmodul berdasarkan manifest belum ada; sampai registry manifest dibuat (`M2-BE-07`), modul tidak boleh mengimpor modul lain sama sekali.

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
    const existing = await this.tickets.findBySource(ctx.workspaceId, input.source, input.sourceReference);
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

---

## 5. SOLID dalam praktik

| Prinsip | Aturan di repo ini |
|---|---|
| **S** — satu tanggung jawab | Satu use case per file. Controller tidak berisi aturan bisnis. Repository tidak berisi aturan bisnis. File di atas ±300 baris adalah tanda harus dipecah |
| **O** — terbuka untuk perluasan | Menambah sumber input berarti menambah adapter, bukan mengubah use case. Menambah reaksi antarmodul berarti menambah handler dan binding, bukan mengubah modul sumber |
| **L** — dapat disubstitusi | Implementasi repository (Prisma, in-memory untuk test) mematuhi kontrak port yang sama; test use case berjalan dengan keduanya |
| **I** — antarmuka kecil | Port dipecah per kebutuhan (`TicketReader`, `TicketWriter`) bila konsumen hanya butuh sebagian. `public.ts` hanya mengekspor yang benar-benar dipakai modul lain |
| **D** — bergantung pada abstraksi | Use case bergantung pada port (interface + token injeksi), bukan pada Prisma. Pola ini sudah dipakai (`CATALOG_REPOSITORY`) dan dilanjutkan |

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
  getSellableProduct(workspaceId: string, locationId: string, productId: string): Promise<SellableProductDto | null>;
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

## 8. Persistence

- Hanya `adapters/persistence` yang mengimpor klien Prisma.
- Setiap query membawa `tenant_id`; query berbatas lokasi juga membawa `outlet_id`. Tidak ada query domain tanpa keduanya.
- Repository mengembalikan record domain, bukan tipe Prisma mentah.
- Transaksi dikelola melalui port `UnitOfWork`; use case tidak memanggil `prisma.$transaction` langsung.
- Tidak ada `delete` pada master dan transaksi; pakai perubahan status.
- Pelanggaran keunikan (`P2002`) dipetakan menjadi `DomainError` konflik di repository atau use case, bukan dibiarkan menjadi 500.
- Daftar besar memakai pagination cursor dan proyeksi kolom yang aman.

---

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

| Kode | HTTP | Kondisi |
|---|---|---|
| `AUTH_SESSION_INVALID` | 401 | Sesi tidak ada atau kedaluwarsa |
| `WORKSPACE_ACCESS_DENIED` | 403 | Bukan anggota aktif workspace; dikembalikan sebelum data langganan dibaca |
| `CSRF_TOKEN_REQUIRED` | 403 | Header CSRF tidak ada |
| `PERMISSION_DENIED` | 403 | Pengguna tidak punya izin |
| `LOCATION_SCOPE_DENIED` | 403 | Lokasi di luar cakupan |
| `ENTITLEMENT_REQUIRED` | 403 | Modul/capability tidak dibeli |
| `TIER_UPGRADE_REQUIRED` | 403 | Butuh tier lebih tinggi |
| `INSTALLATION_SETUP_REQUIRED` | 409 | Setup modul belum lengkap |
| `FEATURE_DISABLED` | 403 | Feature flag belum membuka fitur |
| `SUBSCRIPTION_SUSPENDED` | 403 | Langganan tidak dapat dipakai |
| `LIMIT_REACHED` | 409 | Batas hard tercapai |
| `RATE_LIMIT_EXCEEDED` | 429 | Batas laju |
| `VALIDATION_ERROR` | 400 | Input tidak valid; `details.issues` berisi field |
| `IDEMPOTENCY_KEY_REUSED` | 409 | Kunci sama dengan payload berbeda |
| `NOT_FOUND` | 404 | Termasuk record milik workspace lain (tanpa membocorkan keberadaannya) |

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
- Header konteks hanya **memilih** workspace dan lokasi; guard membuktikan keanggotaan dan cakupan.
- Sesi platform dan sesi merchant tidak pernah saling diterima.

---

## 11. Worker

`apps/worker` menjadi proses kedua dari codebase yang sama:

| Tugas | Keterangan |
|---|---|
| Outbox dispatcher | Mengklaim event, memanggil handler terdaftar, mencatat inbox, coba ulang, dead-letter |
| Pembangun projection | Saldo stok, rekap harian, counter pemakaian |
| Job terjadwal | Kedaluwarsa sesi, pengingat limit, pembersihan kunci idempotency |

Worker memakai modul yang sama dengan API (use case dan repository), bukan salinan logika. Shutdown harus bersih: berhenti mengklaim, menyelesaikan pekerjaan berjalan, lalu keluar. Redis/BullMQ baru ditambahkan bila dispatcher berbasis polling database tidak lagi memadai.

---

## 12. Test

| Jenis | Lokasi | Yang diuji |
|---|---|---|
| Unit domain | `domain/*.spec.ts` | Transisi status, perhitungan |
| Unit use case | `application/**/*.spec.ts` | Alur dengan repository in-memory; idempotency |
| Kontrak API | `*.controller.spec.ts`, `api-contract.spec.ts` | Skema request/response, kode error |
| Isolasi | `reliability/*.spec.ts`, `tenant-isolation-schema.spec.ts` | Substitusi ID lintas workspace; constraint skema |
| Integrasi database | (belum ada) | PostgreSQL sekali pakai; constraint, transaksi, outbox |
| Kontrak event | `packages/contracts` | Envelope dan payload per versi |

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
