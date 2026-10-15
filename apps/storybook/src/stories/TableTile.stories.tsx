import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";

import type { TableShapeKind } from "@merchant/ui/table-shape";
import { TableTile, type TableTileProps, type TableTileState } from "@merchant/ui/table-tile";

import { storyContractParameters } from "./story-contract";
import { serviceMetrics, stateLabels } from "./table-labels";

const tableStates: Array<Pick<TableTileProps, "label" | "metrics"> & { state: TableTileState }> = [
  { label: "Meja 01", state: "available" },
  { label: "Meja 02", metrics: serviceMetrics(4, 1, 42), state: "occupied" },
  { label: "Meja 03", metrics: serviceMetrics(2, 1, 8), state: "waiting-order" },
  { label: "Meja 04", metrics: serviceMetrics(6, 2, 96), state: "waiting-payment" },
  { label: "Meja Patio Panjang", metrics: serviceMetrics(3, 1, 18), state: "needs-service" },
  { label: "Meja 06", metrics: serviceMetrics(4, 3, 75), state: "closing" },
  { label: "Meja 07", state: "cleaning" },
  { label: "Meja servis", state: "disabled" },
];

/** Three shapes in three sizes, with the footprint each takes on the grid (AS-01). */
const shapes: Array<{
  capacity: number;
  footprint: { height: number; width: number };
  label: string;
  shape: TableShapeKind;
}> = [
  { capacity: 2, footprint: { height: 2, width: 2 }, label: "S1", shape: "square" },
  { capacity: 4, footprint: { height: 3, width: 3 }, label: "S2", shape: "square" },
  { capacity: 8, footprint: { height: 4, width: 4 }, label: "S3", shape: "square" },
  { capacity: 4, footprint: { height: 2, width: 3 }, label: "P1", shape: "rectangle" },
  { capacity: 6, footprint: { height: 2, width: 4 }, label: "P2", shape: "rectangle" },
  { capacity: 10, footprint: { height: 3, width: 6 }, label: "P3", shape: "rectangle" },
  { capacity: 2, footprint: { height: 2, width: 2 }, label: "B1", shape: "round" },
  { capacity: 4, footprint: { height: 3, width: 3 }, label: "B2", shape: "round" },
  { capacity: 8, footprint: { height: 4, width: 4 }, label: "B3", shape: "round" },
];

function SelectableTableTile({
  initiallySelected = false,
  ...props
}: TableTileProps & { initiallySelected?: boolean }) {
  const [selected, setSelected] = useState(initiallySelected);
  return (
    <TableTile {...props} onClick={() => setSelected((value) => !value)} selected={selected} />
  );
}

function ShapeGallery({ mode }: { mode: "edit" | "view" }) {
  return (
    <div className="story-table-shape-grid">
      {shapes.map((item) => (
        <div
          className="story-table-shape-cell"
          key={item.label}
          style={{ height: item.footprint.height * 40, width: item.footprint.width * 40 }}
        >
          <SelectableTableTile
            capacity={item.capacity}
            footprint={item.footprint}
            label={item.label}
            mode={mode}
            shape={item.shape}
            state="available"
          />
        </div>
      ))}
    </div>
  );
}

const meta = {
  title: "Domain/Table Layout/Table Tile",
  component: TableTile,
  args: {
    label: "Meja 12",
    state: "occupied",
    stateLabel: stateLabels.occupied,
  },
  parameters: {
    ...storyContractParameters,
    layout: "padded",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof TableTile>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ViewStates: Story = {
  render: () => (
    <div className="story-table-tile-grid">
      {tableStates.map((table) => (
        <SelectableTableTile key={table.label} {...table} stateLabel={stateLabels[table.state]} />
      ))}
    </div>
  ),
};

export const EditMode: Story = {
  render: () => (
    <div className="story-table-tile-grid">
      <SelectableTableTile label="Meja 11" mode="edit" state="occupied" />
      <SelectableTableTile initiallySelected label="Meja 12" mode="edit" state="waiting-order" />
      <SelectableTableTile
        label="Meja servis"
        mode="edit"
        state="disabled"
        stateLabel={stateLabels.disabled}
      />
    </div>
  ),
};

export const ShapesAndSizes: Story = {
  render: () => <ShapeGallery mode="edit" />,
};

export const Sizes: Story = {
  render: () => (
    <div className="story-table-tile-grid">
      <TableTile label="T-01" size="sm" state="available" stateLabel={stateLabels.available} />
      <TableTile
        label="Meja 14"
        metrics={serviceMetrics(2, 1, 64)}
        size="md"
        state="waiting-payment"
        stateLabel={stateLabels["waiting-payment"]}
      />
      <TableTile
        label="Meja Keluarga"
        metrics={serviceMetrics(5, 2, 118)}
        size="lg"
        state="needs-service"
        stateLabel={stateLabels["needs-service"]}
      />
    </div>
  ),
};

export const ThemeComparison: Story = {
  render: () => (
    <div className="story-contract-theme-comparison">
      {(["light", "dark"] as const).map((theme) => (
        <section data-theme-preview={theme} key={theme}>
          <h2 className="text-heading-sm">{theme === "light" ? "Light" : "Dark"}</h2>
          <div className="story-table-tile-grid">
            <TableTile label="Meja 01" state="available" stateLabel={stateLabels.available} />
            <TableTile
              label="Meja 02"
              metrics={serviceMetrics(4, 1, 37)}
              state="occupied"
              stateLabel={stateLabels.occupied}
            />
            <TableTile
              label="Meja servis"
              mode="edit"
              selected
              state="disabled"
              stateLabel={stateLabels.disabled}
            />
          </div>
          <ShapeGallery mode="edit" />
        </section>
      ))}
    </div>
  ),
};

export const MobileView: Story = {
  parameters: { viewport: { defaultViewport: "mobile" } },
  render: () => (
    <div className="story-table-tile-mobile">
      {tableStates.slice(0, 5).map((table) => (
        <SelectableTableTile
          key={table.label}
          {...table}
          size="lg"
          stateLabel={stateLabels[table.state]}
        />
      ))}
    </div>
  ),
};
