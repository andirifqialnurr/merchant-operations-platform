import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";

import { CustomerBasicProfile, type CustomerBasicItem } from "@merchant/ui/customer-basic-profile";

import { storyContractParameters } from "./story-contract";

const baseCustomers: readonly CustomerBasicItem[] = [
  {
    channelLabel: "QR meja",
    consentLabel: "Kontak boleh dipakai untuk struk",
    contactLabel: "WA **** 1890",
    displayName: "Ayu Prameswari",
    id: "cust-safe-01",
    lastVisitLabel: "Terakhir: hari ini",
    noteLabel: "Preferensi: oat milk bila tersedia.",
    pointBalanceLabel: "120 poin",
    segmentLabel: "Regular",
    status: "member",
    visitCountLabel: "12 kunjungan",
  },
  {
    channelLabel: "Walk-in",
    contactLabel: "Kontak disembunyikan",
    disabled: true,
    disabledReason: "Perlu konfirmasi staf",
    displayName: "Tamu Meja 05",
    id: "cust-safe-02",
    segmentLabel: "Tamu",
    status: "guest",
  },
  {
    channelLabel: "Kasir",
    consentLabel: "Hanya notifikasi transaksi",
    contactLabel: "Kontak a***@contoh.id",
    displayName: "Rafi Nugraha",
    id: "cust-safe-03",
    lastVisitLabel: "Terakhir: 2 hari lalu",
    segmentLabel: "Dikenal",
    status: "known",
    visitCountLabel: "4 kunjungan",
  },
];

function StatefulCustomerBasicProfile() {
  const [selectedId, setSelectedId] = useState("cust-safe-01");
  const items = baseCustomers.map((item) => ({ ...item, selected: item.id === selectedId }));

  return (
    <CustomerBasicProfile
      items={items}
      onClearSelection={() => setSelectedId("")}
      onSelectCustomer={(id) => setSelectedId(id)}
      selectedSummaryLabel={selectedId ? "1 customer dipilih" : "Belum ada customer dipilih"}
      sourceLabel="Outlet Meruya"
      statusLabel="Customer Basic aktif"
    />
  );
}

const meta = {
  title: "Domain/Customer/Basic Profile",
  component: CustomerBasicProfile,
  args: {
    items: baseCustomers,
    sourceLabel: "Outlet Meruya",
    statusLabel: "Customer Basic aktif",
  },
  parameters: {
    ...storyContractParameters,
    layout: "padded",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof CustomerBasicProfile>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <StatefulCustomerBasicProfile />,
};

export const Empty: Story = {
  render: () => (
    <CustomerBasicProfile
      items={[]}
      selectedSummaryLabel="Belum ada customer dipilih"
      sourceLabel="Outlet Meruya"
      statusLabel="Customer Basic aktif"
    />
  ),
};

export const ThemeComparison: Story = {
  render: () => (
    <div className="story-contract-theme-comparison story-customer-basic-theme">
      <section data-theme-preview="light">
        <h2 className="text-heading-sm">Light</h2>
        <StatefulCustomerBasicProfile />
      </section>
      <section data-theme-preview="dark">
        <h2 className="text-heading-sm">Dark</h2>
        <StatefulCustomerBasicProfile />
      </section>
    </div>
  ),
};

export const Mobile: Story = {
  parameters: { viewport: { defaultViewport: "mobile" } },
  render: () => <StatefulCustomerBasicProfile />,
};
