import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import { TableTile } from "./table-tile";

const guests = (count: number) => ({
  kind: "guests" as const,
  label: `${count} tamu`,
  text: String(count),
});
const orders = (count: number) => ({
  kind: "orders" as const,
  label: `${count} order`,
  text: String(count),
});
const duration = (text: string, label: string) => ({ kind: "duration" as const, label, text });

describe("TableTile", () => {
  it("shows one table identity, status, and applicable service metrics in view mode", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();

    render(
      <TableTile
        label="Meja 12"
        metrics={[guests(4), orders(2), duration("1j 15m", "1 jam 15 menit")]}
        onClick={onClick}
        selected
        state="occupied"
        stateLabel="Terisi"
      />,
    );

    const tile = screen.getByRole("button", {
      name: "Meja 12, Terisi, 4 tamu, 2 order, 1 jam 15 menit",
    });
    expect(tile).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Terisi")).toBeVisible();
    expect(screen.getByLabelText("4 tamu")).toBeVisible();
    expect(screen.getByLabelText("2 order")).toBeVisible();
    expect(screen.getByLabelText("1 jam 15 menit")).toBeVisible();

    await user.click(tile);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("has no words of its own: without a status label it shows only the table", () => {
    render(<TableTile label="Meja 2" state="occupied" />);

    expect(screen.getByRole("button", { name: "Meja 2" })).toBeVisible();
    expect(screen.queryByText("Terisi")).not.toBeInTheDocument();
  });

  it("hides service metrics for tables not being served", () => {
    const { rerender } = render(
      <TableTile label="Meja 3" metrics={[guests(2)]} stateLabel="Tersedia" />,
    );

    expect(screen.getByRole("button", { name: "Meja 3, Tersedia" })).toBeVisible();
    expect(screen.queryByLabelText("2 tamu")).not.toBeInTheDocument();

    rerender(
      <TableTile label="Meja 4" metrics={[orders(1)]} state="reserved" stateLabel="Reservasi" />,
    );
    expect(screen.getByRole("button", { name: "Meja 4, Reservasi" })).toBeVisible();
    expect(screen.queryByLabelText("1 order")).not.toBeInTheDocument();
  });

  it("keeps edit mode to the table itself, naming only a table set aside", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();

    const { rerender } = render(
      <TableTile
        label="Meja Patio"
        metrics={[guests(3)]}
        mode="edit"
        onClick={onClick}
        selected
        state="waiting-order"
        stateLabel="Menunggu konfirmasi"
      />,
    );

    const tile = screen.getByRole("button", { name: "Meja Patio" });
    expect(tile).toHaveClass("ui-table-tile--edit", "is-selected");
    expect(screen.queryByText("Menunggu konfirmasi")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("3 tamu")).not.toBeInTheDocument();

    await user.click(tile);
    expect(onClick).toHaveBeenCalledOnce();

    rerender(<TableTile label="Meja Gudang" mode="edit" state="disabled" stateLabel="Nonaktif" />);
    expect(screen.getByRole("button", { name: "Meja Gudang, Nonaktif" })).toBeVisible();
  });

  it("keeps tables set aside disabled in view mode but selectable in edit mode", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const { rerender } = render(
      <TableTile label="Meja Gudang" onClick={onClick} state="disabled" stateLabel="Nonaktif" />,
    );

    await user.click(screen.getByRole("button", { name: "Meja Gudang, Nonaktif" }));
    expect(screen.getByRole("button", { name: "Meja Gudang, Nonaktif" })).toBeDisabled();
    expect(onClick).not.toHaveBeenCalled();

    rerender(
      <TableTile
        label="Meja Gudang"
        mode="edit"
        onClick={onClick}
        state="disabled"
        stateLabel="Nonaktif"
      />,
    );
    const editableTile = screen.getByRole("button", { name: "Meja Gudang, Nonaktif" });
    expect(editableTile).not.toBeDisabled();
    await user.click(editableTile);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("draws the table and one chair per seat, hidden from assistive technology", () => {
    const { container } = render(
      <TableTile
        capacity={6}
        footprint={{ height: 2, width: 4 }}
        label="Meja 5"
        mode="edit"
        shape="rectangle"
      />,
    );

    const drawing = container.querySelector("svg.ui-table-shape--rectangle");
    expect(drawing).toHaveAttribute("aria-hidden", "true");
    expect(container.querySelectorAll(".ui-table-shape__chair")).toHaveLength(6);
    expect(screen.getByRole("button", { name: "Meja 5" })).toHaveClass("ui-table-tile--shaped");
  });

  it("rejects malformed visible or numeric data", () => {
    expect(() => render(<TableTile label="" />)).toThrow(/label meja/);
    expect(() => render(<TableTile capacity={-1} label="Meja 1" />)).toThrow(/Kapasitas/);
    expect(() =>
      render(<TableTile label="Meja 1" metrics={[{ kind: "guests", label: "", text: "2" }]} />),
    ).toThrow(/Metrik/);
  });

  it("passes an axe smoke test", async () => {
    const { container } = render(
      <div>
        <TableTile label="Meja 1" state="available" stateLabel="Tersedia" />
        <TableTile
          label="Meja 2"
          metrics={[guests(2), orders(1)]}
          state="waiting-payment"
          stateLabel="Menunggu pembayaran"
        />
        <TableTile
          capacity={4}
          label="Meja servis"
          mode="edit"
          selected
          shape="round"
          state="disabled"
          stateLabel="Nonaktif"
        />
      </div>,
    );

    expect((await axe(container)).violations).toEqual([]);
  });
});
