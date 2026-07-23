import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";

import { type ModifierGroup, ProductModifierPicker } from "@merchant/ui/pos-modifier";
import { Button } from "@merchant/ui/button";

import { storyContractParameters } from "./story-contract";

const groups: readonly ModifierGroup[] = [
  {
    id: "size",
    label: "Ukuran",
    minSelections: 1,
    mode: "single",
    options: [
      { id: "regular", label: "Regular" },
      { id: "large", label: "Large", priceLabel: "+Rp5.000" },
    ],
  },
  {
    id: "sugar",
    label: "Tingkat gula",
    minSelections: 1,
    mode: "single",
    options: [
      { id: "normal", label: "Normal" },
      { id: "less", label: "Lebih sedikit" },
      { id: "none", label: "Tanpa gula" },
    ],
  },
  {
    id: "extras",
    label: "Tambahan",
    maxSelections: 2,
    mode: "multiple",
    options: [
      { id: "shot", label: "Extra espresso shot", priceLabel: "+Rp6.000" },
      { id: "jelly", label: "Coffee jelly", priceLabel: "+Rp4.000" },
      { id: "cream", label: "Whipped cream", priceLabel: "+Rp5.000" },
      {
        disabled: true,
        id: "oat",
        label: "Oat milk yang namanya cukup panjang untuk menguji reflow",
        priceLabel: "+Rp8.000",
        unavailableLabel: "Sedang habis",
      },
    ],
  },
];

function PickerLauncher({ edit = false, initiallyOpen = false }) {
  const [open, setOpen] = useState(initiallyOpen);

  return (
    <>
      <Button onClick={() => setOpen(true)}>{edit ? "Ubah pesanan" : "Pilih modifier"}</Button>
      <ProductModifierPicker
        defaultQuantity={edit ? 2 : 1}
        groups={groups}
        onOpenChange={setOpen}
        onSubmit={() => setOpen(false)}
        open={open}
        productDescription="Espresso, susu segar, dan gula aren pilihan dengan nama produk panjang yang tetap mudah dibaca."
        productName="Es kopi susu gula aren signature"
        productPriceLabel="Rp24.000"
        submitLabel={edit ? "Perbarui pesanan" : "Tambahkan ke keranjang"}
        submitTotalLabel={edit ? "Rp70.000" : "Rp24.000"}
        {...(edit
          ? {
              defaultNote: "Es sedikit",
              defaultSelections: { extras: ["shot"], size: ["large"], sugar: ["less"] },
            }
          : {})}
      />
    </>
  );
}

const meta = {
  title: "Domain/POS/Modifier picker",
  component: ProductModifierPicker,
  parameters: {
    ...storyContractParameters,
    layout: "padded",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof ProductModifierPicker>;

export default meta;
type Story = StoryObj<typeof meta>;

export const RequiredAndOptionalGroups: Story = {
  args: {
    groups,
    onOpenChange: () => undefined,
    onSubmit: () => undefined,
    open: false,
    productName: "Es kopi susu gula aren signature",
    productPriceLabel: "Rp24.000",
  },
  render: () => <PickerLauncher initiallyOpen />,
};

export const UpdateCartItem: Story = {
  args: {
    groups,
    onOpenChange: () => undefined,
    onSubmit: () => undefined,
    open: false,
    productName: "Es kopi susu gula aren signature",
    productPriceLabel: "Rp24.000",
  },
  render: () => <PickerLauncher edit initiallyOpen />,
};

export const MobileSheet: Story = {
  args: {
    groups,
    onOpenChange: () => undefined,
    onSubmit: () => undefined,
    open: false,
    productName: "Es kopi susu gula aren signature",
    productPriceLabel: "Rp24.000",
  },
  parameters: {
    viewport: { defaultViewport: "mobile" },
  },
  render: () => <PickerLauncher initiallyOpen />,
};
