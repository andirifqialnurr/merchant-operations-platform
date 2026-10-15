import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import {
  clampTableLayoutPosition,
  doTableLayoutItemsOverlap,
  getTableLayoutOverlapIssues,
  snapTableLayoutPosition,
  TableLayoutCanvas,
  type TableLayoutCanvasItem,
  type TableLayoutCanvasLabels,
} from "./table-layout-canvas";

const labels: TableLayoutCanvasLabels = {
  canvas: "Canvas layout meja",
  moveDown: "Pindahkan meja ke bawah",
  moveGroup: "Pindahkan meja terpilih",
  moveLeft: "Pindahkan meja ke kiri",
  moveRight: "Pindahkan meja ke kanan",
  moveUp: "Pindahkan meja ke atas",
  overlap: (first, second) => `${first} bertumpuk dengan ${second}.`,
  position: (label, column, row, overlapping) =>
    `${label}, posisi kolom ${column}, baris ${row}${overlapping ? ", bertumpuk" : ""}`,
  validationTitle: "Layout perlu diperiksa",
};

const items: readonly TableLayoutCanvasItem[] = [
  { gridH: 2, gridW: 2, gridX: 0, gridY: 0, id: "table-internal-1", label: "Meja 01" },
  {
    gridH: 2,
    gridW: 3,
    gridX: 4,
    gridY: 2,
    id: "table-internal-2",
    label: "Meja 02",
    metrics: [{ kind: "guests", label: "4 tamu", text: "4" }],
    shape: "rectangle",
    state: "occupied",
    stateLabel: "Terisi",
  },
  {
    gridH: 2,
    gridW: 2,
    gridX: 8,
    gridY: 4,
    id: "table-internal-3",
    label: "Meja servis",
    state: "disabled",
  },
] as const;

