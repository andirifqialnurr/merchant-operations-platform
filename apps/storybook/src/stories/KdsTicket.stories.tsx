import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";

import { KdsTicket, type KdsTicketStatus } from "@merchant/ui/kds-ticket";

import { storyContractParameters } from "./story-contract";

const items = [
  {
    allergyNote: "Alergi kacang",
    modifiers: ["Tidak pedas", "Tambah telur"],
    name: "Nasi goreng kampung",
    note: "Bawang goreng dipisah",
    quantity: 2,
  },
  {
    modifiers: ["Less ice"],
    name: "Es teh tawar",
    quantity: 1,
  },
] as const;

function StatefulKdsTicket() {
  const [status, setStatus] = useState<KdsTicketStatus>("new");

  return (
    <KdsTicket
      elapsedLabel="08:12"
      id="ticket-internal-01"
      items={items}
      onPrimaryAction={(_, action) => {
        if (action === "accept") setStatus("accepted");
        if (action === "mark-ready") setStatus("ready");
        if (action === "mark-served") setStatus("served");
        if (action === "complete") setStatus("completed");
      }}
      orderLabel="Order A-014"
      sourceLabel="QR meja"
      status={status}
      tableLabel="Meja 05"
    />
  );
}

const meta = {
  title: "Domain/KDS/Kitchen Ticket",
  component: KdsTicket,
  args: {
    elapsedLabel: "08:12",
    id: "ticket-internal-01",
    items,
    orderLabel: "Order A-014",
    sourceLabel: "QR meja",
    status: "new",
    tableLabel: "Meja 05",
  },
  parameters: {
    ...storyContractParameters,
    layout: "padded",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof KdsTicket>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <StatefulKdsTicket />,
};

export const Sizes: Story = {
  render: () => (
    <div className="story-kds-ticket-row">
      <KdsTicket
        elapsedLabel="03:10"
        id="ticket-internal-sm"
        items={items}
        orderLabel="Order A-021"
        size="sm"
        sourceLabel="POS kasir"
        status="accepted"
      />
      <KdsTicket
        elapsedLabel="08:12"
        id="ticket-internal-md"
        items={items}
        orderLabel="Order A-014"
        size="md"
        sourceLabel="QR meja"
        status="preparing"
        tableLabel="Meja 05"
      />
      <KdsTicket
        elapsedLabel="11:44"
        id="ticket-internal-lg"
        items={items}
        orderLabel="Order A-022"
        size="lg"
        sourceLabel="Waiter"
        status="ready"
        tableLabel="Meja Patio"
        variant="touch"
      />
    </div>
  ),
};

export const History: Story = {
  render: () => (
    <div className="story-kds-ticket-row">
      <KdsTicket
        elapsedLabel="17:20"
        id="ticket-history-01"
        items={items}
        orderLabel="Order A-010"
        sourceLabel="POS kasir"
        status="completed"
        variant="history"
      />
      <KdsTicket
        elapsedLabel="04:33"
        id="ticket-history-02"
        items={items}
        orderLabel="Order A-011"
        sourceLabel="QR meja"
        status="cancelled"
        tableLabel="Meja 02"
        variant="history"
      />
    </div>
  ),
};

export const ThemeComparison: Story = {
  render: () => (
    <div className="story-contract-theme-comparison">
      <section data-theme-preview="light">
        <h2 className="text-heading-sm">Light</h2>
        <StatefulKdsTicket />
      </section>
      <section data-theme-preview="dark">
        <h2 className="text-heading-sm">Dark</h2>
        <StatefulKdsTicket />
      </section>
    </div>
  ),
};

export const Mobile: Story = {
  parameters: { viewport: { defaultViewport: "mobile" } },
  render: () => <StatefulKdsTicket />,
};
