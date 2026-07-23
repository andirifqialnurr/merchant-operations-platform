import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import { CloseShiftForm, OpenShiftForm, ShiftSummary } from "./pos-shift";

function CloseShiftHarness({ onSubmit = () => undefined }: { onSubmit?: () => void }) {
  const [counted, setCounted] = useState<number | undefined>();
  const [reason, setReason] = useState("");

  return (
    <CloseShiftForm
      expectedCashMinor="265000"
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
  openedAtLabel: "23 Jul 2026, 08.00",
  openedBy: "Ayu Pratama",
  openingCashMinor: "50000",
} as const;

describe("OpenShiftForm", () => {
  it("only asks for the user-owned opening cash value", () => {
    render(
      <OpenShiftForm
        onOpeningCashChange={() => undefined}
        onSubmit={() => undefined}
        openingCashMinor={50_000}
      />,
    );

    expect(screen.getAllByRole("textbox")).toHaveLength(1);
    expect(screen.getByRole("textbox", { name: /Kas awal/ })).toBeVisible();
    expect(screen.queryByLabelText(/Outlet|Kasir|Waktu buka/)).not.toBeInTheDocument();
  });
});

describe("ShiftSummary", () => {
  it("omits closing-only and unavailable sections from an active shift", () => {
    render(<ShiftSummary {...summaryProps} status="active" />);

    expect(screen.getByText("Aktif")).toBeVisible();
    expect(screen.queryByText("Kas fisik dihitung")).not.toBeInTheDocument();
    expect(screen.queryByText("Selisih kas")).not.toBeInTheDocument();
    expect(screen.queryByText("Pembayaran non-tunai")).not.toBeInTheDocument();
    expect(screen.getAllByText("Kas seharusnya")).toHaveLength(1);
  });

  it("keeps variance permission-filtered and renders it with a textual state when allowed", () => {
    const { rerender } = render(
      <ShiftSummary
        {...summaryProps}
        closedAtLabel="23 Jul 2026, 17.10"
        closedBy="Ayu Pratama"
        countedCashMinor="260000"
        status="closed"
        varianceMinor="-5000"
      />,
    );

    expect(screen.getByText("Kas fisik dihitung")).toBeVisible();
    expect(screen.queryByText("Selisih kas")).not.toBeInTheDocument();

    rerender(
      <ShiftSummary
        {...summaryProps}
        closedAtLabel="23 Jul 2026, 17.10"
        closedBy="Ayu Pratama"
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
    expect(screen.getByText("Masukkan kas fisik yang dihitung.")).toBeVisible();
    expect(screen.queryByRole("textbox", { name: /Alasan selisih/ })).not.toBeInTheDocument();
    expect(screen.getAllByText("Kas seharusnya")).toHaveLength(1);

    fireEvent.change(screen.getByRole("textbox", { name: /Kas fisik dihitung/ }), {
      target: { value: "Rp260.000" },
    });

    expect(screen.getByText("Selisih kas · Perlu alasan")).toBeVisible();
    expect(screen.getByText("-Rp5.000")).toBeVisible();
    expect(screen.getByText("Alasan selisih wajib diisi.")).toBeVisible();
    expect(closeButton).toBeDisabled();

    await user.type(screen.getByRole("textbox", { name: /Alasan selisih/ }), "Kas kecil terpakai");
    expect(closeButton).toBeEnabled();
    await user.click(closeButton);
    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it("does not create extra editable context fields", () => {
    render(<CloseShiftHarness />);

    expect(
      screen.queryByLabelText(/Outlet|Kasir|Waktu tutup|Kas seharusnya/),
    ).not.toBeInTheDocument();
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
