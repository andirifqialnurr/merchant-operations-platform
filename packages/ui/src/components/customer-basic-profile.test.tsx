import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import {
  CustomerBasicProfile,
  type CustomerBasicItem,
  type CustomerBasicProfileLabels,
} from "./customer-basic-profile";

const labels: CustomerBasicProfileLabels = {
  empty: "Belum ada pelanggan yang cocok.",
  region: "Hasil pencarian pelanggan",
  select: "Pilih",
  selected: "Terpilih",
};

const items: CustomerBasicItem[] = [
  {
    contactLabel: "•••• 7890",
    displayName: "Ayu",
    id: "customer-internal-01",
    noteLabel: "Oat milk",
    visitLabel: "3 kunjungan",
  },
  { displayName: "Budi", id: "customer-internal-02", selected: true },
];

describe("CustomerBasicProfile", () => {
  it("lists customers with what tells them apart, without their ids", async () => {
    const { container } = render(<CustomerBasicProfile items={items} labels={labels} />);
    const list = screen.getByRole("region", { name: "Hasil pencarian pelanggan" });
    expect(list).toHaveTextContent("Ayu");
    expect(screen.getByText("•••• 7890 · 3 kunjungan")).toBeVisible();
    expect(screen.getByText("Oat milk")).toBeVisible();
    expect(list).not.toHaveTextContent("customer-internal");
    // Without a handler there is nothing to press.
    expect(screen.queryByRole("button")).toBeNull();
    expect((await axe(container)).violations).toEqual([]);
  });

  it("chooses a customer by their hidden id", async () => {
    const onSelect = vi.fn();
    render(<CustomerBasicProfile items={items} labels={labels} onSelectCustomer={onSelect} />);
    await userEvent.click(screen.getAllByRole("button", { name: "Pilih" })[0]!);
    expect(onSelect).toHaveBeenCalledWith("customer-internal-01");
    expect(screen.getByRole("button", { name: "Terpilih" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("says so when nobody matches, and can be disabled while saving", () => {
    const { rerender } = render(<CustomerBasicProfile items={[]} labels={labels} />);
    expect(screen.getByText("Belum ada pelanggan yang cocok.")).toBeVisible();
    rerender(
      <CustomerBasicProfile disabled items={items} labels={labels} onSelectCustomer={vi.fn()} />,
    );
    for (const button of screen.getAllByRole("button")) expect(button).toBeDisabled();
  });
});
