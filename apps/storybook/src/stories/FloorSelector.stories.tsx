import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";

import {
  FloorSelector,
  type FloorSelectorItem,
  type FloorSelectorProps,
} from "@merchant/ui/floor-selector";

import { storyContractParameters } from "./story-contract";

const standardFloors = [
  { id: "floor-01", label: "Lantai 1", tableCount: 8 },
  { id: "floor-02", label: "Mezzanine", tableCount: 4 },
  { id: "floor-03", label: "Rooftop", tableCount: 0 },
] as const;

const manyFloors: readonly FloorSelectorItem[] = [
  ...standardFloors,
  { id: "floor-04", label: "Lantai 2", tableCount: 10 },
  { id: "floor-05", label: "Lantai 3", tableCount: 6 },
  { id: "floor-06", label: "Teras", tableCount: 5 },
  { disabled: true, id: "floor-07", label: "Area Renovasi", tableCount: 0 },
];

function FloorSelectorExample({
  initialId = "floor-01",
  ...props
}: Omit<FloorSelectorProps, "activeId" | "onValueChange"> & { initialId?: string }) {
  const [activeId, setActiveId] = useState(initialId);
  return <FloorSelector {...props} activeId={activeId} onValueChange={setActiveId} />;
}

const meta = {
  title: "Domain/Table Layout/Floor Selector",
  component: FloorSelector,
  args: {
    activeId: "floor-01",
    floors: standardFloors,
    onValueChange: () => undefined,
  },
  parameters: {
    ...storyContractParameters,
    layout: "padded",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof FloorSelector>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Tabs: Story = {
  render: () => <FloorSelectorExample floors={standardFloors} size="md" variant="tabs" />,
};

export const SelectManyFloors: Story = {
  render: () => <FloorSelectorExample floors={manyFloors} size="md" variant="select" />,
};

export const CompactPosToolbar: Story = {
  render: () => <FloorSelectorExample floors={standardFloors} size="sm" variant="compact" />,
};

export const SizesAndStates: Story = {
  render: () => (
    <div className="story-contract-section">
      <FloorSelectorExample floors={standardFloors} size="sm" variant="tabs" />
      <FloorSelectorExample floors={standardFloors} size="md" variant="tabs" />
      <FloorSelectorExample
        floors={[
          ...standardFloors,
          { disabled: true, id: "floor-04", label: "Area Renovasi", tableCount: 0 },
        ]}
        size="lg"
        variant="tabs"
      />
      <FloorSelector
        activeId=""
        emptyLabel="Belum ada lantai untuk outlet ini."
        floors={[]}
        onValueChange={() => undefined}
      />
    </div>
  ),
};

export const ThemeComparison: Story = {
  render: () => (
    <div className="story-contract-theme-comparison">
      <section data-theme-preview="light">
        <h2 className="text-heading-sm">Light</h2>
        <FloorSelectorExample floors={standardFloors} variant="tabs" />
      </section>
      <section data-theme-preview="dark">
        <h2 className="text-heading-sm">Dark</h2>
        <FloorSelectorExample floors={standardFloors} variant="tabs" />
      </section>
    </div>
  ),
};

export const MobileSelect: Story = {
  parameters: { viewport: { defaultViewport: "mobile" } },
  render: () => <FloorSelectorExample floors={manyFloors} size="lg" variant="select" />,
};
