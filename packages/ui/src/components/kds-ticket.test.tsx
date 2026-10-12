import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import {
  KdsConnectionStatus,
  KdsNewTicketAlert,
  KdsTicket,
  type KdsTicketItem,
} from "./kds-ticket";

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
  it("renders new-ticket visual and audio state without exposing internal alert data", () => {
    render(
      <KdsNewTicketAlert
        alertId="alert-internal-01"
        audioState="ready"
        count={3}
        message="Pesanan baru masuk ke antrean dapur."
        tone="urgent"
      />,
    );

    expect(screen.getByRole("status", { name: "Alert ticket baru KDS" })).toBeVisible();
    expect(screen.getByText("3 ticket baru")).toBeVisible();
    expect(screen.getByText("Pesanan baru masuk ke antrean dapur.")).toBeVisible();
    expect(screen.getByText("Audio siap")).toBeVisible();
    expect(screen.getByRole("status")).toHaveClass("ui-kds-new-ticket-alert--urgent");
    expect(
      screen.queryByText(/alert-internal|sound|audio-url|ticket-|payment|hpp|telepon/i),
    ).not.toBeInTheDocument();
  });

  it("calls alert actions with hidden alert id", async () => {
    const onAcknowledge = vi.fn();
    const onEnableAudio = vi.fn();
    const user = userEvent.setup();

    render(
      <KdsNewTicketAlert
        alertId="alert-internal-02"
        audioState="blocked"
        count={1}
        onAcknowledge={onAcknowledge}
        onEnableAudio={onEnableAudio}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Aktifkan audio" }));
    await user.click(screen.getByRole("button", { name: "Tandai dilihat" }));
    expect(onEnableAudio).toHaveBeenCalledWith("alert-internal-02");
    expect(onAcknowledge).toHaveBeenCalledWith("alert-internal-02");
    expect(screen.queryByText("alert-internal-02")).not.toBeInTheDocument();
  });

  it("renders reconnect and refetch state without exposing connection internals", () => {
    render(
      <KdsConnectionStatus
        lastSyncedLabel="Sinkron 20:15"
        pendingCount={2}
        state="stale"
        statusId="connection-internal-01"
      />,
    );

    expect(screen.getByRole("region", { name: "Status koneksi KDS" })).toBeVisible();
    expect(screen.getByText("Perlu refresh")).toBeVisible();
    expect(screen.getByText("Sinkron 20:15")).toBeVisible();
    expect(screen.getByText("2 ticket menunggu sinkron")).toBeVisible();
    expect(screen.getByRole("button", { name: "Reconnect" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Refresh" })).toBeDisabled();
    expect(
      screen.queryByText(/connection-internal|namespace|socket|event|token|payment|hpp/i),
    ).not.toBeInTheDocument();
  });

  it("calls reconnect and refetch actions with hidden status id", async () => {
    const onReconnect = vi.fn();
    const onRefetch = vi.fn();
    const user = userEvent.setup();

    render(
      <KdsConnectionStatus
        canReconnect
        canRefetch
        onReconnect={onReconnect}
        onRefetch={onRefetch}
        state="disconnected"
        statusId="connection-internal-02"
      />,
    );

    await user.click(screen.getByRole("button", { name: "Reconnect" }));
    await user.click(screen.getByRole("button", { name: "Refresh" }));
    expect(onReconnect).toHaveBeenCalledWith("connection-internal-02");
    expect(onRefetch).toHaveBeenCalledWith("connection-internal-02");
    expect(screen.queryByText("connection-internal-02")).not.toBeInTheDocument();
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
        <KdsNewTicketAlert
          {...({
            alertId: "alert-sensitive",
            audioState: "ready",
            count: 1,
            customerPhone: "081234567890",
          } as Parameters<typeof KdsNewTicketAlert>[0] & { customerPhone: string })}
        />,
      ),
    ).toThrow(/customerPhone/);
    expect(() =>
      render(
        <KdsConnectionStatus
          {...({
            retryToken: "retry-secret",
            state: "connected",
            statusId: "connection-sensitive",
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
