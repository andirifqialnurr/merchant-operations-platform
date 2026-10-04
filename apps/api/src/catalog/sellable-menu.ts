import type { SellableMenu, SellableMenuModifierGroup } from "@merchant/contracts";

import type { CatalogSnapshotRecord } from "./catalog.repository.js";

type Ordered = { displayOrder: number; name: string };

function byDisplayOrder(left: Ordered, right: Ordered) {
  return left.displayOrder - right.displayOrder || left.name.localeCompare(right.name);
}

function isOffered(record: { availability: string; status: string }) {
  return record.status === "ACTIVE" && record.availability === "AVAILABLE";
}

/**
 * Builds what one outlet can sell from the tenant catalog. Pure: the caller
 * decides whether the tenant and outlet are open for selling at all.
 *
 * A product is left out when it is not assigned, inactive, sold out, in an
 * inactive category, or when a required modifier group cannot be satisfied.
 */
export function buildSellableMenu(snapshot: CatalogSnapshotRecord, outletId: string): SellableMenu {
  const categories = new Map(
    snapshot.categories
      .filter((category) => category.status === "ACTIVE")
      .map((category) => [category.id, category]),
  );
  const products = new Map(snapshot.products.map((product) => [product.id, product]));
  const groups = new Map(
    snapshot.modifierGroups
      .filter((group) => group.status === "ACTIVE")
      .map((group) => [group.id, group]),
  );

  // One picture per product: the active one marked as primary.
  const mainImages = new Map(
    snapshot.productImages
      .filter((image) => image.status === "ACTIVE" && image.isPrimary)
      .map((image) => [image.productId, image.id]),
  );

  const menuProducts = snapshot.outletProducts
    .filter((assignment) => assignment.outletId === outletId && assignment.status === "ACTIVE")
    .flatMap((assignment) => {
      const product = products.get(assignment.productId);
      if (!product || product.status !== "ACTIVE" || !categories.has(product.categoryId)) return [];
      if ((assignment.availabilityOverride ?? product.availability) !== "AVAILABLE") return [];

      const definedVariants = snapshot.productVariants.filter(
        (variant) => variant.productId === product.id && variant.status === "ACTIVE",
      );
      const variants = definedVariants.filter(isOffered).sort(byDisplayOrder);
      // A product sold by variant cannot be sold while every variant is sold out.
      if (definedVariants.length > 0 && variants.length === 0) return [];

      const modifierGroups: SellableMenuModifierGroup[] = [];
      const assignments = snapshot.productModifierGroups
        .filter((link) => link.productId === product.id && link.status === "ACTIVE")
        .sort((left, right) => left.displayOrder - right.displayOrder);
      for (const link of assignments) {
        const group = groups.get(link.modifierGroupId);
        if (!group) continue;
        const options = snapshot.modifierOptions
          .filter((option) => option.groupId === group.id && isOffered(option))
          .sort(byDisplayOrder);
        if (options.length < group.minSelections) return [];
        if (options.length === 0) continue;
        modifierGroups.push({
          id: group.id,
          maxSelections: Math.min(group.maxSelections, options.length),
          minSelections: group.minSelections,
          name: group.name,
          options: options.map((option) => ({
            id: option.id,
            name: option.name,
            priceDeltaMinor: option.priceDeltaMinor,
          })),
          selectionType: group.selectionType,
        });
      }

      return [
        {
          displayOrder: assignment.displayOrder,
          item: {
            categoryId: product.categoryId,
            currency: product.currency,
            id: product.id,
            imageId: mainImages.get(product.id) ?? null,
            modifierGroups,
            name: product.name,
            priceMinor: assignment.priceOverrideMinor ?? product.basePriceMinor,
            variants: variants.map((variant) => ({
              id: variant.id,
              name: variant.name,
              priceDeltaMinor: variant.priceDeltaMinor,
            })),
          },
          name: product.name,
        },
      ];
    })
    .sort(byDisplayOrder)
    .map((entry) => entry.item);

  const usedCategories = new Set(menuProducts.map((product) => product.categoryId));
  return {
    categories: [...categories.values()]
      .filter((category) => usedCategories.has(category.id))
      .sort(byDisplayOrder)
      .map((category) => ({ id: category.id, name: category.name })),
    outletId,
    products: menuProducts,
  };
}
