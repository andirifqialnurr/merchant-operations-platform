import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";

import {
  PlatformSupportAudit,
  type PlatformAuditEvent,
  type PlatformSupportContext,
} from "@merchant/ui/platform-support-audit";

import { storyContractParameters } from "./story-contract";

const contexts: readonly PlatformSupportContext[] = [
  {
    channelLabel: "Support live",
    key: "SUPPORT_LIVE",
    label: "Live issue",
    priorityLabel: "Prioritas tinggi",
    scopeLabel: "Operasional platform",
    selected: true,
    state: "OPEN",
    summaryLabel: "Tim support sedang memantau dampak layanan.",
  },
  {
    channelLabel: "Policy review",
    key: "POLICY_REVIEW",
    label: "Policy follow-up",
    scopeLabel: "Kontrol internal",
    state: "WATCHING",
    summaryLabel: "Menunggu review owner platform.",
  },
  {
    channelLabel: "Support live",
    disabled: true,
    disabledReason: "Context selesai dan hanya tampil sebagai referensi.",
    key: "RESOLVED_CASE",
    label: "Resolved case",
    scopeLabel: "Riwayat operasional",
    state: "RESOLVED",
  },
];

const events: readonly PlatformAuditEvent[] = [
  {
    categoryLabel: "Access control",
    contextKey: "SUPPORT_LIVE",
    detailLabel: "Perubahan module ditahan sampai policy selesai diverifikasi.",
    key: "EVENT_POLICY_HOLD",
    resolutionLabel: "Menunggu persetujuan platform.",
    severity: "WARNING",
    sourceLabel: "System policy",
    stateLabel: "Perlu review",
    timeLabel: "Baru saja",
    title: "Entitlement hold",
  },
  {
    categoryLabel: "Support",
    contextKey: "SUPPORT_LIVE",
    detailLabel: "Support context dibuka dari alert operasional.",
    key: "EVENT_CONTEXT_OPENED",
    severity: "INFO",
    sourceLabel: "Support queue",
    stateLabel: "Tercatat",
    title: "Context opened",
  },
  {
    categoryLabel: "Access control",
    contextKey: "POLICY_REVIEW",
    detailLabel: "Policy review selesai tanpa perubahan module.",
    key: "EVENT_POLICY_CLEARED",
    resolutionLabel: "Tidak ada aksi lanjutan.",
    severity: "SUCCESS",
    sourceLabel: "System policy",
    stateLabel: "Selesai",
    title: "Policy cleared",
  },
];

function SupportAuditExample() {
  const [selectedContextKey, setSelectedContextKey] = useState("SUPPORT_LIVE");
  const [refreshed, setRefreshed] = useState(false);

  return (
    <PlatformSupportAudit
      contexts={contexts.map((context) => ({
        ...context,
        selected: context.key === selectedContextKey,
      }))}
      events={events}
      onRefresh={() => setRefreshed(true)}
      onSelectContext={setSelectedContextKey}
      selectedContextKey={selectedContextKey}
      sourceLabel="Platform Owner"
      statusLabel={refreshed ? "Support baru" : "Support tersinkron"}
    />
  );
}

const meta = {
  title: "Domain/Platform/Support Audit",
  component: PlatformSupportAudit,
  args: {
    contexts,
    events,
    selectedContextKey: "SUPPORT_LIVE",
    sourceLabel: "Platform Owner",
    statusLabel: "Support tersinkron",
  },
  parameters: {
    ...storyContractParameters,
    layout: "padded",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof PlatformSupportAudit>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <SupportAuditExample />,
};

export const EmptyEvents: Story = {
  render: () => (
    <PlatformSupportAudit
      contexts={contexts}
      events={[]}
      selectedContextKey="SUPPORT_LIVE"
      sourceLabel="Platform Owner"
      statusLabel="Belum ada event"
    />
  ),
};

export const ThemeComparison: Story = {
  render: () => (
    <div className="story-contract-theme-comparison story-platform-support-audit-theme">
      <section data-theme-preview="light">
        <h2 className="text-heading-sm">Light</h2>
        <SupportAuditExample />
      </section>
      <section data-theme-preview="dark">
        <h2 className="text-heading-sm">Dark</h2>
        <SupportAuditExample />
      </section>
    </div>
  ),
};

export const Mobile: Story = {
  parameters: { viewport: { defaultViewport: "mobile" } },
  render: () => <SupportAuditExample />,
};
