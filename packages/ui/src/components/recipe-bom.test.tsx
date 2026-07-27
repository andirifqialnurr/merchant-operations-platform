import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import {
  RecipeBomEditor,
  type RecipeBomIngredientRow,
  type RecipeBomUnitOption,
} from "./recipe-bom";

const unitOptions: RecipeBomUnitOption[] = [
  { label: "gram", value: "gram" },
  { label: "kg", value: "kg" },
  { label: "ml", value: "ml" },
];

const recipeRows: RecipeBomIngredientRow[] = [
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
];

describe("RecipeBomEditor", () => {
  it("renders product, ingredient rows, and estimated summary without hidden IDs", () => {
    render(
      <RecipeBomEditor
        ingredientRows={recipeRows}
        productLabel="Cafe latte"
        statusLabel="Draft"
        totalEstimatedCostLabel="Rp 6.500"
      />,
    );

    expect(screen.getByRole("form", { name: "Recipe/BOM Editor" })).toBeVisible();
    expect(screen.getByText("Cafe latte")).toBeVisible();
    expect(screen.getByText("Biji kopi house blend")).toBeVisible();
    expect(screen.getByText("Susu segar")).toBeVisible();
    expect(screen.getByText("Rp 6.500")).toBeVisible();
    expect(
      screen.queryByText(/row-coffee|row-milk|hpp|profit|margin|payment/i),
    ).not.toBeInTheDocument();
  });

  it("emits user-owned row changes and save payload", async () => {
    const onPickIngredient = vi.fn();
    const onQuantityChange = vi.fn();
    const onUnitChange = vi.fn();
    const onRemoveIngredient = vi.fn();
    const onSave = vi.fn();
    const user = userEvent.setup();

    function StatefulRecipe() {
      const [rows, setRows] = useState(recipeRows);

      return (
        <RecipeBomEditor
          ingredientRows={rows}
          onPickIngredient={onPickIngredient}
          onQuantityChange={(rowId, quantity) => {
            setRows((currentRows) =>
              currentRows.map((row) => (row.rowId === rowId ? { ...row, quantity } : row)),
            );
            onQuantityChange(rowId, quantity);
          }}
          onRemoveIngredient={(rowId) => {
            setRows((currentRows) => currentRows.filter((row) => row.rowId !== rowId));
            onRemoveIngredient(rowId);
          }}
          onSave={onSave}
          onUnitChange={(rowId, unit) => {
            setRows((currentRows) =>
              currentRows.map((row) => (row.rowId === rowId ? { ...row, unitValue: unit } : row)),
            );
            onUnitChange(rowId, unit);
          }}
          productLabel="Cafe latte"
          totalEstimatedCostLabel="Rp 6.500"
        />
      );
    }

    render(<StatefulRecipe />);

    await user.click(
      screen.getByRole("button", { name: "Pilih ingredient Biji kopi house blend" }),
    );
    await user.clear(screen.getByLabelText("Quantity Biji kopi house blend"));
    await user.type(screen.getByLabelText("Quantity Biji kopi house blend"), "20gr");
    await user.selectOptions(screen.getByLabelText("Unit Biji kopi house blend"), "kg");
    await user.click(screen.getByRole("button", { name: "Hapus ingredient Susu segar" }));
    await user.click(screen.getByRole("button", { name: "Simpan recipe" }));

    expect(onPickIngredient).toHaveBeenCalledWith("row-coffee");
    expect(onQuantityChange).toHaveBeenLastCalledWith("row-coffee", "20");
    expect(onUnitChange).toHaveBeenCalledWith("row-coffee", "kg");
    expect(onRemoveIngredient).toHaveBeenCalledWith("row-milk");
    expect(onSave).toHaveBeenCalledWith({
      rows: [{ quantity: "20", rowId: "row-coffee", unit: "kg" }],
    });
  });

  it("renders empty state and add action", async () => {
    const onAddIngredient = vi.fn();
    const user = userEvent.setup();

    render(
      <RecipeBomEditor
        emptyLabel="Recipe belum punya ingredient."
        ingredientRows={[]}
        onAddIngredient={onAddIngredient}
        productLabel="Cold brew"
      />,
    );

    expect(screen.getByText("Recipe belum punya ingredient.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Simpan recipe" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Tambah ingredient" }));
    expect(onAddIngredient).toHaveBeenCalledTimes(1);
  });

  it("rejects sensitive recipe fields before render while allowing estimated cost labels", () => {
    expect(() =>
      render(
        <RecipeBomEditor
          {...({
            averageCostMinor: "4500",
            ingredientRows: recipeRows,
            productLabel: "Cafe latte",
          } as Parameters<typeof RecipeBomEditor>[0] & { averageCostMinor: string })}
        />,
      ),
    ).toThrow(/averageCostMinor/);

    expect(() =>
      render(
        <RecipeBomEditor
          ingredientRows={[
            {
              ...recipeRows[0]!,
              productId: "product-internal",
            } as RecipeBomIngredientRow & { productId: string },
          ]}
          productLabel="Cafe latte"
        />,
      ),
    ).toThrow(/productId/);
  });

  it("rejects malformed recipe rows", () => {
    expect(() => render(<RecipeBomEditor ingredientRows={recipeRows} productLabel="" />)).toThrow(
      /nama produk/,
    );

    expect(() =>
      render(
        <RecipeBomEditor
          ingredientRows={[
            { ...recipeRows[0]!, rowId: "same" },
            { ...recipeRows[1]!, rowId: "same" },
          ]}
          productLabel="Cafe latte"
        />,
      ),
    ).toThrow(/unik/);

    expect(() =>
      render(
        <RecipeBomEditor
          ingredientRows={[{ ...recipeRows[0]!, unitOptions: [] }]}
          productLabel="Cafe latte"
        />,
      ),
    ).toThrow(/pilihan unit/);
  });

  it("passes an axe smoke test", async () => {
    const { container } = render(
      <RecipeBomEditor
        ingredientRows={recipeRows}
        onAddIngredient={() => undefined}
        onCancel={() => undefined}
        onPickIngredient={() => undefined}
        onQuantityChange={() => undefined}
        onRemoveIngredient={() => undefined}
        onSave={() => undefined}
        onUnitChange={() => undefined}
        productLabel="Cafe latte"
        statusLabel="Draft"
        totalEstimatedCostLabel="Rp 6.500"
      />,
    );

    expect((await axe(container)).violations).toEqual([]);
  });
});
