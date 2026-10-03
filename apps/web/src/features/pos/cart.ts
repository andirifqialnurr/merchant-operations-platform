import type { CreateOrderItem, SellableMenuProduct } from "@merchant/contracts";

/**
 * The cashier's cart before it becomes an order. A line only records what was
 * chosen; names and prices are looked up in the menu for display, and the
 * server prices the order again when it is submitted.
 */
export type CartLine = {
  modifierOptionIds: readonly string[];
  note?: string;
  productId: string;
  quantity: number;
  variantId?: string;
};

export type CartLineView = {
  /** Variant and modifier names in menu order, for one compact line. */
  choices: string[];
  key: string;
  line: CartLine;
  lineTotalMinor: bigint;
  name: string;
  unitPriceMinor: bigint;
};

export const MAX_LINE_QUANTITY = 99;

/** Lines with the same product, variant, modifiers, and note are one line. */
export function lineKey(line: CartLine) {
  return [
    line.productId,
    line.variantId ?? "",
    [...line.modifierOptionIds].sort().join(","),
    line.note ?? "",
  ].join("|");
}

export function unitPrice(product: SellableMenuProduct, line: CartLine) {
  const chosen = new Set(line.modifierOptionIds);
  const variant = product.variants.find((item) => item.id === line.variantId);
  let price = BigInt(product.priceMinor) + BigInt(variant?.priceDeltaMinor ?? "0");
  for (const group of product.modifierGroups) {
    for (const option of group.options) {
      if (chosen.has(option.id)) price += BigInt(option.priceDeltaMinor);
    }
  }
  return price;
}

/** True when the line satisfies the product's variant and modifier rules. */
export function isLineComplete(product: SellableMenuProduct, line: CartLine) {
  if (product.variants.length > 0 && !product.variants.some((item) => item.id === line.variantId)) {
    return false;
  }
  const chosen = new Set(line.modifierOptionIds);
  return product.modifierGroups.every((group) => {
    const count = group.options.filter((option) => chosen.has(option.id)).length;
    return count >= group.minSelections && count <= group.maxSelections;
  });
}

export function addLine(cart: readonly CartLine[], added: CartLine): CartLine[] {
  const key = lineKey(added);
  const existing = cart.find((line) => lineKey(line) === key);
  if (!existing) return [...cart, added];
  return cart.map((line) =>
    line === existing
      ? { ...line, quantity: Math.min(line.quantity + added.quantity, MAX_LINE_QUANTITY) }
      : line,
  );
}

export function setLineQuantity(cart: readonly CartLine[], key: string, quantity: number) {
  return cart.map((line) =>
    lineKey(line) === key
      ? { ...line, quantity: Math.max(1, Math.min(quantity, MAX_LINE_QUANTITY)) }
      : line,
  );
}

/** The longest note an order line accepts. */
export const MAX_NOTE_LENGTH = 300;

/**
 * Sets or clears a line's note. A line whose note now matches another line
 * exactly is merged into it, so the cart never shows two identical lines.
 */
export function setLineNote(cart: readonly CartLine[], key: string, note: string) {
  const target = cart.find((line) => lineKey(line) === key);
  if (!target) return [...cart];
  const trimmed = note.trim().slice(0, MAX_NOTE_LENGTH);
  const updated: CartLine = {
    modifierOptionIds: target.modifierOptionIds,
    productId: target.productId,
    quantity: target.quantity,
    ...(trimmed ? { note: trimmed } : {}),
    ...(target.variantId ? { variantId: target.variantId } : {}),
  };
  const twin = cart.find((line) => line !== target && lineKey(line) === lineKey(updated));
  if (!twin) return cart.map((line) => (line === target ? updated : line));
  return cart
    .filter((line) => line !== target)
    .map((line) =>
      line === twin
        ? { ...line, quantity: Math.min(line.quantity + target.quantity, MAX_LINE_QUANTITY) }
        : line,
    );
}

export function removeLine(cart: readonly CartLine[], key: string) {
  return cart.filter((line) => lineKey(line) !== key);
}

/**
 * Resolves the cart against the current menu. Lines whose product is no longer
 * on the menu are left out, so the cart never shows something unsellable.
 */
export function viewCart(cart: readonly CartLine[], products: readonly SellableMenuProduct[]) {
  const menu = new Map(products.map((product) => [product.id, product]));
  const lines: CartLineView[] = [];
  let totalMinor = 0n;
  let itemCount = 0;
  for (const line of cart) {
    const product = menu.get(line.productId);
    if (!product || !isLineComplete(product, line)) continue;
    const chosen = new Set(line.modifierOptionIds);
    const variant = product.variants.find((item) => item.id === line.variantId);
    const unitPriceMinor = unitPrice(product, line);
    const lineTotalMinor = unitPriceMinor * BigInt(line.quantity);
    totalMinor += lineTotalMinor;
    itemCount += line.quantity;
    lines.push({
      choices: [
        ...(variant ? [variant.name] : []),
        ...product.modifierGroups.flatMap((group) =>
          group.options.filter((option) => chosen.has(option.id)).map((option) => option.name),
        ),
      ],
      key: lineKey(line),
      line,
      lineTotalMinor,
      name: product.name,
      unitPriceMinor,
    });
  }
  return { itemCount, lines, totalMinor };
}

export function toOrderItems(lines: readonly CartLineView[]): CreateOrderItem[] {
  return lines.map(({ line }) => ({
    modifierOptionIds: [...line.modifierOptionIds],
    productId: line.productId,
    quantity: line.quantity,
    ...(line.note ? { note: line.note } : {}),
    ...(line.variantId ? { variantId: line.variantId } : {}),
  }));
}
