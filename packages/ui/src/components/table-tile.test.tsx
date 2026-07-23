import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import { TableTile } from "./table-tile";

describe("TableTile", () => {
  it("shows one table identity, status, and applicable service metrics in view mode", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();

    render(
      <TableTile
        durationMinutes={75}
        guestCount={4}
        label="Meja 12"
        onClick={onClick}
        orderCount={2}
        selected
        state="occupied"
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

  it("omits unavailable metrics instead of inventing zero values", () => {
    render(<TableTile label="Meja 2" state="occupied" />);

    expect(screen.getByRole("button", { name: "Meja 2, Terisi" })).toBeVisible();
    expect(screen.queryByText("0")).not.toBeInTheDocument();
    expect(screen.queryByText(/mnt/)).not.toBeInTheDocument();
  });

  it("hides inapplicable service metrics for available, reserved, and disabled tables", () => {
    const { rerender } = render(
      <TableTile durationMinutes={12} guestCount={2} label="Meja 3" orderCount={1} />,
    );

    expect(screen.getByRole("button", { name: "Meja 3, Tersedia" })).toBeVisible();
    expect(screen.queryByLabelText("2 tamu")).not.toBeInTheDocument();

    rerender(
      <TableTile
        durationMinutes={12}
        guestCount={2}
        label="Meja 4"
        orderCount={1}
        state="reserved"
      />,
    );
    expect(screen.getByRole("button", { name: "Meja 4, Reservasi" })).toBeVisible();
    expect(screen.queryByLabelText("1 order")).not.toBeInTheDocument();
  });

  it("keeps edit mode focused on table identity, status, and selection only", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();

    render(
      <TableTile
        durationMinutes={8}
        guestCount={3}
        label="Meja Patio"
        mode="edit"
        onClick={onClick}
        orderCount={1}
        selected
        state="waiting-order"
      />,
    );

    const tile = screen.getByRole("button", { name: "Meja Patio, Menunggu konfirmasi" });
    expect(tile).toHaveClass("ui-table-tile--edit", "is-selected");
    expect(screen.getByText("Menunggu konfirmasi")).toBeVisible();
    expect(screen.queryByLabelText("3 tamu")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("1 order")).not.toBeInTheDocument();
    expect(screen.queryByText(/mnt/)).not.toBeInTheDocument();

    await user.click(tile);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("keeps non-service tables disabled in view mode but selectable in edit mode", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const { rerender } = render(
      <TableTile label="Meja Gudang" onClick={onClick} state="disabled" />,
    );

    await user.click(screen.getByRole("button", { name: "Meja Gudang, Nonaktif" }));
    expect(screen.getByRole("button", { name: "Meja Gudang, Nonaktif" })).toBeDisabled();
    expect(onClick).not.toHaveBeenCalled();

    rerender(<TableTile label="Meja Gudang" mode="edit" onClick={onClick} state="disabled" />);
    const editableTile = screen.getByRole("button", { name: "Meja Gudang, Nonaktif" });
    expect(editableTile).not.toBeDisabled();
    await user.click(editableTile);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("renders explicit zero metrics when the table state can own service context", () => {
    render(
      <TableTile
        durationMinutes={0}
        guestCount={0}
        label="Meja Tunggu"
        orderCount={0}
        state="needs-service"
      />,
    );

    expect(screen.getByLabelText("0 tamu")).toBeVisible();
    expect(screen.getByLabelText("0 order")).toBeVisible();
    expect(screen.getByLabelText("0 menit")).toBeVisible();
  });

  it("rejects malformed visible or numeric data", () => {
    expect(() => render(<TableTile label="" />)).toThrow(/label meja/);
    expect(() => render(<TableTile guestCount={-1} label="Meja 1" />)).toThrow(/Jumlah tamu/);
    expect(() => render(<TableTile label="Meja 1" orderCount={1.5} />)).toThrow(/Jumlah order/);
    expect(() =>
      render(<TableTile durationMinutes={Number.MAX_SAFE_INTEGER + 1} label="Meja 1" />),
    ).toThrow(/Durasi meja/);
  });

  it("passes an axe smoke test", async () => {
    const { container } = render(
      <div>
        <TableTile label="Meja 1" state="available" />
        <TableTile
          durationMinutes={23}
          guestCount={2}
          label="Meja 2"
          orderCount={1}
          state="waiting-payment"
        />
        <TableTile label="Meja servis" mode="edit" selected state="disabled" />
      </div>,
    );

    expect((await axe(container)).violations).toEqual([]);
  });
});
