import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";

import {
  DRAFT_CART_CACHE_KEY,
  LAST_KNOWN_MENU_CACHE_KEY,
  clearMenuCartCache,
  readDraftCartCache,
  readLastKnownMenuCache,
  saveDraftCartCache,
  saveLastKnownMenuCache,
  type DraftCartCacheSnapshot,
  type LastKnownMenuCacheSnapshot,
} from "./menu-cart-cache";

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length() {
    return this.values.size;
  }

  clear() {
    this.values.clear();
  }

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  key(index: number) {
    return Array.from(this.values.keys())[index] ?? null;
  }

  removeItem(key: string) {
    this.values.delete(key);
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

let storage: MemoryStorage;

const menuSnapshot: LastKnownMenuCacheSnapshot = {
  activeCategoryId: "coffee",
  categories: [
    { count: 2, id: "coffee", label: "Kopi" },
    { count: 1, id: "food", label: "Makanan" },
  ],
  merchantName: "Kopi Senja",
  outletName: "Cabang Meruya",
  products: [
    {
      availability: "available",
      categoryId: "coffee",
      description: "Espresso dan susu segar.",
      id: "product-safe-01",
      name: "Kopi susu signature",
      priceLabel: "Rp28.000",
    },
    {
      availability: "sold-out",
      categoryId: "food",
      id: "product-safe-02",
      name: "Croissant",
      priceLabel: "Rp24.000",
    },
  ],
  sourceLabel: "Menu terakhir",
};

const draftSnapshot: DraftCartCacheSnapshot = {
  cartItems: [
    {
      id: "cart-safe-01",
      lineTotalLabel: "Rp56.000",
      modifiers: ["Oat milk", "Less ice"],
      name: "Kopi susu signature",
      quantity: 2,
      unitPriceLabel: "Rp28.000",
    },
  ],
  subtotalLabel: "Rp56.000",
  totalLabel: "Rp56.000",
};

beforeEach(() => {
  storage = new MemoryStorage();
});

test("stores and restores last-known menu and draft cart display data", () => {
  assert.equal(saveLastKnownMenuCache(menuSnapshot, storage), true);
  assert.equal(saveDraftCartCache(draftSnapshot, storage), true);

  assert.deepEqual(readLastKnownMenuCache(storage), menuSnapshot);
  assert.deepEqual(readDraftCartCache(storage), draftSnapshot);
});

test("rejects payment, stock, token, audit, and backend payload fields before writing", () => {
  assert.throws(
    () =>
      saveLastKnownMenuCache(
        {
          ...menuSnapshot,
          products: [{ ...menuSnapshot.products[0], stockQuantity: 12 }],
        } as unknown as LastKnownMenuCacheSnapshot,
        storage,
      ),
    /stockQuantity/,
  );
  assert.equal(storage.getItem(LAST_KNOWN_MENU_CACHE_KEY), null);

  assert.throws(
    () =>
      saveDraftCartCache(
        {
          ...draftSnapshot,
          paymentPayload: { token: "secret" },
        } as DraftCartCacheSnapshot,
        storage,
      ),
    /paymentPayload/,
  );
  assert.equal(storage.getItem(DRAFT_CART_CACHE_KEY), null);
});

test("treats invalid cache contents as unavailable and keeps clear scoped to menu and draft cart", () => {
  storage.setItem(LAST_KNOWN_MENU_CACHE_KEY, "{invalid-json");
  storage.setItem(DRAFT_CART_CACHE_KEY, JSON.stringify({ version: 1, snapshot: { token: "x" } }));
  storage.setItem("merchant-device-mode-v1", "POS");

  assert.equal(readLastKnownMenuCache(storage), null);
  assert.equal(readDraftCartCache(storage), null);

  clearMenuCartCache(storage);

  assert.equal(storage.getItem(LAST_KNOWN_MENU_CACHE_KEY), null);
  assert.equal(storage.getItem(DRAFT_CART_CACHE_KEY), null);
  assert.equal(storage.getItem("merchant-device-mode-v1"), "POS");
});
