import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";

import { TableTile, type TableTileProps, type TableTileState } from "@merchant/ui/table-tile";

import { storyContractParameters } from "./story-contract";

const tableStates: Array<
  Pick<TableTileProps, "durationMinutes" | "guestCount" | "label" | "orderCount"> & {
    state: TableTileState;
  }
> = [
  { label: "Meja 01", state: "available" },
  { durationMinutes: 42, guestCount: 4, label: "Meja 02", orderCount: 1, state: "occupied" },
  {
    durationMinutes: 8,
    guestCount: 2,
    label: "Meja 03",
    orderCount: 1,
    state: "waiting-order",
  },
  {
    durationMinutes: 96,
    guestCount: 6,
    label: "Meja 04",
    orderCount: 2,
    state: "waiting-payment",
  },
  {
    durationMinutes: 18,
    guestCount: 3,
    label: "Meja Patio Panjang",
    orderCount: 1,
    state: "needs-service",
  },
  { label: "Meja 06", state: "reserved" },
  { label: "Meja servis", state: "disabled" },
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

const meta = {
  title: "Domain/Table Layout/Table Tile",
  component: TableTile,
  args: {
    label: "Meja 12",
    state: "occupied",
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
        <SelectableTableTile key={table.label} {...table} />
      ))}
    </div>
  ),
};

export const EditMode: Story = {
  render: () => (
    <div className="story-table-tile-grid">
      <SelectableTableTile
        durationMinutes={32}
        guestCount={3}
        label="Meja 11"
        mode="edit"
        orderCount={1}
        state="occupied"
      />
      <SelectableTableTile
        durationMinutes={5}
        guestCount={2}
        initiallySelected
        label="Meja 12"
        mode="edit"
        orderCount={1}
        state="waiting-order"
      />
      <SelectableTableTile label="Meja servis" mode="edit" state="disabled" />
    </div>
  ),
};

export const Sizes: Story = {
  render: () => (
    <div className="story-table-tile-grid">
      <TableTile label="T-01" size="sm" state="available" />
      <TableTile
        durationMinutes={64}
        guestCount={2}
        label="Meja 14"
        orderCount={1}
        size="md"
        state="waiting-payment"
      />
      <TableTile
        durationMinutes={118}
        guestCount={5}
        label="Meja Keluarga"
        orderCount={2}
        size="lg"
        state="needs-service"
      />
    </div>
  ),
};

export const ThemeComparison: Story = {
  render: () => (
    <div className="story-contract-theme-comparison">
      <section data-theme-preview="light">
        <h2 className="text-heading-sm">Light</h2>
        <div className="story-table-tile-grid">
          <TableTile label="Meja 01" state="available" />
          <TableTile
            durationMinutes={37}
            guestCount={4}
            label="Meja 02"
            orderCount={1}
            state="occupied"
          />
          <TableTile label="Meja servis" mode="edit" selected state="disabled" />
        </div>
      </section>
      <section data-theme-preview="dark">
        <h2 className="text-heading-sm">Dark</h2>
        <div className="story-table-tile-grid">
          <TableTile label="Meja 01" state="available" />
          <TableTile
            durationMinutes={37}
            guestCount={4}
            label="Meja 02"
            orderCount={1}
            state="occupied"
          />
          <TableTile label="Meja servis" mode="edit" selected state="disabled" />
        </div>
      </section>
    </div>
  ),
};

export const MobileView: Story = {
  parameters: { viewport: { defaultViewport: "mobile" } },
  render: () => (
    <div className="story-table-tile-mobile">
      {tableStates.slice(0, 5).map((table) => (
        <SelectableTableTile key={table.label} {...table} size="lg" />
      ))}
    </div>
  ),
};
