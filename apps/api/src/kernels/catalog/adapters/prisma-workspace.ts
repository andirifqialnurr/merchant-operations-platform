import { getPrismaClient } from "@merchant/database";
import {
  categorySelect,
  productSelect,
  productVariantSelect,
  modifierGroupSelect,
  modifierOptionSelect,
  productModifierGroupSelect,
  productImageSelect,
  outletProductSelect,
  mapProduct,
  mapProductVariant,
  mapModifierOption,
  mapProductImage,
  mapOutletProduct,
} from "./prisma-catalog-shared.js";

export async function findTenant(tenantId: string) {
  return getPrismaClient().tenant.findUnique({
    select: { currency: true, id: true, status: true },
    where: { id: tenantId },
  });
}

export async function getSnapshot(tenantId: string) {
  const tenant = await getPrismaClient().tenant.findUnique({
    select: {
      id: true,
      catalogCategories: {
        orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
        select: categorySelect,
      },
      catalogProducts: {
        orderBy: [{ categoryId: "asc" }, { name: "asc" }],
        select: productSelect,
      },
      catalogProductVariants: {
        orderBy: [{ productId: "asc" }, { displayOrder: "asc" }, { name: "asc" }],
        select: productVariantSelect,
      },
      catalogModifierGroups: {
        orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
        select: modifierGroupSelect,
      },
      catalogModifierOptions: {
        orderBy: [{ groupId: "asc" }, { displayOrder: "asc" }, { name: "asc" }],
        select: modifierOptionSelect,
      },
      catalogProductModifierGroups: {
        orderBy: [{ productId: "asc" }, { displayOrder: "asc" }],
        select: productModifierGroupSelect,
      },
      catalogProductImages: {
        orderBy: [{ productId: "asc" }, { displayOrder: "asc" }],
        select: productImageSelect,
      },
      catalogOutletProducts: {
        orderBy: [{ outletId: "asc" }, { displayOrder: "asc" }],
        select: outletProductSelect,
      },
    },
    where: { id: tenantId },
  });
  return tenant
    ? {
        categories: tenant.catalogCategories,
        modifierGroups: tenant.catalogModifierGroups,
        modifierOptions: tenant.catalogModifierOptions.map(mapModifierOption),
        outletProducts: tenant.catalogOutletProducts.map(mapOutletProduct),
        productImages: tenant.catalogProductImages.map(mapProductImage),
        productModifierGroups: tenant.catalogProductModifierGroups,
        productVariants: tenant.catalogProductVariants.map(mapProductVariant),
        products: tenant.catalogProducts.map(mapProduct),
      }
    : null;
}
