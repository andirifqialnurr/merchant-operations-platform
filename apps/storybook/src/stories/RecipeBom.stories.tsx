import { useMemo, useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";

import {
  RecipeBomEditor,
  type RecipeBomIngredientRow,
  type RecipeBomUnitOption,
} from "@merchant/ui/recipe-bom";

import { storyContractParameters } from "./story-contract";

const unitOptions = [
  { label: "gram", value: "gram" },
  { label: "kg", value: "kg" },
  { label: "ml", value: "ml" },
] as const satisfies readonly RecipeBomUnitOption[];

const baseRows: RecipeBomIngredientRow[] = [
  {
    estimatedCostLabel: "Rp 4.500",
    ingredientLabel: "Biji kopi house blend",
    ingredientSku: "ING-COF",
    quantity: "18",
    rowId: "row-coffee",
    statusLabel: "Aktif",
    unitOptions,
    unitValue: "gram",
  },
  {
    estimatedCostLabel: "Rp 2.000",
    ingredientLabel: "Susu segar",
    noteLabel: "Dingin",
    quantity: "120",
    rowId: "row-milk",
    unitOptions,
    unitValue: "ml",
  },
  {
    disabledReason: "Ingredient tidak aktif",
    estimatedCostLabel: "Rp 850",
    ingredientLabel: "Sirup gula aren",
    quantity: "12",
    rowId: "row-syrup",
    statusLabel: "Review",
    unitOptions,
    unitValue: "ml",
  },
];

function RecipeBomDemo() {
  const [rows, setRows] = useState(baseRows);
  const summaryLabel = `${rows.length} ingredient aktif`;
  const totalEstimatedCostLabel = useMemo(() => {
    if (rows.length === 0) return undefined;
    return rows.length === 3 ? "Rp 7.350" : "Rp 6.500";
  }, [rows.length]);
  const optionalSummaryProps = {
    ...(totalEstimatedCostLabel ? { totalEstimatedCostLabel } : {}),
  };

  return (
    <RecipeBomEditor
      {...optionalSummaryProps}
      ingredientRows={rows}
      onAddIngredient={() => setRows(baseRows)}
      onCancel={() => undefined}
      onPickIngredient={() => undefined}
      onQuantityChange={(rowId, quantity) =>
        setRows((currentRows) =>
          currentRows.map((row) => (row.rowId === rowId ? { ...row, quantity } : row)),
        )
      }
      onRemoveIngredient={(rowId) =>
        setRows((currentRows) => currentRows.filter((row) => row.rowId !== rowId))
      }
      onSave={() => undefined}
      onUnitChange={(rowId, unitValue) =>
        setRows((currentRows) =>
          currentRows.map((row) => (row.rowId === rowId ? { ...row, unitValue } : row)),
        )
      }
      productLabel="Cafe latte"
      statusLabel="Draft"
      summaryLabel={summaryLabel}
    />
  );
}

const meta = {
  title: "Domain/Inventory/Recipe BOM",
  component: RecipeBomEditor,
  args: {
    ingredientRows: baseRows,
    productLabel: "Cafe latte",
    totalEstimatedCostLabel: "Rp 7.350",
  },
  parameters: {
    ...storyContractParameters,
    layout: "padded",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof RecipeBomEditor>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <div className="story-recipe-bom-workspace">
      <RecipeBomDemo />
    </div>
  ),
};

export const Empty: Story = {
  render: () => (
    <RecipeBomEditor
      emptyLabel="Recipe belum punya ingredient."
      ingredientRows={[]}
      onAddIngredient={() => undefined}
      productLabel="Cold brew"
      statusLabel="Draft"
    />
  ),
};

export const ThemeComparison: Story = {
  render: () => (
    <div className="story-contract-theme-comparison story-recipe-bom-theme">
      <section data-theme-preview="light">
        <h2 className="text-heading-sm">Light</h2>
        <RecipeBomDemo />
      </section>
      <section data-theme-preview="dark">
        <h2 className="text-heading-sm">Dark</h2>
        <RecipeBomDemo />
      </section>
    </div>
  ),
};

export const Mobile: Story = {
  parameters: { viewport: { defaultViewport: "mobile" } },
  render: () => (
    <div className="story-recipe-bom-workspace">
      <RecipeBomDemo />
    </div>
  ),
};
