import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";

import {
  TableLayoutPropertyPanel,
  type TableLayoutPropertyPanelItem,
  TableLayoutToolbar,
  type TableLayoutToolbarTool,
} from "@merchant/ui/table-layout-tools";
import type {
  TableLayoutCanvasMode,
  TableLayoutGridPosition,
} from "@merchant/ui/table-layout-canvas";

import { storyContractParameters } from "./story-contract";

const selectedTable: TableLayoutPropertyPanelItem = {
  gridH: 2,
  gridW: 3,
  gridX: 4,
  gridY: 1,
  id: "table-02",
  label: "Meja 02",
};

function TableLayoutToolsExample({ disabled = false }: { disabled?: boolean }) {
  const [mode, setMode] = useState<TableLayoutCanvasMode>("edit");
  const [tool, setTool] = useState<TableLayoutToolbarTool>("select");
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [table, setTable] = useState(selectedTable);

  function updateTable(_itemId: string, position: TableLayoutGridPosition) {
    setTable((current) => ({ ...current, ...position }));
  }

  return (
    <div className="story-table-layout-tools">
      <TableLayoutToolbar
        disabled={disabled}
        mode={mode}
        onModeChange={setMode}
        onSnapToGridChange={setSnapToGrid}
        onToolChange={setTool}
        snapToGrid={snapToGrid}
        tool={tool}
      />
      <TableLayoutPropertyPanel
        columns={14}
        disabled={disabled}
        item={table}
        onItemChange={updateTable}
        rows={10}
      />
    </div>
  );
}

const meta = {
  title: "Domain/Table Layout/Table Layout Tools",
  component: TableLayoutToolbar,
  args: {
    mode: "edit",
    tool: "select",
  },
  parameters: {
    ...storyContractParameters,
    layout: "padded",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof TableLayoutToolbar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ToolbarAndPropertyPanel: Story = {
  render: () => <TableLayoutToolsExample />,
};

export const EmptySelection: Story = {
  render: () => (
    <div className="story-table-layout-tools">
      <TableLayoutToolbar mode="view" tool="select" />
      <TableLayoutPropertyPanel columns={14} rows={10} />
    </div>
  ),
};

export const DisabledEditing: Story = {
  render: () => <TableLayoutToolsExample disabled />,
};

export const ThemeComparison: Story = {
  render: () => (
    <div className="story-contract-theme-comparison">
      <section data-theme-preview="light">
        <h2 className="text-heading-sm">Light</h2>
        <TableLayoutToolsExample />
      </section>
      <section data-theme-preview="dark">
        <h2 className="text-heading-sm">Dark</h2>
        <TableLayoutToolsExample />
      </section>
    </div>
  ),
};

export const Mobile: Story = {
  parameters: { viewport: { defaultViewport: "mobile" } },
  render: () => <TableLayoutToolsExample />,
};
