import type { Meta, StoryObj } from "@storybook/react-vite";
import { Check, Store } from "lucide-react";

import { AppIcon } from "@merchant/ui/app-icon";

const meta = {
  title: "Foundation/AppIcon",
  component: AppIcon,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    size: {
      control: "select",
      options: ["xs", "sm", "md", "lg", "xl"],
    },
  },
} satisfies Meta<typeof AppIcon>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    icon: Store,
    label: "Merchant outlet",
    size: "md",
  },
};

export const FoundationSizes: Story = {
  args: {
    icon: Check,
    label: "Foundation sizes",
    size: "md",
  },
  render: () => (
    <div style={{ alignItems: "center", display: "flex", gap: "var(--space-6)" }}>
      {(["xs", "sm", "md", "lg", "xl"] as const).map((size) => (
        <div key={size} style={{ alignItems: "center", display: "grid", gap: "var(--space-2)" }}>
          <AppIcon icon={Check} label={`${size} check`} size={size} />
          <span className="text-caption">{size}</span>
        </div>
      ))}
    </div>
  ),
};
