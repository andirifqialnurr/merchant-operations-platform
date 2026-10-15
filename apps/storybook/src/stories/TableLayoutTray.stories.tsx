import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";

import { UnplacedTableTray, type UnplacedTableTrayItem } from "@merchant/ui/table-layout-tray";

import { storyContractParameters } from "./story-contract";
import { trayLabels } from "./table-labels";

const initialTables: readonly UnplacedTableTrayItem[] = [
  { id: "table-11", label: "Meja 11" },
  { id: "table-12", label: "Meja Patio Panjang" },
  { id: "table-13", label: "Meja Bar 01" },
  { disabled: true, id: "table-service", label: "Meja Servis", reason: "Belum aktif" },
];

function TrayExample({ disabled = false }: { disabled?: boolean }) {
  const [selectedId, setSelectedId] = useState("table-12");
  return (
    <UnplacedTableTray
      labels={trayLabels}
      disabled={disabled}
      items={initialTables}
      onPlaceItem={setSelectedId}
      selectedId={selectedId}
    />
  );
}

const meta = {
  title: "Domain/Table Layout/Unplaced Table Tray",
  component: UnplacedTableTray,
  args: {
    labels: trayLabels,
    items: initialTables,
  },
  parameters: {
    ...storyContractParameters,
    layout: "padded",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof UnplacedTableTray>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <TrayExample />,
};

export const Empty: Story = {
  render: () => <UnplacedTableTray labels={trayLabels} items={[]} />,
};

export const Disabled: Story = {
  render: () => <TrayExample disabled />,
};

export const ThemeComparison: Story = {
  render: () => (
    <div className="story-contract-theme-comparison">
      <section data-theme-preview="light">
        <h2 className="text-heading-sm">Light</h2>
        <TrayExample />
      </section>
      <section data-theme-preview="dark">
        <h2 className="text-heading-sm">Dark</h2>
        <TrayExample />
      </section>
    </div>
  ),
};

export const Mobile: Story = {
  parameters: { viewport: { defaultViewport: "mobile" } },
  render: () => <TrayExample />,
};
