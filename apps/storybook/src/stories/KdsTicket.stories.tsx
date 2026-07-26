import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";

import { KdsNewTicketAlert, KdsTicket, type KdsTicketStatus } from "@merchant/ui/kds-ticket";

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

function NewTicketAlertDemo() {
  const [acknowledged, setAcknowledged] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(false);

  if (acknowledged) {
    return (
      <KdsNewTicketAlert
        alertId="alert-internal-ack"
        audioState={audioEnabled ? "ready" : "muted"}
        count={1}
        message="Alert sudah dilihat oleh operator dapur."
      />
    );
  }

  return (
    <KdsNewTicketAlert
      alertId="alert-internal-01"
      audioState={audioEnabled ? "ready" : "blocked"}
      count={3}
      message="Pesanan baru masuk ke antrean dapur."
      onAcknowledge={() => setAcknowledged(true)}
      onEnableAudio={() => setAudioEnabled(true)}
      tone="urgent"
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
        slaState="on-track"
        sourceLabel="POS kasir"
        status="accepted"
      />
      <KdsTicket
        elapsedLabel="08:12"
        id="ticket-internal-md"
        items={items}
        orderLabel="Order A-014"
        size="md"
        slaState="warning"
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
        slaState="breached"
        sourceLabel="Waiter"
        status="ready"
        tableLabel="Meja Patio"
        variant="touch"
      />
    </div>
  ),
};

export const TimerAndSla: Story = {
  render: () => (
    <div className="story-kds-ticket-row">
      <KdsTicket
        elapsedLabel="03:10"
        id="ticket-sla-01"
        items={items}
        orderLabel="Order A-031"
        slaState="on-track"
        sourceLabel="POS kasir"
        status="accepted"
        tableLabel="Meja 01"
        timerState="running"
      />
      <KdsTicket
        elapsedLabel="09:40"
        id="ticket-sla-02"
        items={items}
        orderLabel="Order A-032"
        slaState="warning"
        sourceLabel="QR meja"
        status="preparing"
        tableLabel="Meja 07"
        timerState="running"
      />
      <KdsTicket
        elapsedLabel="16:05"
        id="ticket-sla-03"
        items={items}
        orderLabel="Order A-033"
        slaLabel="Lewat target pickup"
        slaState="breached"
        sourceLabel="Takeaway"
        status="ready"
        timerState="paused"
      />
      <KdsTicket
        elapsedLabel="22:18"
        id="ticket-sla-04"
        items={items}
        orderLabel="Order A-034"
        slaState="on-track"
        sourceLabel="POS kasir"
        status="completed"
        timerState="completed"
        variant="history"
      />
    </div>
  ),
};

export const NewTicketAlert: Story = {
  render: () => (
    <div className="story-kds-ticket-stack">
      <NewTicketAlertDemo />
      <div className="story-kds-ticket-row">
        <KdsNewTicketAlert
          alertId="alert-ready-01"
          audioState="ready"
          count={1}
          message="Audio siap untuk ticket berikutnya."
        />
        <KdsNewTicketAlert
          alertId="alert-muted-01"
          audioState="muted"
          count={2}
          message="Operator memilih mode visual saja."
        />
      </div>
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
        <div className="story-kds-ticket-stack">
          <NewTicketAlertDemo />
          <StatefulKdsTicket />
        </div>
      </section>
      <section data-theme-preview="dark">
        <h2 className="text-heading-sm">Dark</h2>
        <div className="story-kds-ticket-stack">
          <NewTicketAlertDemo />
          <StatefulKdsTicket />
        </div>
      </section>
    </div>
  ),
};

export const Mobile: Story = {
  parameters: { viewport: { defaultViewport: "mobile" } },
  render: () => (
    <div className="story-kds-ticket-stack">
      <NewTicketAlertDemo />
      <StatefulKdsTicket />
    </div>
  ),
};
