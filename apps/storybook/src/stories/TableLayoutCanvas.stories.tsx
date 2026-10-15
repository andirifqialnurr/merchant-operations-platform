import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";

import {
  TableLayoutCanvas,
  type TableLayoutCanvasItem,
  type TableLayoutGridPosition,
} from "@merchant/ui/table-layout-canvas";

import { storyContractParameters } from "./story-contract";
import { canvasLabels, serviceMetrics, stateLabels } from "./table-labels";

const initialTables: readonly TableLayoutCanvasItem[] = [
  {
    capacity: 2,
    gridH: 2,
    gridW: 2,
    gridX: 1,
    gridY: 1,
    id: "table-01",
    label: "T1",
    shape: "square",
    state: "available",
    stateLabel: stateLabels.available,
  },
  {
    capacity: 6,
    gridH: 2,
    gridW: 4,
    gridX: 5,
    gridY: 1,
    id: "table-02",
    label: "T2",
    metrics: serviceMetrics(4, 1, 42),
    shape: "rectangle",
    state: "occupied",
    stateLabel: stateLabels.occupied,
  },
  {
    capacity: 4,
    gridH: 3,
    gridW: 3,
    gridX: 10,
    gridY: 1,
    id: "table-03",
    label: "T3",
    metrics: serviceMetrics(2, 1, 8),
    shape: "round",
    state: "waiting-order",
    stateLabel: stateLabels["waiting-order"],
  },
  {
    capacity: 8,
    gridH: 4,
    gridW: 4,
    gridX: 1,
    gridY: 5,
    id: "table-04",
    label: "Meja Keluarga",
    shape: "round",
    state: "reserved",
    stateLabel: stateLabels.reserved,
  },
  {
    capacity: 2,
    gridH: 2,
    gridW: 2,
    gridX: 10,
    gridY: 6,
    id: "table-05",
    label: "Meja servis",
    shape: "square",
    state: "disabled",
    stateLabel: stateLabels.disabled,
  },
];

const overlappingTables: readonly TableLayoutCanvasItem[] = [
  {
    capacity: 2,
    gridH: 2,
    gridW: 2,
    gridX: 0,
    gridY: 0,
    id: "table-a",
    label: "A",
    shape: "square",
  },
  {
    capacity: 2,
    gridH: 2,
    gridW: 2,
    gridX: 1,
    gridY: 1,
    id: "table-b",
    label: "B",
    shape: "round",
  },
  {
    capacity: 4,
    gridH: 2,
    gridW: 3,
    gridX: 5,
    gridY: 2,
    id: "table-c",
    label: "C",
    shape: "rectangle",
  },
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
      cellSize={40}
      columns={14}
      items={tables}
      labels={canvasLabels}
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
      cellSize={40}
      columns={10}
      items={tables}
      labels={canvasLabels}
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
    labels: canvasLabels,
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
