# Backend Modular Delta Audit

**Status:** Backend Delta 1 complete
**Tanggal:** 5 Agustus 2026
**Scope:** Source backend, Prisma schema, contracts, API guards, worker/event foundation, dan security/reliability terhadap PRD Modular v2.3.

## 1. Ringkasan

Backend saat ini sudah memiliki fondasi penting: auth/session, tenant/brand/outlet registry, membership/RBAC/outlet scope, subscription/entitlement boolean, Catalog API-backed flow, audit/idempotency/outbox foundation, rate limit login/QR submit, CSRF/security headers, backup/restore drill, worker retry/dead-letter helper, dan request observability.

Gap utama terhadap PRD Modular v2.3 adalah backend belum memiliki kontrak modular lengkap. Implementasi masih memakai terminology `Tenant -> Brand -> Outlet`, entitlement masih berpusat pada plan + boolean override, package belum versioned snapshot dengan limit efektif, module installation dan integration binding belum menjadi lifecycle first-class, usage metering belum ada, inbox/consumer idempotency belum persisted, dan banyak domain R1 masih berupa component/UI contract tanpa ORM/API domain.

## 2. Gap Matrix

| Area | Status | Bukti implementasi | Gap | Checkpoint berikutnya |
|---|---|---|---|---|
| Workspace -> Business Unit -> Location | `partial` | Prisma memakai `Tenant`, `Brand`, `Outlet`; API access memakai tenant/outlet header dan workspace context presentation. | Belum ada alias/contract internal `workspace/businessUnit/location`; `workspaceType` belum ada; code baru masih mudah memperluas F&B terminology sebagai invariant Core. | Backend Delta 2.1 |
| Workspace type, template, device, employee separation | `partial` | Device mode PWA adalah local UI preference; user dan platform user sudah terpisah. | `BUSINESS/PERSONAL`, business template, core device registry, HC employee, dan employee-user relationship belum ada di ORM/API. | Backend Delta 2.1 dan HC schema checkpoint |
| Module manifest registry | `missing` | `ModuleDefinition`, `ModuleDependency`, `PlanModule`, dan `MODULES` contract tersedia. | Belum ada manifest versioned berisi capabilities, permissions, routes, navigation, settings, events, handlers, install steps, dan config schema version. | Backend Delta 2.2 |
| Module installation lifecycle | `missing` | Entitlement service dapat menentukan module enabled dari subscription/override/dependency. | Belum ada `NOT_INSTALLED/PROVISIONING/SETUP_REQUIRED/ACTIVE/ERROR/SUSPENDED`; belum ada installation config/version. | Backend Delta 2.3 |
| Integration binding lifecycle | `missing` | Outbox event foundation ada; worker retry helper ada. | Belum ada binding source event -> target handler, mapping config, status/health, effective time, blocked/dead-letter operation, audit metadata. | Backend Delta 2.4 |
| Package version snapshot | `partial` | `Plan`, `PlanModule`, `Subscription`, `TenantEntitlement` ada. | Belum ada immutable package version, package capabilities, package limits, addon, override period, effective entitlement projection berdasarkan snapshot. | Backend Delta 3.1 |
| Limit dan usage metering | `missing` | Rate limit security ada untuk login/QR submit. | Belum ada usage dimension catalog, hard/soft/throttled enforcement, usage event idempotent, counter rebuild, adjustment audit, over-limit notification. | Backend Delta 3.2 |
| Event/outbox/inbox integration proof | `partial` | `OutboxEvent` tabel ada; worker retry/dead-letter helper ada. | Belum ada event envelope versioned sesuai PRD, inbox table, consumer idempotency, POS -> KDS/Finance/Inventory proof, KDS-only/manual/API intake proof. | Backend Delta 4.1 |
| ORM schema R1 modules | `partial` | Catalog schema cukup maju; Core auth/org/access/subscription baseline ada. | Floor/Table/QR, KDS ticket, Inventory ledger, Finance Core, HC attendance append-only, Customer/report projection belum ada sebagai ORM domain. | Module schema checkpoints setelah Delta 4 |
| Security delta | `partial` | Rate limit login/QR submit, CSRF/security headers, critical audit, observability, backup/restore selesai. | Integration API rate limit, module boundary lint, disposable PostgreSQL/RLS integration test, QR token hash/rotation, support access scope/reason/expiry, PII-safe event/log guard belum lengkap. | Security Delta checkpoints |

## 3. Checkpoint Implementasi Yang Dipilih

Untuk menjaga perubahan kecil dan tidak langsung masuk migrasi besar, empat checkpoint berikut dibuat sebagai contract-first foundation:

1. **Backend Delta 2.1 - Workspace terminology contract**
   Menambahkan contract alias `Workspace`, `BusinessUnit`, `Location`, `WorkspaceType`, dan `BusinessTemplate` di `packages/contracts` tanpa mengubah tabel lama.

2. **Backend Delta 2.2 - Module manifest contract**
   Menambahkan schema manifest versioned untuk module key, capability, permission, route/navigation/settings, event produced, handler, install step, dan config schema version.

3. **Backend Delta 2.3 - Installation and integration lifecycle contract**
   Menambahkan lifecycle contract untuk module installation dan integration binding agar UI/API tidak memakai boolean `moduleEnabled`.

4. **Backend Delta 3.1 - Package limit and usage metering contract**
   Menambahkan schema package version snapshot, effective limit, hard/soft/throttled enforcement, usage event, counter, adjustment, dan error code minimum.

Event/inbox proof, ORM migration besar, dan UI reslicing sengaja tidak digabung dalam batch ini.

## 4. Verification

- Source inspected: `packages/database/prisma/schema.prisma`, `packages/contracts/src/index.ts`, `apps/api/src/entitlement/*`, API/worker/security files, and docs source-of-truth.
- No runtime code changed in this checkpoint.
- Follow-up checkpoints must still run lint/typecheck/tests according to their touched package.
