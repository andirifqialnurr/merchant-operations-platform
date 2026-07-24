import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import {
  TableLayoutPropertyPanel,
  type TableLayoutPropertyPanelItem,
  TableLayoutToolbar,
} from "./table-layout-tools";

const selectedItem: TableLayoutPropertyPanelItem = {
  gridH: 2,
  gridW: 3,
  gridX: 4,
  gridY: 1,
  id: "table-internal-02",
  label: "Meja 02",
};

describe("TableLayoutToolbar", () => {
  it("changes mode, tool, and snap preference without exposing internal layout metadata", async () => {
    const onModeChange = vi.fn();
    const onToolChange = vi.fn();
    const onSnapToGridChange = vi.fn();
    const user = userEvent.setup();

    render(
      <TableLayoutToolbar
        mode="view"
        onModeChange={onModeChange}
        onSnapToGridChange={onSnapToGridChange}
        onToolChange={onToolChange}
        snapToGrid
        tool="select"
      />,
    );

    await user.click(screen.getByRole("radio", { name: /Edit/ }));
    await user.click(screen.getByRole("button", { name: "Geser meja" }));
    await user.click(screen.getByRole("checkbox", { name: /Snap grid/ }));

    expect(onModeChange).toHaveBeenCalledWith("edit");
    expect(onToolChange).toHaveBeenCalledWith("move");
    expect(onSnapToGridChange).toHaveBeenCalledWith(false);
    expect(screen.queryByText(/table-internal/)).not.toBeInTheDocument();
  });

  it("passes an axe smoke test", async () => {
    const { container } = render(<TableLayoutToolbar mode="edit" tool="move" />);
    expect((await axe(container)).violations).toEqual([]);
  });
});

describe("TableLayoutPropertyPanel", () => {
  it("renders an empty state when no table is selected", () => {
    render(<TableLayoutPropertyPanel columns={14} rows={10} />);
    expect(screen.getByRole("status")).toHaveTextContent(
      "Pilih meja pada canvas untuk mengubah posisi.",
    );
  });

  it("updates only editable grid position and size for the selected table", async () => {
    const onItemChange = vi.fn();

    render(
      <TableLayoutPropertyPanel
        columns={14}
        item={selectedItem}
        onItemChange={onItemChange}
        rows={10}
      />,
    );

    expect(screen.getByRole("complementary", { name: "Properti meja terpilih" })).toBeVisible();
    expect(screen.getByText("Meja 02")).toBeVisible();
    expect(screen.queryByText(/table-internal/)).not.toBeInTheDocument();

    const columnInput = screen.getByLabelText("Kolom");
    fireEvent.change(columnInput, { target: { value: "6" } });

    expect(onItemChange).toHaveBeenLastCalledWith("table-internal-02", {
      gridH: 2,
      gridW: 3,
      gridX: 5,
      gridY: 1,
    });
  });

  it("clamps panel input to canvas bounds", async () => {
    const onItemChange = vi.fn();

    render(
      <TableLayoutPropertyPanel
        columns={6}
        item={{ ...selectedItem, gridW: 2, gridX: 3 }}
        onItemChange={onItemChange}
        rows={6}
      />,
    );

    const widthInput = screen.getByLabelText("Lebar");
    fireEvent.change(widthInput, { target: { value: "9" } });

    expect(onItemChange).toHaveBeenLastCalledWith("table-internal-02", {
      gridH: 2,
      gridW: 3,
      gridX: 3,
      gridY: 1,
    });
  });

  it("passes an axe smoke test", async () => {
    const { container } = render(
      <TableLayoutPropertyPanel columns={14} item={selectedItem} rows={10} />,
    );
    expect((await axe(container)).violations).toEqual([]);
  });
});
