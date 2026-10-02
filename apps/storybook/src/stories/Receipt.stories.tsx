import type { Meta, StoryObj } from "@storybook/react-vite";

import { Receipt } from "@merchant/ui/receipt";

import { storyContractParameters } from "./story-contract";

const meta = {
  title: "Domain/POS/Receipt",
  component: Receipt,
  parameters: {
    ...storyContractParameters,
    layout: "padded",
  },
  tags: ["autodocs"],
  args: {
    ariaLabel: "Struk",
    footer: "Terima kasih",
    lines: [
      { amount: "Rp40.000", key: "1", name: "Kentang Goreng", quantity: "2×" },
      {
        amount: "Rp82.000",
        detail: "Dingin · Large · Extra shot espresso",
        key: "2",
        name: "Caffe Latte",
        quantity: "2×",
      },
    ],
    meta: [
      { label: "No. penjualan", value: "#12" },
      { label: "Pesanan", value: "#31" },
      { label: "Waktu", value: "3 Okt 2026, 09.41" },
      { label: "Kasir", value: "Ayu Pratama" },
    ],
    payment: [
      { label: "Tunai", value: "Rp150.000" },
      { emphasis: true, label: "Kembalian", value: "Rp28.000" },
    ],
    subtitle: "Catalog Local",
    title: "Kopi Lokal Pusat",
    totals: [{ emphasis: true, label: "Total", value: "Rp122.000" }],
  },
} satisfies Meta<typeof Receipt>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Paper80mm: Story = {};

export const Paper58mm: Story = { args: { paper: "58mm" } };

export const Reprint: Story = { args: { copyLabel: "SALINAN" } };

export const Qris: Story = {
  args: {
    payment: [
      { label: "QRIS", value: "Rp122.000" },
      { label: "No. referensi", value: "TRX-88213" },
    ],
  },
};
