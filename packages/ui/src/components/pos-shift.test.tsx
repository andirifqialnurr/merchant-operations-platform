import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import {
  CloseShiftForm,
  OpenShiftForm,
  ShiftSummary,
  type CloseShiftFormLabels,
  type ShiftSummaryLabels,
} from "./pos-shift";

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

function CloseShiftHarness({ onSubmit = () => undefined }: { onSubmit?: () => void }) {
  const [counted, setCounted] = useState<number | undefined>();
  const [reason, setReason] = useState("");

  return (
    <CloseShiftForm
      expectedCashMinor="265000"
      labels={closeLabels}
      onCountedCashChange={setCounted}
      onReasonChange={setReason}
      onSubmit={onSubmit}
      reason={reason}
      {...(counted === undefined ? {} : { countedCashMinor: counted })}
    />
  );
}

const summaryProps = {
  cashInMinor: "25000",
  cashOutMinor: "10000",
  cashSalesMinor: "200000",
  expectedCashMinor: "265000",
  facts: [{ label: "Dibuka", value: "23 Jul 2026, 08.00" }],
  labels: summaryLabels,
  openingCashMinor: "50000",
} as const;

describe("OpenShiftForm", () => {
  it("only asks for the user-owned opening cash value", async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(
      <OpenShiftForm
        labels={{ openingCash: "Kas awal", submit: "Buka shift", submitting: "Membuka shift" }}
        onOpeningCashChange={() => undefined}
        onSubmit={onSubmit}
        openingCashMinor={50_000}
      />,
    );

    expect(screen.getAllByRole("textbox")).toHaveLength(1);
    expect(screen.getByRole("textbox", { name: /Kas awal/ })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Buka shift" }));
    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it("cannot be submitted without an amount", () => {
    render(
      <OpenShiftForm
        labels={{ openingCash: "Kas awal", submit: "Buka shift", submitting: "Membuka shift" }}
        onOpeningCashChange={() => undefined}
        onSubmit={() => undefined}
      />,
    );

    expect(screen.getByRole("button", { name: "Buka shift" })).toBeDisabled();
  });
});

describe("ShiftSummary", () => {
  it("omits closing-only and unavailable rows from an active shift", () => {
    render(
      <ShiftSummary
        cashInMinor="25000"
        cashOutMinor="10000"
        expectedCashMinor="65000"
        facts={summaryProps.facts}
        labels={summaryLabels}
        openingCashMinor="50000"
        status="active"
      />,
    );

    expect(screen.getByText("Dibuka")).toBeVisible();
    expect(screen.queryByText("Penjualan tunai")).not.toBeInTheDocument();
    expect(screen.queryByText("Kas fisik")).not.toBeInTheDocument();
    expect(screen.queryByText("Selisih kas")).not.toBeInTheDocument();
    expect(screen.queryByText("Non-tunai")).not.toBeInTheDocument();
    expect(screen.getAllByText("Kas seharusnya")).toHaveLength(1);
  });

  it("keeps variance permission-filtered and renders it when allowed", () => {
    const { rerender } = render(
      <ShiftSummary
        {...summaryProps}
        countedCashMinor="260000"
        status="closed"
        varianceMinor="-5000"
      />,
    );

    expect(screen.getByText("Penjualan tunai")).toBeVisible();
    expect(screen.getByText("Kas fisik")).toBeVisible();
    expect(screen.queryByText("Selisih kas")).not.toBeInTheDocument();

    rerender(
      <ShiftSummary
        {...summaryProps}
        canViewVariance
        countedCashMinor="260000"
        status="closed"
        varianceMinor="-5000"
      />,
    );

    expect(screen.getByText("Selisih kas")).toBeVisible();
    expect(screen.getByText("-Rp5.000")).toBeVisible();
  });
});

describe("CloseShiftForm", () => {
  it("requires counted cash and only asks for a reason when a variance exists", async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<CloseShiftHarness onSubmit={onSubmit} />);

    const closeButton = screen.getByRole("button", { name: "Tutup shift" });
    expect(closeButton).toBeDisabled();
    expect(screen.getByText("Isi kas fisik.")).toBeVisible();
    expect(screen.queryByRole("textbox", { name: /Alasan selisih/ })).not.toBeInTheDocument();
    expect(screen.getAllByText("Kas seharusnya")).toHaveLength(1);

    fireEvent.change(screen.getByRole("textbox", { name: /Kas fisik/ }), {
      target: { value: "Rp260.000" },
    });

    expect(screen.getByText("Selisih · Perlu alasan")).toBeVisible();
    expect(screen.getByText("-Rp5.000")).toBeVisible();
    expect(screen.getByText("Isi alasan selisih.")).toBeVisible();
    expect(closeButton).toBeDisabled();

    await user.type(screen.getByRole("textbox", { name: /Alasan selisih/ }), "Kas kecil terpakai");
    expect(closeButton).toBeEnabled();
    await user.click(closeButton);
    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it("accepts a balanced count without a reason", () => {
    render(<CloseShiftHarness />);

    fireEvent.change(screen.getByRole("textbox", { name: /Kas fisik/ }), {
      target: { value: "Rp265.000" },
    });

    expect(screen.getByText("Selisih · Cocok")).toBeVisible();
    expect(screen.queryByRole("textbox", { name: /Alasan selisih/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tutup shift" })).toBeEnabled();
  });

  it("does not create extra editable context fields", () => {
    render(<CloseShiftHarness />);

    expect(screen.getAllByRole("textbox")).toHaveLength(1);
    expect(screen.queryByLabelText(/Kas seharusnya/)).not.toBeInTheDocument();
  });

  it("passes axe smoke tests", async () => {
    const { container } = render(
      <main>
        <ShiftSummary
          {...summaryProps}
          nonCashBreakdown={[{ amountMinor: "75000", id: "qris", label: "QRIS merchant" }]}
          status="active"
        />
        <CloseShiftHarness />
      </main>,
    );

    expect((await axe(container)).violations).toEqual([]);
  });
});
