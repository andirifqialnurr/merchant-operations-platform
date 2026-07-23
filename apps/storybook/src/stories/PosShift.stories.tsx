import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";

import { CloseShiftForm, OpenShiftForm, ShiftSummary } from "@merchant/ui/pos-shift";

import { storyContractParameters } from "./story-contract";

const activeSummary = {
  cashInMinor: "25000",
  cashOutMinor: "10000",
  cashSalesMinor: "200000",
  expectedCashMinor: "265000",
  nonCashBreakdown: [
    { amountMinor: "175000", id: "qris", label: "QRIS merchant" },
    { amountMinor: "125000", id: "transfer", label: "Transfer bank" },
  ],
  openedAtLabel: "23 Jul 2026, 08.00",
  openedBy: "Ayu Pratama",
  openingCashMinor: "50000",
} as const;

function OpenShiftExample() {
  const [openingCash, setOpeningCash] = useState<number | undefined>();
  return (
    <OpenShiftForm
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

export const CloseShift: Story = {
  args: { ...activeSummary, status: "active" },
  render: () => <CloseShiftExample />,
};

export const ClosedManagerSummary: Story = {
  args: {
    ...activeSummary,
    canViewVariance: true,
    closedAtLabel: "23 Jul 2026, 17.10",
    closedBy: "Ayu Pratama",
    countedCashMinor: "260000",
    status: "closed",
    varianceMinor: "-5000",
  },
};

export const ClosedCashierSummary: Story = {
  args: {
    ...activeSummary,
    closedAtLabel: "23 Jul 2026, 17.10",
    closedBy: "Ayu Pratama",
    countedCashMinor: "260000",
    status: "closed",
    varianceMinor: "-5000",
  },
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
