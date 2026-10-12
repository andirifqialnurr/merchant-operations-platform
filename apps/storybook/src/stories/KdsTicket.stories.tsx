import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";

import {
  KdsConnectionStatus,
  KdsNewTicketAlert,
  KdsTicket,
  type KdsConnectionState,
  type KdsTicketProps,
  type KdsTicketStatus,
} from "@merchant/ui/kds-ticket";

import { storyContractParameters } from "./story-contract";

const items = [
  {
    allergyNote: "kacang",
    modifiers: ["Tidak pedas", "Tambah telur"],
    name: "Nasi goreng kampung",
    note: "Bawang goreng dipisah",
    quantity: 2,
  },
  { name: "Es teh tawar", quantity: 1 },
];

/** The words a screen passes in; the component has none of its own. */
const statusLabels: Record<KdsTicketStatus, string> = {
  accepted: "Diterima",
  canceled: "Dibatalkan",
  new: "Baru",
  preparing: "Disiapkan",
  ready: "Siap",
  served: "Disajikan",
};
const nextStep: Partial<Record<KdsTicketStatus, { label: string; to: KdsTicketStatus }>> = {
  accepted: { label: "Mulai siapkan", to: "preparing" },
  new: { label: "Terima", to: "accepted" },
  preparing: { label: "Tandai siap", to: "ready" },
  ready: { label: "Sudah disajikan", to: "served" },
};

const base = {
  allergyLabel: "Alergi",
  elapsedLabel: "08:12",
  items,
  label: "Ticket A-014",
  orderLabel: "A-014",
  sourceLabel: "Kasir",
  status: "new",
  statusLabel: statusLabels.new,
  tableLabel: "Meja 05",
  timerLabel: "Menunggu",
} satisfies KdsTicketProps;

const withStatus = (status: KdsTicketStatus) => ({ status, statusLabel: statusLabels[status] });
const noop = () => undefined;

/** One button per ticket: the next valid step, until the ticket is served. */
function StatefulKdsTicket(props: Partial<KdsTicketProps>) {
  const [status, setStatus] = useState<KdsTicketStatus>("new");
  const step = nextStep[status];
  return (
    <div className="story-kds-ticket-frame">
      <KdsTicket
        {...base}
        {...props}
        {...withStatus(status)}
        {...(step ? { action: { label: step.label, onAction: () => setStatus(step.to) } } : {})}
      />
    </div>
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

function ReconnectRefetchDemo() {
  const [state, setState] = useState<KdsConnectionState>("disconnected");
  const [lastAction, setLastAction] = useState("Menunggu koneksi dapur.");

  return (
    <div className="story-kds-ticket-stack">
      <KdsConnectionStatus
        canReconnect={state === "disconnected"}
        canRefetch={state === "connected" || state === "stale"}
        lastSyncedLabel={state === "connected" ? "Sinkron 20:15" : "Sinkron terakhir 20:02"}
        message={lastAction}
        onReconnect={() => {
          setState("connected");
          setLastAction("Koneksi berhasil dipulihkan.");
        }}
        onRefetch={() => {
          setState("connected");
          setLastAction("Snapshot ticket terbaru sudah diambil.");
        }}
        pendingCount={state === "connected" ? 0 : 2}
        state={state}
        statusId="connection-internal-01"
      />
      <div className="story-kds-ticket-row">
        <button
          className="story-kds-ticket-control"
          onClick={() => setState("stale")}
          type="button"
        >
          Simulasikan stale
        </button>
        <button
          className="story-kds-ticket-control"
          onClick={() => setState("disconnected")}
          type="button"
        >
          Simulasikan terputus
        </button>
      </div>
    </div>
  );
}

const meta = {
  title: "Domain/KDS/Kitchen Ticket",
  component: KdsTicket,
  args: base,
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

export const Statuses: Story = {
  render: () => (
    <div className="story-kds-ticket-row">
      {(["new", "accepted", "preparing", "ready"] as const).map((status) => (
        <KdsTicket
          {...base}
          {...withStatus(status)}
          action={{ label: nextStep[status]?.label ?? "", onAction: noop }}
          key={status}
        />
      ))}
    </div>
  ),
};

export const Sizes: Story = {
  render: () => (
    <div className="story-kds-ticket-row">
      <KdsTicket
        {...base}
        action={{ label: "Terima", onAction: noop }}
        size="sm"
        variant="compact"
      />
      <KdsTicket {...base} action={{ label: "Terima", onAction: noop }} />
      <KdsTicket {...base} action={{ label: "Terima", onAction: noop }} size="lg" variant="touch" />
    </div>
  ),
};

export const WaitingTime: Story = {
  render: () => (
    <div className="story-kds-ticket-row">
      <KdsTicket {...base} {...withStatus("preparing")} elapsedLabel="04:10" />
      <KdsTicket {...base} {...withStatus("preparing")} elapsedLabel="11:40" timerTone="warning" />
      <KdsTicket {...base} {...withStatus("preparing")} elapsedLabel="18:05" timerTone="late" />
    </div>
  ),
};

export const WithoutTableOrNotes: Story = {
  render: () => (
    <div className="story-kds-ticket-frame">
      <KdsTicket
        allergyLabel="Alergi"
        action={{ busy: true, label: "Terima", onAction: noop }}
        elapsedLabel="00:40"
        items={[{ name: "Kopi susu", quantity: 3 }]}
        label="Ticket Bungkus Rina"
        orderLabel="Bungkus Rina"
        sourceLabel="Manual"
        status="new"
        statusLabel={statusLabels.new}
        timerLabel="Menunggu"
      />
    </div>
  ),
};

export const English: Story = {
  render: () => (
    <div className="story-kds-ticket-frame">
      <KdsTicket
        {...base}
        action={{ label: "Accept", onAction: noop }}
        allergyLabel="Allergy"
        items={[
          { allergyNote: "peanuts", modifiers: ["Not spicy"], name: "Fried rice", quantity: 2 },
        ]}
        sourceLabel="Cashier"
        statusLabel="New"
        tableLabel="Table 05"
        timerLabel="Waiting"
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

export const ReconnectRefetch: Story = {
  render: () => (
    <div className="story-kds-ticket-stack">
      <ReconnectRefetchDemo />
      <KdsConnectionStatus
        lastSyncedLabel="Sinkron 20:18"
        pendingCount={0}
        state="connected"
        statusId="connection-ready-01"
      />
      <KdsConnectionStatus
        lastSyncedLabel="Sinkron terakhir 20:00"
        pendingCount={4}
        state="stale"
        statusId="connection-stale-01"
      />
    </div>
  ),
};

export const History: Story = {
  render: () => (
    <div className="story-kds-ticket-row">
      <KdsTicket {...base} {...withStatus("served")} elapsedLabel="14:02" variant="history" />
      <KdsTicket
        {...base}
        {...withStatus("canceled")}
        elapsedLabel="03:15"
        label="Ticket A-015"
        orderLabel="A-015"
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
          <ReconnectRefetchDemo />
          <NewTicketAlertDemo />
          <StatefulKdsTicket />
        </div>
      </section>
      <section data-theme-preview="dark">
        <h2 className="text-heading-sm">Dark</h2>
        <div className="story-kds-ticket-stack">
          <ReconnectRefetchDemo />
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
      <ReconnectRefetchDemo />
      <NewTicketAlertDemo />
      <StatefulKdsTicket />
    </div>
  ),
};
