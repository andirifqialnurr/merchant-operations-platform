import type { Meta, StoryObj } from "@storybook/react-vite";

import { Brand, BrandMark } from "@merchant/ui/brand";

import { storyContractParameters } from "./story-contract";

const meta = {
  title: "Foundation/Brand",
  component: Brand,
  parameters: {
    ...storyContractParameters,
    layout: "padded",
  },
  tags: ["autodocs"],
  args: {
    name: "Cafe Companion",
  },
} satisfies Meta<typeof Brand>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Wordmark: Story = {};

export const Sizes: Story = {
  render: (args) => (
    <div className="story-contract-page">
      <Brand {...args} size="sm" />
      <Brand {...args} size="md" />
      <Brand {...args} size="lg" />
    </div>
  ),
};

export const MarkOnly: Story = {
  render: (args) => (
    <div className="story-contract-page">
      <BrandMark label={args.name} size="lg" />
      <BrandMark label={args.name} size="lg" tone="mono" />
    </div>
  ),
};

export const ThemeComparison: Story = {
  render: (args) => (
    <div className="story-contract-theme-comparison">
      <section data-theme-preview="light">
        <h2 className="text-heading-sm">Light</h2>
        <Brand {...args} size="lg" />
      </section>
      <section data-theme-preview="dark">
        <h2 className="text-heading-sm">Dark</h2>
        <Brand {...args} size="lg" />
      </section>
    </div>
  ),
};
