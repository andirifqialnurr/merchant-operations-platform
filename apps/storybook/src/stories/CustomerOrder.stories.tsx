import type { Meta, StoryObj } from "@storybook/react-vite";

import { OrderProgress, StickyCartBar } from "@merchant/ui/customer-order";

import { storyContractParameters } from "./story-contract";

const steps = ["Diterima", "Disiapkan", "Siap diantar"];

const meta = {
  title: "Domain/Customer/Order",
  component: OrderProgress,
  args: { current: 1, label: "Progres pesanan 12", steps },
  parameters: { ...storyContractParameters, layout: "padded" },
  tags: ["autodocs"],
} satisfies Meta<typeof OrderProgress>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Every step an order can be at, one below the other. */
export const Progress: Story = {
  render: () => (
    <div className="grid max-w-sm gap-6">
      {steps.map((step, index) => (
        <OrderProgress current={index} key={step} label={`Progres: ${step}`} steps={steps} />
      ))}
      <OrderProgress
        current={0}
        label="Label panjang"
        steps={["Pesanan diterima dapur", "Sedang disiapkan barista", "Siap diantar ke meja"]}
      />
    </div>
  ),
};

/** The cart bar sits at the bottom of the viewport; tab to it and press Enter to open. */
export const CartBar: Story = {
  parameters: { viewport: { defaultViewport: "mobile" } },
  render: () => (
    <StickyCartBar countLabel="12 item" onOpen={() => undefined} totalLabel="Rp1.275.000" />
  ),
};

export const ThemeComparison: Story = {
  render: () => (
    <div className="story-contract-theme-comparison">
      {(["light", "dark"] as const).map((theme) => (
        <section className="grid gap-4" data-theme-preview={theme} key={theme}>
          <OrderProgress current={1} label={`Progres ${theme}`} steps={steps} />
          <div className="relative h-24 overflow-hidden [transform:translateZ(0)]">
            <StickyCartBar countLabel="2 item" onOpen={() => undefined} totalLabel="Rp50.000" />
          </div>
        </section>
      ))}
    </div>
  ),
};
