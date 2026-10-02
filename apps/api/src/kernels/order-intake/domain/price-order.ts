/**
 * Prices the lines of a new order against the outlet's sellable menu. Pure:
 * the client only names products, variants, and options; every name and
 * price in the result is taken from the menu.
 */

export type MenuOption = { id: string; name: string; priceDeltaMinor: string };
export type MenuProduct = {
  currency: string;
  id: string;
  modifierGroups: readonly {
    maxSelections: number;
    minSelections: number;
    name: string;
    options: readonly MenuOption[];
  }[];
  name: string;
  priceMinor: string;
  variants: readonly MenuOption[];
};

export type RequestedLine = {
  modifierOptionIds: readonly string[];
  note?: string | undefined;
  productId: string;
  quantity: number;
  variantId?: string | undefined;
};

export type PricedLine = {
  lineTotalMinor: bigint;
  modifiers: { groupName: string; optionName: string; priceDeltaMinor: bigint }[];
  name: string;
  note: string | null;
  productId: string;
  quantity: number;
  unitPriceMinor: bigint;
  variantName: string | null;
};

export type PricingFailure =
  | "ORDER_CURRENCY_MIXED"
  | "ORDER_MODIFIER_INVALID"
  | "ORDER_MODIFIER_SELECTION_INVALID"
  | "ORDER_PRODUCT_UNAVAILABLE"
  | "ORDER_VARIANT_INVALID";

export type PricingResult =
  | { currency: string; lines: PricedLine[]; ok: true; subtotalMinor: bigint }
  | { code: PricingFailure; lineIndex: number; ok: false };

export function priceOrderLines(
  products: readonly MenuProduct[],
  requested: readonly RequestedLine[],
): PricingResult {
  const menu = new Map(products.map((product) => [product.id, product]));
  const lines: PricedLine[] = [];
  let currency: string | undefined;
  let subtotalMinor = 0n;

  for (const [lineIndex, line] of requested.entries()) {
    const fail = (code: PricingFailure): PricingResult => ({ code, lineIndex, ok: false });

    const product = menu.get(line.productId);
    if (!product) return fail("ORDER_PRODUCT_UNAVAILABLE");
    currency ??= product.currency;
    if (product.currency !== currency) return fail("ORDER_CURRENCY_MIXED");

    // A product sold by variant needs exactly one; any other product takes none.
    const variant = product.variants.find((item) => item.id === line.variantId);
    if ((product.variants.length > 0 || line.variantId !== undefined) && !variant) {
      return fail("ORDER_VARIANT_INVALID");
    }

    const chosen = new Set(line.modifierOptionIds);
    if (chosen.size !== line.modifierOptionIds.length) return fail("ORDER_MODIFIER_INVALID");

    let unitPriceMinor = BigInt(product.priceMinor) + BigInt(variant?.priceDeltaMinor ?? "0");
    const modifiers: PricedLine["modifiers"] = [];
    let matched = 0;
    for (const group of product.modifierGroups) {
      const picked = group.options.filter((option) => chosen.has(option.id));
      if (picked.length < group.minSelections || picked.length > group.maxSelections) {
        return fail("ORDER_MODIFIER_SELECTION_INVALID");
      }
      matched += picked.length;
      for (const option of picked) {
        const priceDeltaMinor = BigInt(option.priceDeltaMinor);
        unitPriceMinor += priceDeltaMinor;
        modifiers.push({ groupName: group.name, optionName: option.name, priceDeltaMinor });
      }
    }
    // Every chosen option must belong to one of the product's groups.
    if (matched !== chosen.size) return fail("ORDER_MODIFIER_INVALID");

    const lineTotalMinor = unitPriceMinor * BigInt(line.quantity);
    subtotalMinor += lineTotalMinor;
    lines.push({
      lineTotalMinor,
      modifiers,
      name: product.name,
      note: line.note ?? null,
      productId: product.id,
      quantity: line.quantity,
      unitPriceMinor,
      variantName: variant?.name ?? null,
    });
  }

  if (currency === undefined) return { code: "ORDER_PRODUCT_UNAVAILABLE", lineIndex: 0, ok: false };
  return { currency, lines, ok: true, subtotalMinor };
}
