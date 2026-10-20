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

export const VisitBill: Story = {
  args: {
    documentLabel: "Tagihan · Sebagian dibayar",
    lines: [],
    payment: [],
    meta: [
      { label: "Kunjungan", value: "#18" },
      { label: "Meja", value: "T1" },
    ],
    lineGroups: [
      {
        key: "order-1",
        title: "Pesanan #31",
        lines: [
          {
            key: "item-1",
            name: "Kopi susu dengan nama sangat panjang",
            quantity: "2×",
            amount: "Rp50.000",
            detail: "Dingin · Tanpa gula",
          },
        ],
      },
      {
        key: "order-2",
        title: "Pesanan #32",
        lines: [{ key: "item-2", name: "Teh", quantity: "1×", amount: "Rp25.000" }],
      },
    ],
    totals: [
      { label: "Total", value: "Rp75.000", emphasis: true },
      { label: "Belum dibayar", value: "Rp25.000", emphasis: true },
    ],
    paymentGroups: [
      {
        key: "payment-1",
        title: "Tunai",
        rows: [
          { label: "Pembayaran", value: "Rp50.000" },
          { label: "Kasir", value: "Ayu Pratama" },
        ],
      },
    ],
  },
};

export const PendingVisit: Story = {
  args: {
    documentLabel: "Bill · Awaiting review",
    lines: [],
    payment: [],
    totals: [],
    meta: [
      { label: "Visit", value: "#18" },
      { label: "Table", value: "T1" },
    ],
    lineGroups: [
      {
        key: "pending",
        title: "Review · Order #33",
        lines: [{ key: "item", name: "Coffee", quantity: "1×", detail: "No sugar" }],
      },
    ],
  },
};

export const Qris: Story = {
  args: {
    payment: [
      { label: "QRIS", value: "Rp122.000" },
      { label: "No. referensi", value: "TRX-88213" },
    ],
  },
};
