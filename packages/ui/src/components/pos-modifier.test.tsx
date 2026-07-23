import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import { type ModifierGroup, ProductModifierPicker } from "./pos-modifier";

const groups: readonly ModifierGroup[] = [
  {
    id: "size",
    label: "Ukuran",
    minSelections: 1,
    mode: "single",
    options: [
      { id: "regular", label: "Regular" },
      { id: "large", label: "Large", priceLabel: "+Rp5.000" },
    ],
  },
  {
    id: "extras",
    label: "Tambahan",
    maxSelections: 2,
    mode: "multiple",
    options: [
      { id: "shot", label: "Extra shot", priceLabel: "+Rp6.000" },
      { id: "jelly", label: "Coffee jelly", priceLabel: "+Rp4.000" },
      { id: "cream", label: "Whipped cream", priceLabel: "+Rp5.000" },
    ],
  },
];

function renderPicker(onSubmit = vi.fn()) {
  return {
    onSubmit,
    ...render(
      <ProductModifierPicker
        groups={groups}
        onOpenChange={() => undefined}
        onSubmit={onSubmit}
        open
        productName="Es kopi susu gula aren"
        productPriceLabel="Rp24.000"
        submitTotalLabel="Rp24.000"
      />,
    ),
  };
}

describe("ProductModifierPicker", () => {
  it("keeps the cart action unavailable until required groups are complete", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderPicker();

    const submit = screen.getByRole("button", { name: "Tambahkan ke keranjang" });
    expect(screen.getByText("Belum lengkap")).toBeVisible();
    expect(submit).toBeDisabled();

    await user.click(screen.getByRole("radio", { name: /Large.*Rp5\.000/ }));
    expect(screen.queryByText("Belum lengkap")).not.toBeInTheDocument();
    expect(submit).toBeEnabled();

    await user.type(screen.getByLabelText("Catatan item"), "Es sedikit");
    await user.click(screen.getByRole("button", { name: "Tambah Es kopi susu gula aren" }));
    await user.click(submit);

    expect(onSubmit).toHaveBeenCalledWith({
      note: "Es sedikit",
      quantity: 2,
      selections: { size: ["large"] },
    });
  });

  it("enforces a multiple-selection maximum without clearing selected options", async () => {
    const user = userEvent.setup();
    renderPicker();

    await user.click(screen.getByRole("checkbox", { name: /Extra shot.*Rp6\.000/ }));
    await user.click(screen.getByRole("checkbox", { name: /Coffee jelly.*Rp4\.000/ }));

    expect(screen.getByRole("checkbox", { name: /Extra shot.*Rp6\.000/ })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: /Coffee jelly.*Rp4\.000/ })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: /Whipped cream.*Rp5\.000/ })).toBeDisabled();

    await user.click(screen.getByRole("checkbox", { name: /Extra shot.*Rp6\.000/ }));
    expect(screen.getByRole("checkbox", { name: /Whipped cream.*Rp5\.000/ })).toBeEnabled();
  });

  it("passes an axe smoke test with required, optional, and unavailable choices", async () => {
    render(
      <ProductModifierPicker
        defaultSelections={{ size: ["regular"] }}
        groups={[
          ...groups,
          {
            id: "milk",
            label: "Susu",
            mode: "single",
            options: [
              { id: "fresh", label: "Fresh milk" },
              {
                disabled: true,
                id: "oat",
                label: "Oat milk",
                unavailableLabel: "Sedang habis",
              },
            ],
          },
        ]}
        onOpenChange={() => undefined}
        onSubmit={() => undefined}
        open
        productName="Es kopi susu gula aren"
        productPriceLabel="Rp24.000"
      />,
    );

    const results = await axe(screen.getByRole("dialog", { name: "Sesuaikan pesanan" }));
    expect(results.violations).toEqual([]);
  });
});
