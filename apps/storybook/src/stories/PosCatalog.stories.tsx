import type { Meta, StoryObj } from "@storybook/react-vite";

import { CategoryRail, ProductTile } from "@merchant/ui/pos-catalog";

import { storyContractParameters } from "./story-contract";

const categories = [
  { count: 24, id: "all", label: "Semua" },
  { count: 8, id: "coffee", label: "Kopi" },
  { count: 6, id: "non-coffee", label: "Non-kopi" },
  { count: 5, id: "food", label: "Makanan" },
  { count: 5, id: "dessert", label: "Dessert" },
] as const;

const meta = {
  title: "Domain/POS/Product catalog",
  component: ProductTile,
  parameters: {
    ...storyContractParameters,
    layout: "padded",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof ProductTile>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ProductVariants: Story = {
  args: {
    name: "Es kopi susu gula aren",
    priceLabel: "Rp24.000",
  },
  render: () => (
    <div className="story-pos-product-grid">
      <ProductTile name="Espresso" priceLabel="Rp18.000" size="sm" variant="compact" />
      <ProductTile name="Americano dingin" priceLabel="Rp22.000" variant="default" />
      <ProductTile name="Es kopi susu gula aren" priceLabel="Rp24.000" size="lg" variant="touch" />
      <ProductTile
        description="Espresso, susu segar, dan gula aren pilihan."
        name="Kopi susu signature kedai"
        priceLabel="Rp28.000"
        variant="customer"
      />
    </div>
  ),
};

export const ProductStates: Story = {
  args: {
    name: "Es kopi susu gula aren",
    priceLabel: "Rp24.000",
  },
  render: () => (
    <div className="story-pos-product-grid">
      <ProductTile name="Cappuccino" priceLabel="Rp26.000" />
      <ProductTile name="Kopi susu baru ditambahkan" priceLabel="Rp24.000" selected />
      <ProductTile lowStockLabel="Sisa 3" name="Croissant almond" priceLabel="Rp30.000" />
      <ProductTile availability="sold-out" name="Banana bread" priceLabel="Rp22.000" />
      <ProductTile
        availability="unavailable"
        name="Paket makan siang"
        priceLabel="Rp45.000"
        unavailableLabel="Tersedia pukul 11.00"
      />
      <ProductTile imageLoading name="Memuat foto produk" priceLabel="Rp25.000" />
      <ProductTile name="Foto produk gagal dimuat" priceLabel="Rp25.000" />
      <ProductTile
        name="Nama produk sangat panjang hingga perlu dipotong secara aman dalam maksimal dua baris"
        priceLabel="Rp1.250.000"
      />
    </div>
  ),
};

export const CategoryVariants: Story = {
  args: {
    name: "Es kopi susu gula aren",
    priceLabel: "Rp24.000",
  },
  render: () => (
    <div className="story-pos-category-comparison">
      <section>
        <h2 className="text-heading-sm">POS desktop</h2>
        <CategoryRail activeId="coffee" categories={categories} onSelect={() => undefined} />
      </section>
      <section>
        <h2 className="text-heading-sm">Customer dan mobile</h2>
        <CategoryRail
          activeId="coffee"
          categories={categories}
          onSelect={() => undefined}
          orientation="horizontal"
        />
      </section>
    </div>
  ),
};

export const ThemeComparison: Story = {
  args: {
    name: "Es kopi susu gula aren",
    priceLabel: "Rp24.000",
  },
  render: () => (
    <div className="story-contract-theme-comparison">
      <section data-theme-preview="light">
        <h2 className="text-heading-sm">Light</h2>
        <ProductTile name="Es kopi susu" priceLabel="Rp24.000" selected />
        <CategoryRail
          activeId="coffee"
          categories={categories.slice(0, 3)}
          onSelect={() => undefined}
          orientation="horizontal"
        />
      </section>
      <section data-theme-preview="dark">
        <h2 className="text-heading-sm">Dark</h2>
        <ProductTile name="Es kopi susu" priceLabel="Rp24.000" selected />
        <CategoryRail
          activeId="coffee"
          categories={categories.slice(0, 3)}
          onSelect={() => undefined}
          orientation="horizontal"
        />
      </section>
    </div>
  ),
};
