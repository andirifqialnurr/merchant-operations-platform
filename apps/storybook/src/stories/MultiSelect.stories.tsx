import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";

import { MultiSelect } from "@merchant/ui/multi-select";

import { storyContractParameters } from "./story-contract";

const outlets = [
  { label: "Kopi Lokal Pusat", value: "pusat" },
  { label: "Kopi Lokal Timur", value: "timur" },
  { label: "Kopi Lokal Barat", value: "barat" },
  { label: "Kopi Lokal Selatan", value: "selatan" },
  { disabled: true, disabledReason: "Outlet nonaktif", label: "Kopi Lokal Lama", value: "lama" },
];

function Field({ error, initial = [] }: { error?: string; initial?: string[] }) {
  const [values, setValues] = useState<string[]>(initial);
  return (
    <div style={{ display: "grid", gap: "0.375rem", maxInlineSize: "22rem" }}>
      <span className="text-label" style={{ color: "var(--color-text-primary)" }}>
        Outlet
      </span>
      <MultiSelect
        emptyLabel="Belum ada outlet."
        label="Outlet"
        onValuesChange={setValues}
        options={outlets}
        placeholder="Pilih outlet"
        selectedLabel={(count) => `${count} outlet dipilih`}
        values={values}
        {...(error ? { error } : {})}
      />
    </div>
  );
}

const meta = {
  title: "Forms/MultiSelect",
  component: Field,
  parameters: { ...storyContractParameters, layout: "padded" },
  tags: ["autodocs"],
} satisfies Meta<typeof Field>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {};

export const TwoChosen: Story = { args: { initial: ["pusat", "timur"] } };

export const ManyChosen: Story = { args: { initial: ["pusat", "timur", "barat", "selatan"] } };

export const Invalid: Story = { args: { error: "Pilih minimal satu outlet." } };

export const ThemeComparison: Story = {
  render: () => (
    <div className="story-contract-theme-comparison">
      <section data-theme-preview="light">
        <Field initial={["pusat", "timur", "barat"]} />
      </section>
      <section data-theme-preview="dark">
        <Field initial={["pusat", "timur", "barat"]} />
      </section>
    </div>
  ),
};
