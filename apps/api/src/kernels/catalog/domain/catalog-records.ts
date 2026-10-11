import type {
  CatalogRecordStatus,
  ModifierSelectionType,
  OrganizationUnitStatus,
  ProductAvailability,
} from "@merchant/contracts";
import { type CommandOrigin } from "../../../shared/command/command-origin.js";

/* What the catalog stores, as the application sees it: plain values, no ORM types. */

export type CatalogMutationContext = CommandOrigin;

type RecordTimestamps = { createdAt: Date; updatedAt: Date };

export type CatalogTenantRecord = {
  currency: string;
  id: string;
  status: OrganizationUnitStatus;
};

export type CatalogOutletRecord = {
  id: string;
  status: OrganizationUnitStatus;
  tenantId: string;
};

export type CatalogCategoryRecord = RecordTimestamps & {
  displayOrder: number;
  id: string;
  name: string;
  slug: string;
  status: CatalogRecordStatus;
  tenantId: string;
};

export type CatalogProductRecord = RecordTimestamps & {
  availability: ProductAvailability;
  basePriceMinor: string;
  categoryId: string;
  currency: string;
  description: string | null;
  id: string;
  name: string;
  slug: string;
  status: CatalogRecordStatus;
  tenantId: string;
};

export type CatalogProductVariantRecord = RecordTimestamps & {
  availability: ProductAvailability;
  displayOrder: number;
  id: string;
  name: string;
  priceDeltaMinor: string;
  productId: string;
  status: CatalogRecordStatus;
  tenantId: string;
};

export type CatalogModifierGroupRecord = RecordTimestamps & {
  displayOrder: number;
  id: string;
  maxSelections: number;
  minSelections: number;
  name: string;
  selectionType: ModifierSelectionType;
  status: CatalogRecordStatus;
  tenantId: string;
};

export type CatalogModifierOptionRecord = RecordTimestamps & {
  availability: ProductAvailability;
  displayOrder: number;
  groupId: string;
  id: string;
  name: string;
  priceDeltaMinor: string;
  status: CatalogRecordStatus;
  tenantId: string;
};

export type CatalogProductModifierGroupRecord = RecordTimestamps & {
  displayOrder: number;
  id: string;
  modifierGroupId: string;
  productId: string;
  status: CatalogRecordStatus;
  tenantId: string;
};

export type CatalogProductImageRecord = RecordTimestamps & {
  altText: string | null;
  contentType: "image/avif" | "image/jpeg" | "image/png" | "image/webp";
  displayOrder: number;
  height: number | null;
  id: string;
  isPrimary: boolean;
  objectKey: string;
  productId: string;
  status: CatalogRecordStatus;
  tenantId: string;
  width: number | null;
};

export type CatalogOutletProductRecord = RecordTimestamps & {
  availabilityOverride: ProductAvailability | null;
  displayOrder: number;
  id: string;
  outletId: string;
  priceOverrideMinor: string | null;
  productId: string;
  status: CatalogRecordStatus;
  tenantId: string;
};

export type CatalogSnapshotRecord = {
  categories: CatalogCategoryRecord[];
  modifierGroups: CatalogModifierGroupRecord[];
  modifierOptions: CatalogModifierOptionRecord[];
  outletProducts: CatalogOutletProductRecord[];
  productImages: CatalogProductImageRecord[];
  productModifierGroups: CatalogProductModifierGroupRecord[];
  productVariants: CatalogProductVariantRecord[];
  products: CatalogProductRecord[];
};
