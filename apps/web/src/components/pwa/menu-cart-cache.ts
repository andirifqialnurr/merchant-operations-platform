export const LAST_KNOWN_MENU_CACHE_KEY = "merchant-last-known-menu-v1";
export const DRAFT_CART_CACHE_KEY = "merchant-draft-cart-v1";

const CACHE_VERSION = 1;

type ProductAvailability = "available" | "sold-out" | "scheduled" | "unavailable";

export type LastKnownMenuCacheCategory = {
  count?: number;
  disabled?: boolean;
  id: string;
  label: string;
};

export type LastKnownMenuCacheProduct = {
  availability?: ProductAvailability;
  categoryId: string;
  description?: string;
  id: string;
  imageAlt?: string;
  imageUrl?: string;
  name: string;
  priceLabel: string;
};

export type LastKnownMenuCacheSnapshot = {
  activeCategoryId: string;
  categories: readonly LastKnownMenuCacheCategory[];
  merchantName: string;
  outletName?: string;
  products: readonly LastKnownMenuCacheProduct[];
  sourceLabel?: string;
  tableLabel?: string;
  title?: string;
};

export type DraftCartCacheItem = {
  disabled?: boolean;
  id: string;
  lineTotalLabel: string;
  maxQuantity?: number;
  modifiers?: readonly string[];
  name: string;
  noteLabel?: string;
  quantity: number;
  unitPriceLabel: string;
};

export type DraftCartCacheSnapshot = {
  cartItems: readonly DraftCartCacheItem[];
  serviceChargeLabel?: string;
  subtotalLabel: string;
  taxLabel?: string;
  totalLabel: string;
};

type StoredCache<T> = {
  snapshot: T;
  version: typeof CACHE_VERSION;
};

const menuSnapshotKeys = new Set([
  "activeCategoryId",
  "categories",
  "merchantName",
  "outletName",
  "products",
  "sourceLabel",
  "tableLabel",
  "title",
]);
const menuCategoryKeys = new Set(["count", "disabled", "id", "label"]);
const menuProductKeys = new Set([
  "availability",
  "categoryId",
  "description",
  "id",
  "imageAlt",
  "imageUrl",
  "name",
  "priceLabel",
]);
const draftSnapshotKeys = new Set([
  "cartItems",
  "serviceChargeLabel",
  "subtotalLabel",
  "taxLabel",
  "totalLabel",
]);
const draftItemKeys = new Set([
  "disabled",
  "id",
  "lineTotalLabel",
  "maxQuantity",
  "modifiers",
  "name",
  "noteLabel",
  "quantity",
  "unitPriceLabel",
]);

const sensitiveCacheKeyPattern =
  /(?:payment|paid|stock|inventory|orderId|orderInternalId|customer|session|tenantId|outletId|phone|telepon|email|address|alamat|birth|dob|identity|nik|ktp|passport|token|payload|permission|internalId|ledger|journal|audit|actor|timestamp|createdAt|updatedAt|raw|webhook|attachment|hpp|cogs|cost|profit|margin|sku|barcode)/i;

const allowedAvailability = new Set<ProductAvailability>([
  "available",
  "sold-out",
  "scheduled",
  "unavailable",
]);

function resolveStorage(storage?: Storage) {
  if (storage) return storage;
  if (typeof window === "undefined") return null;
  return window.localStorage;
}

