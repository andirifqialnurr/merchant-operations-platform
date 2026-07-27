import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import {
  InventoryItemPicker,
  InventoryUnitConversionList,
  type InventoryItemOption,
} from "./inventory-item-unit";

const items: InventoryItemOption[] = [
  {
    id: "item-internal-rice",
    name: "Beras premium",
    primaryUnit: "kg",
    sku: "ING-RICE",
    status: "active",
    stockLabel: "12 kg",
    stockStatus: "normal",
  },
  {
    id: "item-internal-syrup",
    name: "Sirup gula aren",
    primaryUnit: "botol",
    sku: "ING-SYRUP",
    status: "active",
    stockLabel: "2 botol",
    stockStatus: "low",
  },
  {
    disabled: true,
    disabledReason: "Tidak dipakai outlet ini",
    id: "item-internal-archived",
    name: "Kemasan lama",
    primaryUnit: "pcs",
    status: "archived",
  },
];

describe("InventoryItemUnit", () => {
  it("renders inventory item read model without internal id or financial data", () => {
    render(<InventoryItemPicker items={items} selectedId="item-internal-rice" />);

    expect(screen.getByRole("region", { name: "Pilih item inventory" })).toBeVisible();
    expect(screen.getByRole("combobox", { name: /cari item/i })).toBeVisible();
    expect(screen.getByText("Beras premium")).toBeVisible();
    expect(screen.getByText("SKU ING-RICE")).toBeVisible();
    expect(screen.getByText("Unit utama kg")).toBeVisible();
    expect(screen.getByText("12 kg")).toBeVisible();
    expect(screen.getByText("3 item ditemukan")).toBeVisible();
    expect(
      screen.queryByText(/item-internal|hpp|cost|price|profit|supplier/i),
    ).not.toBeInTheDocument();
  });

  it("calls query and select actions while keeping internal item id hidden", async () => {
    const onQueryChange = vi.fn();
    const onSelectItem = vi.fn();
    const user = userEvent.setup();

    function StatefulPicker() {
      const [query, setQuery] = useState("");

      return (
        <InventoryItemPicker
          items={items}
          onQueryChange={(nextQuery) => {
            setQuery(nextQuery);
            onQueryChange(nextQuery);
          }}
          onSelectItem={onSelectItem}
          query={query}
        />
      );
    }

    render(<StatefulPicker />);

    await user.type(screen.getByRole("combobox", { name: /cari item/i }), "beras");
    await user.click(screen.getByRole("option", { name: /beras premium/i }));

    expect(onQueryChange).toHaveBeenLastCalledWith("beras");
    expect(onSelectItem).toHaveBeenCalledWith("item-internal-rice");
    expect(screen.queryByText("item-internal-rice")).not.toBeInTheDocument();
  });

  it("renders unit conversion context as read-only display", () => {
    render(
      <InventoryUnitConversionList
        conversions={[
          {
            fromQuantity: "1",
            fromUnit: "karung",
            id: "unit-internal-sack",
            label: "Konversi pembelian",
            toQuantity: "25",
            toUnit: "kg",
          },
          {
            fromQuantity: "1",
            fromUnit: "kg",
            id: "unit-internal-gram",
            toQuantity: "1000",
            toUnit: "gram",
          },
        ]}
        primaryUnit="kg"
      />,
    );

    expect(screen.getByRole("region", { name: "Konversi unit inventory" })).toBeVisible();
    expect(screen.getByText("Unit utama")).toBeVisible();
    expect(screen.getByText("kg")).toBeVisible();
    expect(screen.getByText("1 karung = 25 kg")).toBeVisible();
    expect(screen.getByText("Konversi pembelian")).toBeVisible();
    expect(screen.queryByText(/unit-internal|cost|price|supplier|audit/i)).not.toBeInTheDocument();
  });

  it("rejects sensitive inventory item/unit fields before render", () => {
    expect(() =>
      render(
        <InventoryItemPicker
          items={
            [
              {
                averageCostMinor: "12000",
                id: "item-sensitive",
                name: "Beras",
                primaryUnit: "kg",
              },
            ] as Array<InventoryItemOption & { averageCostMinor: string }>
          }
        />,
      ),
    ).toThrow(/averageCostMinor/);

    expect(() =>
      render(
        <InventoryUnitConversionList
          conversions={[
            {
              fromQuantity: "1",
              fromUnit: "dus",
              id: "unit-sensitive",
              supplierName: "Supplier A",
              toQuantity: "12",
              toUnit: "pcs",
            } as Parameters<typeof InventoryUnitConversionList>[0]["conversions"][number] & {
              supplierName: string;
            },
          ]}
          primaryUnit="pcs"
        />,
      ),
    ).toThrow(/supplierName/);
  });

  it("rejects malformed inventory item/unit values", () => {
    expect(() =>
      render(<InventoryItemPicker items={[{ id: "", name: "Beras", primaryUnit: "kg" }]} />),
    ).toThrow(/id internal item/);
    expect(() =>
      render(<InventoryItemPicker items={[{ id: "item-a", name: "", primaryUnit: "kg" }]} />),
    ).toThrow(/Nama item/);
    expect(() =>
      render(<InventoryItemPicker items={[{ id: "item-a", name: "Beras", primaryUnit: "" }]} />),
    ).toThrow(/Unit utama item/);
    expect(() =>
      render(
        <InventoryUnitConversionList
          conversions={[
            {
              fromQuantity: "",
              fromUnit: "dus",
              id: "unit-a",
              toQuantity: "12",
              toUnit: "pcs",
            },
          ]}
          primaryUnit="pcs"
        />,
      ),
    ).toThrow(/Quantity awal/);
  });

  it("passes an axe smoke test", async () => {
    const { container } = render(
      <div>
        <InventoryItemPicker items={items} selectedId="item-internal-rice" />
        <InventoryUnitConversionList
          conversions={[
            {
              fromQuantity: "1",
              fromUnit: "karung",
              id: "unit-internal-sack",
              label: "Konversi pembelian",
              toQuantity: "25",
              toUnit: "kg",
            },
          ]}
          primaryUnit="kg"
        />
      </div>,
    );

    expect((await axe(container)).violations).toEqual([]);
  });
});
