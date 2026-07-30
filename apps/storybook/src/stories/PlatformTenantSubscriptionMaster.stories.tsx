import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";

import {
  PlatformTenantSubscriptionMaster,
  type PlatformModuleEntitlement,
  type PlatformSubscriptionStatus,
  type PlatformTenantSummary,
} from "@merchant/ui/platform-tenant-subscription-master";

import { storyContractParameters } from "./story-contract";

const baseTenants: readonly PlatformTenantSummary[] = [
  {
    id: "tenant-safe-01",
    name: "Kopi Senja",
    selected: true,
    status: "ACTIVE",
    subscriptionStatus: "ACTIVE",
  },
  {
    id: "tenant-safe-02",
    name: "Roti Pagi",
    status: "ACTIVE",
    subscriptionStatus: "TRIAL",
  },
  {
    disabled: true,
    disabledReason: "Tenant sedang ditinjau platform support.",
    id: "tenant-safe-03",
    name: "Soto Malam",
    status: "INACTIVE",
    subscriptionStatus: "SUSPENDED",
  },
];

const baseEntitlements: readonly PlatformModuleEntitlement[] = [
  {
    enabled: true,
    key: "CORE_CATALOG",
    name: "Core Catalog",
    reasonLabel: "Tersedia dari plan operasional.",
    source: "PLAN",
  },
  {
    enabled: true,
    key: "POS",
    name: "POS",
    reasonLabel: "Kasir aktif untuk plan ini.",
    source: "PLAN",
  },
  {
    enabled: false,
    key: "KDS",
    name: "Kitchen Display",
    reasonLabel: "Menunggu aktivasi modul dapur.",
    source: "NONE",
  },
  {
    disabled: true,
    disabledReason: "Core tenancy selalu aktif.",
    enabled: true,
    key: "CORE_TENANCY",
    name: "Core Tenancy",
    reasonLabel: "Dibutuhkan oleh seluruh tenant.",
    source: "CORE",
  },
];

function PlatformMasterExample() {
  const [selectedTenantId, setSelectedTenantId] = useState("tenant-safe-01");
  const [subscriptionStatus, setSubscriptionStatus] =
    useState<PlatformSubscriptionStatus>("ACTIVE");
  const [entitlements, setEntitlements] =
    useState<readonly PlatformModuleEntitlement[]>(baseEntitlements);
  const [refreshed, setRefreshed] = useState(false);

  return (
    <PlatformTenantSubscriptionMaster
      entitlements={entitlements}
      onChangeSubscriptionStatus={(_, status) => setSubscriptionStatus(status)}
      onRefresh={() => setRefreshed(true)}
      onSelectTenant={setSelectedTenantId}
      onSetModuleEntitlement={(_, moduleKey, enabled) =>
        setEntitlements((items) =>
          items.map((item) => (item.key === moduleKey ? { ...item, enabled } : item)),
        )
      }
      selectedTenantId={selectedTenantId}
      sourceLabel="Platform Owner"
      statusLabel={refreshed ? "Snapshot baru" : "Snapshot tersinkron"}
      subscription={{
        endsAtLabel: "31 Juli 2027",
        graceEndsAtLabel: "14 Agustus 2027",
        planLabel: "Cafe Operations",
        startsAtLabel: "1 Agustus 2026",
        status: subscriptionStatus,
      }}
      tenants={baseTenants.map((tenant) => {
        const nextSubscriptionStatus =
          tenant.id === selectedTenantId ? subscriptionStatus : tenant.subscriptionStatus;

        return {
          ...tenant,
          selected: tenant.id === selectedTenantId,
          ...(nextSubscriptionStatus ? { subscriptionStatus: nextSubscriptionStatus } : {}),
        };
      })}
    />
  );
}

const meta = {
  title: "Domain/Platform/Tenant Subscription Master",
  component: PlatformTenantSubscriptionMaster,
  args: {
    entitlements: baseEntitlements,
    selectedTenantId: "tenant-safe-01",
    sourceLabel: "Platform Owner",
    subscription: {
      endsAtLabel: "31 Juli 2027",
      planLabel: "Cafe Operations",
      startsAtLabel: "1 Agustus 2026",
      status: "ACTIVE",
    },
    tenants: baseTenants,
  },
  parameters: {
    ...storyContractParameters,
    layout: "padded",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof PlatformTenantSubscriptionMaster>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <PlatformMasterExample />,
};

export const EmptySubscription: Story = {
  render: () => (
    <PlatformTenantSubscriptionMaster
      entitlements={[]}
      selectedTenantId="tenant-safe-01"
      sourceLabel="Platform Owner"
      statusLabel="Belum lengkap"
      subscription={null}
      tenants={baseTenants}
    />
  ),
};

export const ThemeComparison: Story = {
  render: () => (
    <div className="story-contract-theme-comparison story-platform-master-theme">
      <section data-theme-preview="light">
        <h2 className="text-heading-sm">Light</h2>
        <PlatformMasterExample />
      </section>
      <section data-theme-preview="dark">
        <h2 className="text-heading-sm">Dark</h2>
        <PlatformMasterExample />
      </section>
    </div>
  ),
};

export const Mobile: Story = {
  parameters: { viewport: { defaultViewport: "mobile" } },
  render: () => <PlatformMasterExample />,
};