function assertPlainObject(value: unknown, path: string): asserts value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${path} harus berupa object cache.`);
  }
}

function assertAllowedKeys(
  value: Record<string, unknown>,
  allowedKeys: ReadonlySet<string>,
  path: string,
) {
  for (const key of Object.keys(value)) {
    if (!allowedKeys.has(key) || sensitiveCacheKeyPattern.test(key)) {
      throw new TypeError(`${path} tidak boleh menerima data sensitif/out-of-scope: ${key}.`);
    }
  }
}

function assertText(value: unknown, path: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new TypeError(`${path} harus berisi teks.`);
  }
  return value;
}

function optionalText(value: unknown, path: string): string {
  return assertText(value, path);
}

function optionalBoolean(value: unknown, path: string): boolean {
  if (typeof value !== "boolean") throw new TypeError(`${path} harus boolean bila dikirim.`);
  return value;
}

function assertCount(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new RangeError(`${path} harus integer nol atau lebih.`);
  }
  return value;
}

function assertPositiveInteger(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    throw new RangeError(`${path} harus integer positif bila dikirim.`);
  }
  return value;
}

function assertUniqueIds(items: readonly { id: string }[], path: string) {
  const seen = new Set<string>();

  for (const item of items) {
    if (seen.has(item.id)) throw new TypeError(`${path} tidak boleh memiliki id duplikat.`);
    seen.add(item.id);
  }
}

function normalizeMenuCategory(value: unknown, index: number): LastKnownMenuCacheCategory {
  const path = `Last-known menu categories[${index}]`;
  assertPlainObject(value, path);
  assertAllowedKeys(value, menuCategoryKeys, path);

  const category: LastKnownMenuCacheCategory = {
    id: assertText(value.id, `${path}.id`),
    label: assertText(value.label, `${path}.label`),
  };

  if (value.count !== undefined) category.count = assertCount(value.count, `${path}.count`);
  if (value.disabled !== undefined) {
    category.disabled = optionalBoolean(value.disabled, `${path}.disabled`);
  }

  return category;
}

function normalizeMenuProduct(value: unknown, index: number): LastKnownMenuCacheProduct {
  const path = `Last-known menu products[${index}]`;
  assertPlainObject(value, path);
  assertAllowedKeys(value, menuProductKeys, path);

  const availability = value.availability;
  if (availability !== undefined && !allowedAvailability.has(availability as ProductAvailability)) {
    throw new TypeError(`${path}.availability tidak dikenal.`);
  }

  const product: LastKnownMenuCacheProduct = {
    categoryId: assertText(value.categoryId, `${path}.categoryId`),
    id: assertText(value.id, `${path}.id`),
    name: assertText(value.name, `${path}.name`),
    priceLabel: assertText(value.priceLabel, `${path}.priceLabel`),
  };

  if (availability !== undefined) product.availability = availability as ProductAvailability;
  if (value.description !== undefined) {
    product.description = optionalText(value.description, `${path}.description`);
  }
  if (value.imageAlt !== undefined) {
    product.imageAlt = optionalText(value.imageAlt, `${path}.imageAlt`);
  }
  if (value.imageUrl !== undefined) {
    product.imageUrl = optionalText(value.imageUrl, `${path}.imageUrl`);
  }

  return product;
}

function normalizeLastKnownMenuSnapshot(value: unknown): LastKnownMenuCacheSnapshot {
  const path = "Last-known menu cache";
  assertPlainObject(value, path);
  assertAllowedKeys(value, menuSnapshotKeys, path);

  if (!Array.isArray(value.categories)) throw new TypeError(`${path}.categories harus array.`);
  if (!Array.isArray(value.products)) throw new TypeError(`${path}.products harus array.`);

  const categories = value.categories.map(normalizeMenuCategory);
  const products = value.products.map(normalizeMenuProduct);

  assertUniqueIds(categories, `${path}.categories`);
  assertUniqueIds(products, `${path}.products`);

  const snapshot: LastKnownMenuCacheSnapshot = {
    activeCategoryId: assertText(value.activeCategoryId, `${path}.activeCategoryId`),
    categories,
    merchantName: assertText(value.merchantName, `${path}.merchantName`),
    products,
  };

  if (value.outletName !== undefined) {
    snapshot.outletName = optionalText(value.outletName, `${path}.outletName`);
  }
  if (value.sourceLabel !== undefined) {
    snapshot.sourceLabel = optionalText(value.sourceLabel, `${path}.sourceLabel`);
  }
  if (value.tableLabel !== undefined) {
    snapshot.tableLabel = optionalText(value.tableLabel, `${path}.tableLabel`);
  }
  if (value.title !== undefined) snapshot.title = optionalText(value.title, `${path}.title`);

  return snapshot;
}

function normalizeDraftCartItem(value: unknown, index: number): DraftCartCacheItem {
  const path = `Draft cart items[${index}]`;
  assertPlainObject(value, path);
  assertAllowedKeys(value, draftItemKeys, path);

  if (
    typeof value.quantity !== "number" ||
    !Number.isInteger(value.quantity) ||
    value.quantity < 1
  ) {
    throw new RangeError(`${path}.quantity harus integer positif.`);
  }
  if (value.modifiers !== undefined && !Array.isArray(value.modifiers)) {
    throw new TypeError(`${path}.modifiers harus array bila dikirim.`);
  }

  const item: DraftCartCacheItem = {
    id: assertText(value.id, `${path}.id`),
    lineTotalLabel: assertText(value.lineTotalLabel, `${path}.lineTotalLabel`),
    name: assertText(value.name, `${path}.name`),
    quantity: value.quantity,
    unitPriceLabel: assertText(value.unitPriceLabel, `${path}.unitPriceLabel`),
  };

  if (value.disabled !== undefined) {
    item.disabled = optionalBoolean(value.disabled, `${path}.disabled`);
  }
  if (value.maxQuantity !== undefined) {
    item.maxQuantity = assertPositiveInteger(value.maxQuantity, `${path}.maxQuantity`);
  }
  if (value.modifiers !== undefined) {
    item.modifiers = value.modifiers.map((modifier, itemIndex) =>
      assertText(modifier, `${path}.modifiers[${itemIndex}]`),
    );
  }
  if (value.noteLabel !== undefined) {
    item.noteLabel = optionalText(value.noteLabel, `${path}.noteLabel`);
  }

  return item;
}

function normalizeDraftCartSnapshot(value: unknown): DraftCartCacheSnapshot {
  const path = "Draft cart cache";
  assertPlainObject(value, path);
  assertAllowedKeys(value, draftSnapshotKeys, path);

  if (!Array.isArray(value.cartItems)) throw new TypeError(`${path}.cartItems harus array.`);

  const cartItems = value.cartItems.map(normalizeDraftCartItem);
  assertUniqueIds(cartItems, `${path}.cartItems`);

  const snapshot: DraftCartCacheSnapshot = {
    cartItems,
    subtotalLabel: assertText(value.subtotalLabel, `${path}.subtotalLabel`),
    totalLabel: assertText(value.totalLabel, `${path}.totalLabel`),
  };

  if (value.serviceChargeLabel !== undefined) {
    snapshot.serviceChargeLabel = optionalText(
      value.serviceChargeLabel,
      `${path}.serviceChargeLabel`,
    );
  }
  if (value.taxLabel !== undefined)
    snapshot.taxLabel = optionalText(value.taxLabel, `${path}.taxLabel`);

  return snapshot;
}

function readCache<T>(
  storage: Storage | undefined,
  key: string,
  normalize: (value: unknown) => T,
): T | null {
  const target = resolveStorage(storage);
  if (!target) return null;

  try {
    const raw = target.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredCache<unknown>>;
    if (parsed.version !== CACHE_VERSION) return null;
    return normalize(parsed.snapshot);
  } catch {
    return null;
  }
}

function saveCache<T>(
  storage: Storage | undefined,
  key: string,
  snapshot: unknown,
  normalize: (value: unknown) => T,
) {
  const target = resolveStorage(storage);
  if (!target) return false;

  const normalized = normalize(snapshot);

  try {
    target.setItem(key, JSON.stringify({ snapshot: normalized, version: CACHE_VERSION }));
    return true;
  } catch {
    return false;
  }
}

export function saveLastKnownMenuCache(snapshot: LastKnownMenuCacheSnapshot, storage?: Storage) {
  return saveCache(storage, LAST_KNOWN_MENU_CACHE_KEY, snapshot, normalizeLastKnownMenuSnapshot);
}

export function readLastKnownMenuCache(storage?: Storage) {
  return readCache(storage, LAST_KNOWN_MENU_CACHE_KEY, normalizeLastKnownMenuSnapshot);
}

export function saveDraftCartCache(snapshot: DraftCartCacheSnapshot, storage?: Storage) {
  return saveCache(storage, DRAFT_CART_CACHE_KEY, snapshot, normalizeDraftCartSnapshot);
}

export function readDraftCartCache(storage?: Storage) {
  return readCache(storage, DRAFT_CART_CACHE_KEY, normalizeDraftCartSnapshot);
}

export function clearMenuCartCache(storage?: Storage) {
  const target = resolveStorage(storage);
  if (!target) return false;

  try {
    target.removeItem(LAST_KNOWN_MENU_CACHE_KEY);
    target.removeItem(DRAFT_CART_CACHE_KEY);
    return true;
  } catch {
    return false;
  }
}
