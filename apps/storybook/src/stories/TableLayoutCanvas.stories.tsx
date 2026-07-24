import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";

import {
  TableLayoutCanvas,
  type TableLayoutCanvasItem,
  type TableLayoutGridPosition,
} from "@merchant/ui/table-layout-canvas";

import { storyContractParameters } from "./story-contract";

const initialTables: readonly TableLayoutCanvasItem[] = [
  { gridH: 2, gridW: 2, gridX: 0, gridY: 0, id: "table-01", label: "Meja 01" },
  {
    durationMinutes: 42,
    gridH: 2,
    gridW: 3,
    gridX: 4,
    gridY: 1,
    guestCount: 4,
    id: "table-02",
    label: "Meja 02",
    orderCount: 1,
    state: "occupied",
  },
  {
    durationMinutes: 8,
    gridH: 2,
    gridW: 3,
    gridX: 8,
    gridY: 2,
    guestCount: 2,
    id: "table-03",
    label: "Meja 03",
    orderCount: 1,
    state: "waiting-order",
  },
  {
    gridH: 2,
    gridW: 2,
    gridX: 2,
    gridY: 5,
    id: "table-04",
    label: "Meja Patio",
    state: "reserved",
  },
  {
    gridH: 2,
    gridW: 2,
    gridX: 9,
    gridY: 6,
    id: "table-05",
    label: "Meja servis",
    state: "disabled",
  },
];

const overlappingTables: readonly TableLayoutCanvasItem[] = [
  { gridH: 2, gridW: 2, gridX: 0, gridY: 0, id: "table-a", label: "Meja A" },
  { gridH: 2, gridW: 2, gridX: 1, gridY: 1, id: "table-b", label: "Meja B" },
  { gridH: 2, gridW: 3, gridX: 5, gridY: 2, id: "table-c", label: "Meja C" },
];

function StatefulCanvas({ mode = "view" }: { mode?: "view" | "edit" | "preview" }) {
  const [tables, setTables] = useState(initialTables);
  const [selectedId, setSelectedId] = useState("table-02");

  function moveTable(itemId: string, position: TableLayoutGridPosition) {
    setTables((current) =>
      current.map((table) => (table.id === itemId ? { ...table, ...position } : table)),
    );
  }

  return (
    <TableLayoutCanvas
      cellSize={48}
      columns={14}
      items={tables}
      mode={mode}
      onItemMove={moveTable}
      onSelectItem={setSelectedId}
      rows={10}
      selectedId={selectedId}
      variant={mode === "preview" ? "compact" : "default"}
    />
  );
}

function ValidationCanvas() {
  const [tables, setTables] = useState(overlappingTables);
  const [selectedId, setSelectedId] = useState("table-b");

  function moveTable(itemId: string, position: TableLayoutGridPosition) {
    setTables((current) =>
      current.map((table) => (table.id === itemId ? { ...table, ...position } : table)),
    );
  }

  return (
    <TableLayoutCanvas
      cellSize={48}
      columns={10}
      items={tables}
      mode="edit"
      onItemMove={moveTable}
      onSelectItem={setSelectedId}
      rows={8}
      selectedId={selectedId}
      variant="compact"
    />
  );
}

const meta = {
  title: "Domain/Table Layout/Table Layout Canvas",
  component: TableLayoutCanvas,
  args: {
    columns: 14,
    items: initialTables,
    rows: 10,
  },
  parameters: {
    ...storyContractParameters,
    layout: "padded",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof TableLayoutCanvas>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ViewMode: Story = {
  render: () => <StatefulCanvas />,
};

export const EditSnapToGrid: Story = {
  render: () => <StatefulCanvas mode="edit" />,
};

export const BoundsOverlapAndKeyboard: Story = {
  render: () => <ValidationCanvas />,
};

export const PreviewCompact: Story = {
  render: () => <StatefulCanvas mode="preview" />,
};

export const ThemeComparison: Story = {
  render: () => (
    <div className="story-contract-theme-comparison story-table-layout-canvas-theme">
      <section data-theme-preview="light">
        <h2 className="text-heading-sm">Light</h2>
        <StatefulCanvas mode="edit" />
      </section>
      <section data-theme-preview="dark">
        <h2 className="text-heading-sm">Dark</h2>
        <StatefulCanvas mode="edit" />
      </section>
    </div>
  ),
};

export const MobileReadOnly: Story = {
  parameters: { viewport: { defaultViewport: "mobile" } },
  render: () => <StatefulCanvas mode="preview" />,
};