describe("TableLayoutCanvas", () => {
  it("renders table tiles on a logical grid without exposing internal ids", async () => {
    const onSelectItem = vi.fn();
    const user = userEvent.setup();

    render(
      <TableLayoutCanvas
        labels={labels}
        columns={12}
        items={items}
        onSelectItem={onSelectItem}
        rows={8}
        selectedId="table-internal-2"
        variant="compact"
      />,
    );

    expect(screen.getByRole("group", { name: "Canvas layout meja" })).toBeVisible();
    // Out of edit mode a table names itself with its status, not its place.
    expect(screen.getByRole("button", { name: "Meja 01" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Meja 02, Terisi, 4 tamu" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getAllByRole("button", { name: /Meja 02/ })).toHaveLength(1);
    expect(screen.queryByText(/table-internal/)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Meja 02, Terisi, 4 tamu" }));
    expect(onSelectItem).toHaveBeenCalledWith("table-internal-2");
  });

  it("keeps disabled service tables read-only in view mode and selectable in edit mode", async () => {
    const onSelectItem = vi.fn();
    const user = userEvent.setup();
    const { rerender } = render(
      <TableLayoutCanvas
        labels={labels}
        columns={12}
        items={items}
        onSelectItem={onSelectItem}
        rows={8}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Meja servis" }));
    expect(screen.getByRole("button", { name: "Meja servis" })).toBeDisabled();
    expect(onSelectItem).not.toHaveBeenCalled();

    rerender(
      <TableLayoutCanvas
        labels={labels}
        columns={12}
        items={items}
        mode="edit"
        onSelectItem={onSelectItem}
        rows={8}
      />,
    );
    const editTile = screen.getByRole("button", { name: "Meja servis, posisi kolom 9, baris 5" });
    expect(editTile).not.toBeDisabled();
    await user.click(editTile);
    expect(onSelectItem).toHaveBeenCalledWith("table-internal-3");
  });

  it("snaps pixel movement to integer grid coordinates and clamps to canvas bounds", () => {
    expect(
      snapTableLayoutPosition(
        { gridH: 2, gridW: 3, gridX: 4, gridY: 2 },
        { x: 73, y: -50 },
        { cellSize: 48, columns: 12, rows: 8 },
      ),
    ).toEqual({ gridH: 2, gridW: 3, gridX: 6, gridY: 1 });

    expect(
      snapTableLayoutPosition(
        { gridH: 2, gridW: 3, gridX: 10, gridY: 7 },
        { x: 400, y: 400 },
        { cellSize: 48, columns: 12, rows: 8 },
      ),
    ).toEqual({ gridH: 2, gridW: 3, gridX: 9, gridY: 6 });
  });

  it("clamps negative coordinates without changing the table size", () => {
    expect(
      clampTableLayoutPosition(
        { gridH: 2, gridW: 2, gridX: -4, gridY: -1 },
        { columns: 8, rows: 6 },
      ),
    ).toEqual({ gridH: 2, gridW: 2, gridX: 0, gridY: 0 });
  });

  it("detects overlap issues without exposing internal ids", () => {
    expect(
      doTableLayoutItemsOverlap(
        { gridH: 2, gridW: 2, gridX: 0, gridY: 0 },
        { gridH: 2, gridW: 2, gridX: 1, gridY: 1 },
      ),
    ).toBe(true);
    expect(getTableLayoutOverlapIssues(items)).toEqual([]);

    render(
      <TableLayoutCanvas
        labels={labels}
        columns={12}
        items={[
          { gridH: 2, gridW: 2, gridX: 0, gridY: 0, id: "table-a", label: "Meja A" },
          { gridH: 2, gridW: 2, gridX: 1, gridY: 1, id: "table-b", label: "Meja B" },
        ]}
        mode="edit"
        rows={8}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent("Meja A bertumpuk dengan Meja B.");
    expect(screen.queryByText(/table-a|table-b/)).not.toBeInTheDocument();
  });

  it("moves the selected table with keyboard alternative controls and arrow keys", async () => {
    const onItemMove = vi.fn();
    const user = userEvent.setup();

    render(
      <TableLayoutCanvas
        labels={labels}
        columns={12}
        items={items}
        mode="edit"
        onItemMove={onItemMove}
        rows={8}
        selectedId="table-internal-2"
      />,
    );

    await user.click(screen.getByRole("button", { name: "Pindahkan meja ke kanan" }));
    expect(onItemMove).toHaveBeenLastCalledWith("table-internal-2", {
      gridH: 2,
      gridW: 3,
      gridX: 5,
      gridY: 2,
    });

    fireEvent.keyDown(screen.getByRole("button", { name: "Meja 02, posisi kolom 5, baris 3" }), {
      key: "ArrowUp",
    });
    expect(onItemMove).toHaveBeenLastCalledWith("table-internal-2", {
      gridH: 2,
      gridW: 3,
      gridX: 4,
      gridY: 1,
    });
  });

  it("rejects malformed or out-of-bounds layout data", () => {
    expect(() =>
      render(<TableLayoutCanvas labels={labels} columns={0} items={[]} rows={8} />),
    ).toThrow(/kolom/);
    expect(() =>
      render(
        <TableLayoutCanvas
          labels={labels}
          columns={12}
          items={[{ gridH: 2, gridW: 2, gridX: 11, gridY: 0, id: "table-a", label: "Meja A" }]}
          rows={8}
        />,
      ),
    ).toThrow(/batas canvas/);
    expect(() =>
      render(
        <TableLayoutCanvas
          labels={labels}
          columns={12}
          items={[
            { gridH: 2, gridW: 2, gridX: 0, gridY: 0, id: "table-a", label: "Meja A" },
            { gridH: 2, gridW: 2, gridX: 2, gridY: 0, id: "table-a", label: "Meja B" },
          ]}
          rows={8}
        />,
      ),
    ).toThrow(/duplikat/);
  });

  it("passes an axe smoke test", async () => {
    const { container } = render(
      <TableLayoutCanvas
        labels={labels}
        columns={12}
        items={items}
        mode="edit"
        rows={8}
        selectedId="table-internal-2"
      />,
    );

    expect((await axe(container)).violations).toEqual([]);
  });
});
