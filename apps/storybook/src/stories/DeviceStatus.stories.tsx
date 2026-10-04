import type { Meta, StoryObj } from "@storybook/react-vite";

import { Button } from "@merchant/ui/button";
import {
  DeviceStatusBadge,
  NetworkSyncIndicator,
  StaleDataBanner,
} from "@merchant/ui/device-status";

import { storyContractParameters } from "./story-contract";

const meta = {
  title: "Patterns/DeviceStatus",
  component: StaleDataBanner,
  parameters: {
    ...storyContractParameters,
    layout: "padded",
  },
  tags: ["autodocs"],
  args: {
    action: (
      <Button size="sm" variant="secondary">
        Muat ulang
      </Button>
    ),
    children: "Data di layar mungkin sudah berubah.",
    lastUpdatedLabel: "Terakhir diperbarui 10.42",
  },
} satisfies Meta<typeof StaleDataBanner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const StaleData: Story = {};

const row = {
  alignItems: "center",
  display: "flex",
  flexWrap: "wrap",
  gap: "var(--space-3)",
} as const;

function Everything() {
  return (
    <div style={{ display: "grid", gap: "var(--space-5)", maxInlineSize: "40rem" }}>
      <div style={row}>
        <DeviceStatusBadge label="Menunggu aktivasi" status="PENDING" />
        <DeviceStatusBadge label="Aktif" status="ACTIVE" />
        <DeviceStatusBadge label="Dicabut" status="REVOKED" />
      </div>
      <div style={row}>
        <NetworkSyncIndicator label="Tersambung" state="online" />
        <NetworkSyncIndicator label="Menyinkronkan" state="syncing" />
        <NetworkSyncIndicator label="Menyambung ulang" state="reconnecting" />
        <NetworkSyncIndicator label="Offline" state="offline" />
        <NetworkSyncIndicator compact label="Offline" state="offline" />
      </div>
      <StaleDataBanner
        action={
          <Button size="sm" variant="secondary">
            Muat ulang
          </Button>
        }
        lastUpdatedLabel="Terakhir diperbarui 10.42"
      >
        Data di layar mungkin sudah berubah.
      </StaleDataBanner>
      <StaleDataBanner>Sambungan terputus. Pesanan baru belum tampil.</StaleDataBanner>
    </div>
  );
}

/** Device status, connection, and stale data, at every state. */
export const AllStates: Story = { render: () => <Everything /> };

export const ThemeComparison: Story = {
  render: () => (
    <div className="story-contract-theme-comparison">
      <section data-theme-preview="light">
        <Everything />
      </section>
      <section data-theme-preview="dark">
        <Everything />
      </section>
    </div>
  ),
};
