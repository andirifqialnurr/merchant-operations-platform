import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";

import {
  PlatformEntitlementMatrix,
  type PlatformEntitlementMatrixCell,
  type PlatformEntitlementPlan,
} from "@merchant/ui/platform-entitlement-matrix";

import { storyContractParameters } from "./story-contract";

const plans: readonly PlatformEntitlementPlan[] = [
  { code: "CAFE_OPS", name: "Cafe Operations", selected: true, tenantCountLabel: "18 tenant" },
  { code: "POS_BASIC", name: "POS Basic", tenantCountLabel: "9 tenant" },
  { code: "PROFILE", name: "Profile", tenantCountLabel: "4 tenant" },
];

const modules = [
  {
    kind: "CORE",
    key: "CORE_TENANCY",
    name: "Core Tenancy",
    purposeLabel: "Fondasi isolasi tenant dan scope akses.",
  },
  {
    kind: "COMMERCIAL",
    key: "CORE_CATALOG",
    name: "Core Catalog",
    purposeLabel: "Master menu dan komposisi produk.",
  },
  {
    kind: "COMMERCIAL",
    key: "POS",
    name: "POS",
    purposeLabel: "Kasir dan cart staff.",
  },
  {
    dependencyLabel: "Membutuhkan POS.",
    kind: "COMMERCIAL",
    key: "KITCHEN_DISPLAY",
    name: "Kitchen Display",
    purposeLabel: "Display dapur untuk ticket aktif.",
  },
] satisfies Parameters<typeof PlatformEntitlementMatrix>[0]["modules"];

const initialCells: readonly PlatformEntitlementMatrixCell[] = [
  {
    disabled: true,
    disabledReason: "Module dasar selalu tersedia.",
    enabled: true,
    moduleKey: "CORE_TENANCY",
    planCode: "CAFE_OPS",
    reasonLabel: "Fondasi tenant wajib aktif.",
    source: "CORE",
  },
  {
    enabled: true,
    moduleKey: "CORE_CATALOG",
    planCode: "CAFE_OPS",
    reasonLabel: "Termasuk default plan operasional.",
    source: "PLAN",
  },
  {
    enabled: true,
    moduleKey: "POS",
    planCode: "CAFE_OPS",
    reasonLabel: "Kasir aktif untuk plan ini.",
    source: "PLAN",
  },
  {
    enabled: false,
    moduleKey: "KITCHEN_DISPLAY",
    planCode: "CAFE_OPS",
    reasonLabel: "Perlu aktivasi dapur.",
    source: "NONE",
  },
  {
    disabled: true,
    disabledReason: "Module dasar selalu tersedia.",
    enabled: true,
    moduleKey: "CORE_TENANCY",
    planCode: "POS_BASIC",
    reasonLabel: "Fondasi tenant wajib aktif.",
    source: "CORE",
  },
  {
    enabled: true,
    moduleKey: "POS",
    planCode: "POS_BASIC",
    reasonLabel: "Kasir tersedia pada plan basic.",
    source: "PLAN",
  },
  {
    disabled: true,
    disabledReason: "Module dasar selalu tersedia.",
    enabled: true,
    moduleKey: "CORE_TENANCY",
    planCode: "PROFILE",
    reasonLabel: "Fondasi tenant wajib aktif.",
    source: "CORE",
  },
] as const;

function EntitlementMatrixExample() {
  const [selectedPlanCode, setSelectedPlanCode] = useState("CAFE_OPS");
  const [cells, setCells] = useState<readonly PlatformEntitlementMatrixCell[]>(initialCells);
  const [refreshed, setRefreshed] = useState(false);

  return (
    <PlatformEntitlementMatrix
      cells={cells}
      modules={modules}
      onRefresh={() => setRefreshed(true)}
      onSelectPlan={setSelectedPlanCode}
      onTogglePlanModule={(planCode, moduleKey, enabled) =>
        setCells((items) =>
          items.map((item) =>
            item.planCode === planCode && item.moduleKey === moduleKey
              ? { ...item, enabled }
              : item,
          ),
        )
      }
      plans={plans.map((plan) => ({ ...plan, selected: plan.code === selectedPlanCode }))}
      selectedPlanCode={selectedPlanCode}
      sourceLabel="Platform Owner"
      statusLabel={refreshed ? "Matrix baru" : "Matrix tersinkron"}
    />
  );
}

const meta = {
  title: "Domain/Platform/Entitlement Matrix",
  component: PlatformEntitlementMatrix,
  args: {
    cells: initialCells,
    modules,
    plans,
    selectedPlanCode: "CAFE_OPS",
    sourceLabel: "Platform Owner",
  },
  parameters: {
    ...storyContractParameters,
    layout: "padded",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof PlatformEntitlementMatrix>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <EntitlementMatrixExample />,
};

export const EmptyModules: Story = {
  render: () => (
    <PlatformEntitlementMatrix
      cells={[]}
      modules={[]}
      plans={plans}
      selectedPlanCode="CAFE_OPS"
      sourceLabel="Platform Owner"
      statusLabel="Belum lengkap"
    />
  ),
};

export const ThemeComparison: Story = {
  render: () => (
    <div className="story-contract-theme-comparison story-platform-entitlement-matrix-theme">
      <section data-theme-preview="light">
        <h2 className="text-heading-sm">Light</h2>
        <EntitlementMatrixExample />
      </section>
      <section data-theme-preview="dark">
        <h2 className="text-heading-sm">Dark</h2>
        <EntitlementMatrixExample />
      </section>
    </div>
  ),
};

export const Mobile: Story = {
  parameters: { viewport: { defaultViewport: "mobile" } },
  render: () => <EntitlementMatrixExample />,
};
