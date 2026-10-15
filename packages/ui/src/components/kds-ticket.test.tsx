import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import { KdsConnectionStatus, KdsTicket, type KdsTicketItem } from "./kds-ticket";

const items: KdsTicketItem[] = [
  {
    allergyNote: "kacang",
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

/** A new ticket from the cashier, with every label a caller must give. */
const ticket = {
  allergyLabel: "Alergi",
  elapsedLabel: "08:12",
  items,
  label: "Ticket A-014",
  orderLabel: "A-014",
  sourceLabel: "Kasir",
  status: "new",
  statusLabel: "Baru",
  timerLabel: "Menunggu",
} as const;

describe("KdsTicket", () => {
  it("shows the connection banner in the caller's words, with an optional refresh", async () => {
    const onAction = vi.fn();
    const user = userEvent.setup();
    const { rerender } = render(
      <KdsConnectionStatus
        message="Ticket di layar mungkin belum terbaru."
        state="reconnecting"
        title="Menyambung ulang…"
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent("Menyambung ulang…");
    expect(screen.getByText("Ticket di layar mungkin belum terbaru.")).toBeVisible();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();

    rerender(
      <KdsConnectionStatus
        action={{ label: "Muat ulang", onAction }}
        message="Data may be out of date."
        state="offline"
        title="Offline"
      />,
    );
    await user.click(screen.getByRole("button", { name: "Muat ulang" }));
    expect(onAction).toHaveBeenCalledOnce();
    expect(screen.getByRole("status")).toHaveClass("ui-kds-connection-status--offline");
  });

  it("rejects payment, HPP, customer, and token data before KDS render", () => {
    expect(() =>
      render(
        <KdsTicket
          {...({
            ...ticket,
            paymentTotalLabel: "Rp120.000",
          } as Parameters<typeof KdsTicket>[0] & { paymentTotalLabel: string })}
        />,
      ),
    ).toThrow(/paymentTotalLabel/);
    expect(() =>
      render(
        <KdsTicket
          {...({
            ...ticket,
            items: [{ hppAmount: 12_000, name: "Nasi goreng", quantity: 1 }],
          } as Parameters<typeof KdsTicket>[0] & {
            items: Array<KdsTicketItem & { hppAmount: number }>;
          })}
        />,
      ),
    ).toThrow(/hppAmount/);
    expect(() =>
      render(
        <KdsConnectionStatus
          {...({
            message: "Data mungkin usang.",
            retryToken: "retry-secret",
            state: "reconnecting",
            title: "Menyambung ulang…",
          } as Parameters<typeof KdsConnectionStatus>[0] & { retryToken: string })}
        />,
      ),
    ).toThrow(/retryToken/);
  });

  it("shows what to prepare, in the words it was given", () => {
    render(<KdsTicket {...ticket} tableLabel="Meja 4" />);

    const article = screen.getByRole("article", { name: "Ticket A-014" });
    expect(article).toHaveTextContent("A-014");
    expect(article).toHaveTextContent("Meja 4");
    expect(article).toHaveTextContent("Baru");
    expect(article).toHaveTextContent("Kasir");
    expect(screen.getByLabelText("Menunggu 08:12")).toBeInTheDocument();
    expect(screen.getByText("Nasi goreng kampung")).toBeInTheDocument();
    expect(screen.getByText("Tidak pedas")).toBeInTheDocument();
    expect(screen.getByText("Bawang goreng dipisah")).toBeInTheDocument();
    // The allergy note is announced as one, by a word and not by color alone.
    expect(screen.getByText("Alergi")).toBeInTheDocument();
    expect(article).toHaveTextContent("Alergi kacang");
  });

  it("adds no words of its own: another language changes every label", () => {
    render(
      <KdsTicket
        {...ticket}
        action={{ label: "Accept", onAction: () => undefined }}
        allergyLabel="Allergy"
        label="Ticket A-014"
        sourceLabel="Cashier"
        statusLabel="New"
        timerLabel="Waiting"
      />,
    );
    const article = screen.getByRole("article");
    for (const word of ["Baru", "Kasir", "Terima", "Menunggu", "Pesanan", "Siap"]) {
      expect(article).not.toHaveTextContent(word);
    }
    expect(screen.getByRole("button", { name: "Accept" })).toBeInTheDocument();
    expect(screen.getByLabelText("Waiting 08:12")).toBeInTheDocument();
  });

  it("has one button, for the step it was given, and locks it while busy", async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    const { rerender } = render(<KdsTicket {...ticket} action={{ label: "Terima", onAction }} />);

    expect(screen.getAllByRole("button")).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: "Terima" }));
    expect(onAction).toHaveBeenCalledTimes(1);

    rerender(<KdsTicket {...ticket} action={{ busy: true, label: "Terima", onAction }} />);
    const busy = screen.getByRole("button", { name: "Terima" });
    expect(busy).toBeDisabled();
    expect(busy).toHaveAttribute("aria-busy", "true");
    await user.click(busy);
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it("has no button without an action, when finished, or as history", () => {
    const action = { label: "Terima", onAction: () => undefined };
    const { rerender } = render(<KdsTicket {...ticket} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();

    rerender(<KdsTicket {...ticket} action={action} status="served" statusLabel="Disajikan" />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();

    rerender(<KdsTicket {...ticket} action={action} status="canceled" statusLabel="Batal" />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByRole("article")).toHaveClass("ui-kds-ticket--cancelled");

    rerender(<KdsTicket {...ticket} action={action} variant="history" />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("has a kiosk size for a kitchen monitor, keeping its one action", () => {
    render(
      <KdsTicket
        {...ticket}
        action={{ label: "Terima", onAction: () => undefined }}
        size="kiosk"
        variant="touch"
      />,
    );
    expect(screen.getByRole("article")).toHaveClass("ui-kds-ticket--kiosk");
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });

  it("rings a ticket that just arrived, and not one that is finished", () => {
    const { rerender } = render(<KdsTicket {...ticket} highlighted />);
    expect(screen.getByRole("article")).toHaveClass("ui-kds-ticket--highlighted");

    rerender(<KdsTicket {...ticket} highlighted status="served" statusLabel="Disajikan" />);
    expect(screen.getByRole("article")).not.toHaveClass("ui-kds-ticket--highlighted");
  });

  it("marks a long wait while the ticket is open, and not once it is finished", () => {
    const { rerender } = render(<KdsTicket {...ticket} timerTone="warning" />);
    expect(screen.getByRole("article")).toHaveClass("ui-kds-ticket--sla-warning");

    rerender(<KdsTicket {...ticket} timerTone="late" />);
    expect(screen.getByRole("article")).toHaveClass("ui-kds-ticket--sla-breached");

    rerender(<KdsTicket {...ticket} status="served" statusLabel="Disajikan" timerTone="late" />);
    expect(screen.getByRole("article")).not.toHaveClass("ui-kds-ticket--sla-breached");
  });

  it("supports sm, md, and lg sizes and the touch variant", () => {
    const { rerender } = render(<KdsTicket {...ticket} size="sm" />);
    expect(screen.getByRole("article")).toHaveClass("ui-kds-ticket--sm");
    rerender(<KdsTicket {...ticket} />);
    expect(screen.getByRole("article")).toHaveClass("ui-kds-ticket--md", "ui-kds-ticket--default");
    rerender(<KdsTicket {...ticket} size="lg" variant="touch" />);
    expect(screen.getByRole("article")).toHaveClass("ui-kds-ticket--lg", "ui-kds-ticket--touch");
  });

  it("rejects malformed ticket data", () => {
    const broken = (props: Partial<Parameters<typeof KdsTicket>[0]>) => () =>
      render(<KdsTicket {...ticket} {...props} />);

    expect(broken({ orderLabel: " " })).toThrow(/orderLabel/);
    expect(broken({ statusLabel: "" })).toThrow(/statusLabel/);
    expect(broken({ allergyLabel: " " })).toThrow(/allergyLabel/);
    expect(broken({ tableLabel: " " })).toThrow(/tableLabel/);
    expect(broken({ items: [] })).toThrow(/at least one item/);
    expect(broken({ items: [{ name: "Latte", quantity: 0 }] })).toThrow(/quantity/);
    expect(broken({ items: [{ name: " ", quantity: 1 }] })).toThrow(/name/);
    expect(broken({ items: [{ modifiers: [" "], name: "Latte", quantity: 1 }] })).toThrow(
      /modifier/,
    );
    expect(broken({ action: { label: " ", onAction: () => undefined } })).toThrow(/action label/);
  });

  it("passes an axe smoke test", async () => {
    const { container } = render(
      <KdsTicket
        {...ticket}
        action={{ label: "Terima", onAction: () => undefined }}
        tableLabel="Meja 4"
        timerTone="warning"
      />,
    );
    expect((await axe(container)).violations).toEqual([]);
  });
});
