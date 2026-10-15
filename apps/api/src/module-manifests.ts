import type { ModuleManifest } from "@merchant/contracts";

import { catalogManifest } from "./kernels/catalog/public.js";
import { auditManifest } from "./core/audit/public.js";
import { subscriptionManifest } from "./core/entitlements/public.js";
import { identityManifest } from "./core/memberships/public.js";
import { tenancyManifest } from "./core/workspaces/public.js";
import { billManifest, paymentLedgerManifest } from "./kernels/billing-payment-ledger/public.js";
import { orderIntakeManifest } from "./kernels/order-intake/public.js";
import { customerManifest } from "./modules/customer/public.js";
import { floorManifest } from "./modules/floor/public.js";
import { kdsManifest } from "./modules/kds/public.js";
import { posSalesManifest } from "./modules/pos-sales/public.js";

/**
 * The manifest of every unit that exists in this API. A new module adds its
 * manifest here; nothing else needs to learn about it.
 */
export const MODULE_MANIFESTS: readonly ModuleManifest[] = [
  tenancyManifest,
  identityManifest,
  subscriptionManifest,
  auditManifest,
  catalogManifest,
  orderIntakeManifest,
  billManifest,
  paymentLedgerManifest,
  posSalesManifest,
  kdsManifest,
  floorManifest,
  customerManifest,
];
