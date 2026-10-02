import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";

import { Panel } from "@merchant/ui/data-display";
import {
  CloseShiftForm,
  OpenShiftForm,
  ShiftSummary,
  type CloseShiftFormLabels,
  type ShiftSummaryLabels,
} from "@merchant/ui/pos-shift";

import { storyContractParameters } from "./story-contract";

const summaryLabels: ShiftSummaryLabels = {
  cashIn: "Kas masuk",
  cashOut: "Kas keluar",
  cashSales: "Penjualan tunai",
  countedCash: "Kas fisik",
  expectedCash: "Kas seharusnya",
  nonCash: "Non-tunai",
  openingCash: "Kas awal",
  variance: "Selisih kas",
};

const closeLabels: CloseShiftFormLabels = {
  countedCash: "Kas fisik",
  countedCashRequired: "Isi kas fisik.",
  expectedCash: "Kas seharusnya",
  reason: "Alasan selisih",
  reasonRequired: "Isi alasan selisih.",
  submit: "Tutup shift",
  submitting: "Menutup shift",
  varianceBalanced: "Selisih · Cocok",
  varianceNeedsReason: "Selisih · Perlu alasan",
};

const activeSummary = {
  cashInMinor: "25000",
  cashOutMinor: "10000",
  cashSalesMinor: "200000",
  expectedCashMinor: "265000",
  facts: [{ label: "Dibuka", value: "23 Jul 2026, 08.00" }],
  labels: summaryLabels,
  nonCashBreakdown: [
    { amountMinor: "175000", id: "qris", label: "QRIS merchant" },
    { amountMinor: "125000", id: "transfer", label: "Transfer bank" },
  ],
  openingCashMinor: "50000",
} as const;

const closedFacts = [
  { label: "Dibuka", value: "23 Jul 2026, 08.00" },
  { label: "Ditutup", value: "23 Jul 2026, 17.10" },
] as const;

function OpenShiftExample() {
  const [openingCash, setOpeningCash] = useState<number | undefined>();
  return (
    <OpenShiftForm
      labels={{ openingCash: "Kas awal", submit: "Buka shift", submitting: "Membuka shift" }}
      onOpeningCashChange={setOpeningCash}
      onSubmit={() => undefined}
      {...(openingCash === undefined ? {} : { openingCashMinor: openingCash })}
    />
  );
}

function CloseShiftExample() {
  const [countedCash, setCountedCash] = useState<number | undefined>();
  const [reason, setReason] = useState("");
  return (
    <CloseShiftForm
      expectedCashMinor={activeSummary.expectedCashMinor}
      labels={closeLabels}
      onCountedCashChange={setCountedCash}
      onReasonChange={setReason}
      onSubmit={() => undefined}
      reason={reason}
      {...(countedCash === undefined ? {} : { countedCashMinor: countedCash })}
    />
  );
}

const meta = {
  title: "Domain/POS/Shift",
  component: ShiftSummary,
  parameters: {
    ...storyContractParameters,
    layout: "padded",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof ShiftSummary>;

export default meta;
type Story = StoryObj<typeof meta>;

export const OpenShift: Story = {
  args: { ...activeSummary, status: "active" },
  render: () => <OpenShiftExample />,
};

export const ActiveSummary: Story = {
  args: { ...activeSummary, status: "active" },
};

/** Before sales exist the cash sales row is left out, not shown as zero. */
export const ActiveWithoutSales: Story = {
  args: {
    cashInMinor: "25000",
    cashOutMinor: "10000",
    expectedCashMinor: "65000",
    facts: activeSummary.facts,
    labels: summaryLabels,
    openingCashMinor: "50000",
    status: "active",
  },
};

export const CloseShift: Story = {
  args: { ...activeSummary, status: "active" },
  render: () => <CloseShiftExample />,
};

export const ClosedManagerSummary: Story = {
  args: {
    ...activeSummary,
    canViewVariance: true,
    countedCashMinor: "260000",
    facts: closedFacts,
    status: "closed",
    varianceMinor: "-5000",
  },
};

export const ClosedCashierSummary: Story = {
  args: {
    ...activeSummary,
    countedCashMinor: "260000",
    facts: closedFacts,
    status: "closed",
    varianceMinor: "-5000",
  },
};

/** The summary carries no card of its own; a page places it in one Panel. */
export const InsidePanel: Story = {
  args: { ...activeSummary, status: "active" },
  render: (args) => (
    <Panel title="Kas">
      <div className="story-shift-panel-body">
        <ShiftSummary {...args} />
      </div>
    </Panel>
  ),
};

export const ThemeComparison: Story = {
  args: { ...activeSummary, status: "active" },
  render: () => (
    <div className="story-shift-theme-comparison">
      <section data-theme-preview="light">
        <h2 className="text-heading-sm">Light</h2>
        <ShiftSummary {...activeSummary} status="active" />
      </section>
      <section data-theme-preview="dark">
        <h2 className="text-heading-sm">Dark</h2>
        <ShiftSummary {...activeSummary} status="active" />
      </section>
    </div>
  ),
};

export const MobileCloseShift: Story = {
  args: { ...activeSummary, status: "active" },
  parameters: { viewport: { defaultViewport: "mobile" } },
  render: () => <CloseShiftExample />,
};
