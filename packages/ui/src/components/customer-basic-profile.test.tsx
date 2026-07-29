import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import { CustomerBasicProfile, type CustomerBasicItem } from "./customer-basic-profile";

const customers: readonly CustomerBasicItem[] = [
  {
    channelLabel: "QR meja",
    consentLabel: "Kontak boleh dipakai untuk struk",
    contactLabel: "WA **** 1890",
    displayName: "Ayu Prameswari",
    id: "cust-safe-01",
    lastVisitLabel: "Terakhir: hari ini",
    pointBalanceLabel: "120 poin",
    segmentLabel: "Regular",
    selected: true,
    status: "member",
    visitCountLabel: "12 kunjungan",
  },
  {
    channelLabel: "Walk-in",
    contactLabel: "Kontak disembunyikan",
    disabled: true,
    disabledReason: "Perlu konfirmasi staf",
    displayName: "Tamu Meja 05",
    id: "cust-safe-02",
    status: "guest",
  },
];

describe("CustomerBasicProfile", () => {
  it("renders basic customer read model without editable identity fields", () => {
    render(
      <CustomerBasicProfile
        items={customers}
        selectedSummaryLabel="1 customer dipilih"
        sourceLabel="Outlet Meruya"
        statusLabel="Customer Basic aktif"
      />,
    );

    expect(screen.getByRole("region", { name: "Customer Basic" })).toBeVisible();
    expect(screen.getByRole("listitem", { name: "Customer Ayu Prameswari" })).toBeVisible();
    expect(screen.getByText("WA **** 1890")).toBeVisible();
    expect(screen.getByText("Kontak boleh dipakai untuk struk")).toBeVisible();
    expect(screen.getByText("Regular")).toBeVisible();
    expect(screen.getByText("12 kunjungan")).toBeVisible();
    expect(screen.getByText("120 poin")).toBeVisible();
    expect(screen.getByText("Terakhir: hari ini")).toBeVisible();
    expect(screen.getByText("Customer Basic aktif")).toBeVisible();
    expect(screen.queryAllByRole("textbox")).toHaveLength(0);
    expect(
      screen.queryByText(/cust-safe|phone|email|address|order|payment|token|audit|internal/i),
    ).not.toBeInTheDocument();
  });

  it("calls selection actions with hidden ids only", async () => {
    const onClearSelection = vi.fn();
    const onSelectCustomer = vi.fn();
    const user = userEvent.setup();

    render(
      <CustomerBasicProfile
        items={customers}
        onClearSelection={onClearSelection}
        onSelectCustomer={onSelectCustomer}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Bersihkan" }));
    expect(onClearSelection).toHaveBeenCalledWith();

    await user.click(screen.getByRole("button", { name: "Terpilih" }));
    expect(onSelectCustomer).toHaveBeenCalledWith("cust-safe-01");
    expect(screen.getByRole("button", { name: "Pilih" })).toBeDisabled();
  });

  it("omits unavailable facts and keeps empty state read-only", () => {
    const { rerender } = render(
      <CustomerBasicProfile
        items={[{ displayName: "Rafi Nugraha", id: "cust-safe-03", status: "known" }]}
      />,
    );

    expect(screen.getByText("Rafi Nugraha")).toBeVisible();
    expect(screen.queryByText("Kontak")).not.toBeInTheDocument();
    expect(screen.queryByText("Consent")).not.toBeInTheDocument();

    rerender(<CustomerBasicProfile items={[]} />);
    expect(screen.getByText("Customer belum tersedia.")).toBeVisible();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("rejects raw contact, customer ids, order/payment data, and unknown actions", () => {
    expect(() =>
      render(
        <CustomerBasicProfile
          {...({
            items: [{ ...customers[0], phoneNumber: "081234567890" }],
          } as unknown as Parameters<typeof CustomerBasicProfile>[0])}
        />,
      ),
    ).toThrow(/phoneNumber/);

    expect(() =>
      render(
        <CustomerBasicProfile
          {...({
            items: [{ ...customers[0], customerId: "customer-internal-01" }],
          } as unknown as Parameters<typeof CustomerBasicProfile>[0])}
        />,
      ),
    ).toThrow(/customerId/);

    expect(() =>
      render(
        <CustomerBasicProfile
          {...({
            items: [{ ...customers[0], orderId: "order-internal-01" }],
          } as unknown as Parameters<typeof CustomerBasicProfile>[0])}
        />,
      ),
    ).toThrow(/orderId/);

    expect(() =>
      render(
        <CustomerBasicProfile
          {...({
            items: customers,
            onExportCustomer: () => undefined,
          } as Parameters<typeof CustomerBasicProfile>[0] & { onExportCustomer: () => void })}
        />,
      ),
    ).toThrow(/onExportCustomer/);
  });

  it("passes an axe smoke test", async () => {
    const { container } = render(<CustomerBasicProfile items={customers} />);

    expect((await axe(container)).violations).toEqual([]);
  });
});
