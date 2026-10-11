import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";

import { FormField, PinInput } from "@merchant/ui/pin-input";

import { storyContractParameters } from "./story-contract";

function Field({
  disabled,
  error,
  initial = "",
  length,
}: {
  disabled?: boolean;
  error?: string;
  initial?: string;
  length?: number;
}) {
  const [value, setValue] = useState(initial);
  return (
    <FormField {...(error ? { error } : {})} htmlFor="story-pin" label="PIN manajer">
      <PinInput
        id="story-pin"
        onValueChange={setValue}
        value={value}
        {...(disabled ? { disabled } : {})}
        {...(length ? { length } : {})}
      />
    </FormField>
  );
}

const meta = {
  title: "Forms/PinInput",
  component: Field,
  parameters: { ...storyContractParameters, layout: "padded" },
  tags: ["autodocs"],
} satisfies Meta<typeof Field>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {};

export const PartlyTyped: Story = { args: { initial: "123" } };

export const FourDigits: Story = { args: { initial: "12", length: 4 } };

export const Wrong: Story = {
  args: { error: "PIN salah. Sisa 2 percobaan.", initial: "123456" },
};

export const Disabled: Story = { args: { disabled: true, initial: "1234" } };

export const ThemeComparison: Story = {
  render: () => (
    <div className="story-contract-theme-comparison">
      <section data-theme-preview="light">
        <Field error="PIN salah. Sisa 2 percobaan." initial="1234" />
      </section>
      <section data-theme-preview="dark">
        <Field error="PIN salah. Sisa 2 percobaan." initial="1234" />
      </section>
    </div>
  ),
};
