import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import { KdsTicket, type KdsTicketItem } from "./kds-ticket";

const items: KdsTicketItem[] = [
  {
    allergyNote: "Alergi kacang",
    modifiers: ["Tidak pedas", "Tambah telur"],
    name: "Nasi goreng kampung",
    note: "Bawang goreng dipisah",
    quantity: 2,
  },
  {
    name: "Es teh tawar",
    quantity: 1,
  },
];

describe("KdsTicket", () => {
  it("renders kitchen read model without payment, price, or internal identifiers", () => {
    render(
      <KdsTicket
        elapsedLabel="08:12"
        id="ticket-internal-01"
        items={items}
        orderLabel="Order A-014"
        sourceLabel="QR meja"
        status="new"
        tableLabel="Meja 05"
      />,
    );

    expect(screen.getByRole("article", { name: "Kitchen ticket Order A-014" })).toBeVisible();
    expect(screen.getByText("Order A-014")).toBeVisible();
    expect(screen.getByText("Meja 05")).toBeVisible();
    expect(screen.getByText("Pesanan baru")).toBeVisible();
    expect(screen.getByText("08:12")).toBeVisible();
    expect(screen.getByText("Nasi goreng kampung")).toBeVisible();
    expect(screen.getByText("Tidak pedas")).toBeVisible();
    expect(screen.getByText("Bawang goreng dipisah")).toBeVisible();
    expect(screen.getByText("Alergi kacang")).toBeVisible();
    expect(
      screen.queryByText(/ticket-internal|Rp|harga|hpp|payment|telepon/i),
    ).not.toBeInTheDocument();
  });

  it("calls the primary action with hidden ticket id and derived action", async () => {
    const onPrimaryAction = vi.fn();
    const user = userEvent.setup();

    render(
      <KdsTicket
        elapsedLabel="02:01"
        id="ticket-internal-02"
        items={items}
        onPrimaryAction={onPrimaryAction}
        orderLabel="Order A-015"
        sourceLabel="POS kasir"
        status="ready"
        tableLabel="Meja 06"
      />,
    );

    await user.click(screen.getByRole("button", { name: "Tandai disajikan" }));
    expect(onPrimaryAction).toHaveBeenCalledWith("ticket-internal-02", "mark-served");
    expect(screen.queryByText("ticket-internal-02")).not.toBeInTheDocument();
  });

  it("supports sm, md, and lg sizes plus history read-only variant", () => {
    const { rerender } = render(
      <KdsTicket
        elapsedLabel="01:30"
        id="ticket-sm"
        items={items}
        orderLabel="Order A-016"
        size="sm"
        sourceLabel="Waiter"
        status="accepted"
      />,
    );

    expect(screen.getByRole("article")).toHaveClass("ui-kds-ticket--sm");
    expect(screen.getByRole("button", { name: "Siap disajikan" })).toBeDisabled();

    rerender(
      <KdsTicket
        elapsedLabel="12:44"
        id="ticket-md"
        items={items}
        orderLabel="Order A-017"
        size="md"
        sourceLabel="POS kasir"
        status="completed"
        variant="history"
      />,
    );

    expect(screen.getByRole("article")).toHaveClass("ui-kds-ticket--md");
    expect(screen.getByText("Selesai")).toBeVisible();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();

    rerender(
      <KdsTicket
        elapsedLabel="05:30"
        id="ticket-lg"
        items={items}
        orderLabel="Order A-018"
        size="lg"
        sourceLabel="QR meja"
        status="preparing"
        variant="touch"
      />,
    );

    expect(screen.getByRole("article")).toHaveClass("ui-kds-ticket--lg");
    expect(screen.getByRole("button", { name: "Siap disajikan" })).toBeDisabled();
  });

  it("rejects malformed ticket data", () => {
    expect(() =>
      render(
        <KdsTicket
          elapsedLabel="01:00"
          id=""
          items={items}
          orderLabel="Order A-019"
          sourceLabel="POS"
          status="new"
        />,
      ),
    ).toThrow(/id internal/);
    expect(() =>
      render(
        <KdsTicket
          elapsedLabel="01:00"
          id="ticket-a"
          items={[]}
          orderLabel="Order A-019"
          sourceLabel="POS"
          status="new"
        />,
      ),
    ).toThrow(/minimal satu item/);
    expect(() =>
      render(
        <KdsTicket
          elapsedLabel="01:00"
          id="ticket-a"
          items={[{ name: "Nasi goreng", quantity: 0 }]}
          orderLabel="Order A-019"
          sourceLabel="POS"
          status="new"
        />,
      ),
    ).toThrow(/Quantity item/);
  });

  it("passes an axe smoke test", async () => {
    const { container } = render(
      <KdsTicket
        elapsedLabel="08:12"
        id="ticket-internal-01"
        items={items}
        orderLabel="Order A-014"
        sourceLabel="QR meja"
        status="new"
        tableLabel="Meja 05"
      />,
    );
    expect((await axe(container)).violations).toEqual([]);
  });
});
