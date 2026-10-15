import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import { AreaSelector } from "./area-selector";
import { LiveTableView, type LiveTableViewItem } from "./live-table-view";
import { TableSessionPanel } from "./table-session-panel";

const canvasLabels = {
  canvas: "Denah Lantai 1",
  list: "Meja Lantai 1",
  moveDown: "Geser ke bawah",
  moveGroup: "Geser meja",
  moveLeft: "Geser ke kiri",
  moveRight: "Geser ke kanan",
  moveUp: "Geser ke atas",
  overlap: (first: string, second: string) => `${first} menimpa ${second}.`,
  position: (label: string) => label,
  validationTitle: "Meja menimpa",
};

const tables: readonly LiveTableViewItem[] = [
  {
    capacity: 2,
    gridH: 2,
    gridW: 2,
    gridX: 0,
    gridY: 0,
    id: "t1",
    label: "T1",
    shape: "square",
    state: "available",
    stateLabel: "Tersedia",
  },
  {
    capacity: 4,
    gridH: 3,
    gridW: 3,
    gridX: 4,
    gridY: 0,
    id: "t2",
    label: "T2",
    metrics: [{ kind: "guests", label: "3 tamu", text: "3" }],
    shape: "round",
    state: "occupied",
    stateLabel: "Terisi",
  },
  {
    capacity: 6,
    gridH: 2,
    gridW: 4,
    gridX: null,
    gridY: null,
    id: "t3",
    label: "T3",
    state: "available",
    stateLabel: "Tersedia",
  },
];

describe("AreaSelector", () => {
  it("offers every area and all of them, and moves with the arrow keys", async () => {
    const onValueChange = vi.fn();
    const user = userEvent.setup();
    render(
      <AreaSelector
        activeId={null}
        areas={[
          { id: "a1", label: "Dalam" },
          { id: "a2", label: "Teras" },
        ]}
        labels={{ all: "Semua area", selector: "Pilih area" }}
        onValueChange={onValueChange}
      />,
    );
    expect(screen.getByRole("radio", { name: "Semua area" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await user.click(screen.getByRole("radio", { name: "Teras" }));
    expect(onValueChange).toHaveBeenLastCalledWith("a2");
    screen.getByRole("radio", { name: "Semua area" }).focus();
    await user.keyboard("{ArrowRight}");
    expect(onValueChange).toHaveBeenLastCalledWith("a1");
  });

  it("draws nothing for a floor with one area", () => {
    const { container } = render(
      <AreaSelector
        activeId={null}
        areas={[{ id: "a1", label: "Main Area" }]}
        labels={{ all: "Semua area", selector: "Pilih area" }}
        onValueChange={() => undefined}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});

describe("LiveTableView", () => {
  it("draws placed tables on the plan with their status in words", async () => {
    const onSelectItem = vi.fn();
    const user = userEvent.setup();
    render(
      <LiveTableView
        columns={12}
        items={tables}
        labels={canvasLabels}
        layout="plan"
        onSelectItem={onSelectItem}
        rows={8}
      />,
    );
    expect(screen.getByRole("group", { name: "Denah Lantai 1" })).toBeVisible();
    // Only placed tables are on the plan.
    expect(screen.queryByRole("button", { name: /^T3/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "T2, Terisi, 3 tamu" }));
    expect(onSelectItem).toHaveBeenCalledWith("t2");
  });

  it("lines every table up on small screens, unplaced ones included", async () => {
    const onSelectItem = vi.fn();
    const user = userEvent.setup();
    const { container } = render(
      <LiveTableView
        columns={12}
        items={tables}
        labels={canvasLabels}
        layout="list"
        onSelectItem={onSelectItem}
        rows={8}
      />,
    );
    expect(screen.getByRole("list", { name: "Meja Lantai 1" })).toBeVisible();
    expect(screen.getByRole("button", { name: "T2, Terisi, 3 tamu" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "T3, Tersedia" }));
    expect(onSelectItem).toHaveBeenCalledWith("t3");
    expect((await axe(container)).violations).toEqual([]);
  });
});

describe("TableSessionPanel", () => {
  it("shows the visit's facts once and its actions, with no words of its own", async () => {
    const { container } = render(
      <TableSessionPanel
        actions={<button type="button">Tutup kunjungan</button>}
        facts={[
          { label: "Tamu", value: "3" },
          { label: "Duduk sejak", value: "10.15" },
        ]}
        status="Terisi"
        title="T2 · Kunjungan 12"
      />,
    );
    expect(screen.getByRole("region", { name: "T2 · Kunjungan 12" })).toBeVisible();
    expect(screen.getByText("Tamu").nextSibling).toHaveTextContent("3");
    expect(screen.getByRole("button", { name: "Tutup kunjungan" })).toBeVisible();
    expect((await axe(container)).violations).toEqual([]);
  });
});
