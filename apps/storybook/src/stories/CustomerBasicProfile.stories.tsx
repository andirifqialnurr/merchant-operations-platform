import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";

import {
  CustomerBasicProfile,
  type CustomerBasicItem,
  type CustomerBasicProfileLabels,
} from "@merchant/ui/customer-basic-profile";

import { storyContractParameters } from "./story-contract";

const labels: CustomerBasicProfileLabels = {
  empty: "Belum ada pelanggan yang cocok.",
  region: "Hasil pencarian pelanggan",
  select: "Pilih",
  selected: "Terpilih",
};

const customers: readonly CustomerBasicItem[] = [
  {
    contactLabel: "0812 3456 7890",
    displayName: "Ayu Prameswari",
    id: "cust-safe-01",
    noteLabel: "Oat milk bila tersedia.",
    visitLabel: "12 kunjungan · terakhir 14/10",
  },
  // A cashier without contact rights sees only the last digits.
  {
    contactLabel: "•••• 1890",
    displayName: "Rafi Nugraha",
    id: "cust-safe-02",
    visitLabel: "4 kunjungan",
  },
  {
    displayName:
      "Pelanggan dengan nama yang sangat panjang sekali untuk menguji pembungkusan baris",
    id: "cust-safe-03",
  },
];

function Choosing() {
  const [selectedId, setSelectedId] = useState("cust-safe-01");
  return (
    <CustomerBasicProfile
      items={customers.map((item) => ({ ...item, selected: item.id === selectedId }))}
      labels={labels}
      onSelectCustomer={setSelectedId}
    />
  );
}

const meta = {
  title: "Domain/Customer/Basic Profile",
  component: CustomerBasicProfile,
  args: { items: customers, labels },
  parameters: { ...storyContractParameters, layout: "padded" },
  tags: ["autodocs"],
} satisfies Meta<typeof CustomerBasicProfile>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Tab to a row's button and press Enter to choose; the chosen one says so. */
export const Default: Story = { render: () => <Choosing /> };

export const Empty: Story = { args: { items: [] } };

export const Disabled: Story = {
  render: () => (
    <CustomerBasicProfile
      disabled
      items={customers}
      labels={labels}
      onSelectCustomer={() => undefined}
    />
  ),
};

export const ThemeComparison: Story = {
  render: () => (
    <div className="story-contract-theme-comparison story-customer-basic-theme">
      <section data-theme-preview="light">
        <h2 className="text-heading-sm">Light</h2>
        <Choosing />
      </section>
      <section data-theme-preview="dark">
        <h2 className="text-heading-sm">Dark</h2>
        <Choosing />
      </section>
    </div>
  ),
};

export const Mobile: Story = {
  parameters: { viewport: { defaultViewport: "mobile" } },
  render: () => <Choosing />,
};
