import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import { CategoryRail, ProductTile } from "./pos-catalog";

const categories = [
  { count: 12, id: "all", label: "Semua" },
  { count: 7, id: "coffee", label: "Kopi" },
  { disabled: true, id: "seasonal", label: "Menu musiman" },
] as const;

describe("ProductTile", () => {
  it("exposes the selected product as a pressable tile", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();

    render(
      <ProductTile
        name="Es kopi susu gula aren"
        onClick={onClick}
        priceLabel="Rp24.000"
        selected
        variant="touch"
      />,
    );

    const tile = screen.getByRole("button", { name: /Es kopi susu gula aren/ });
    expect(tile).toHaveAttribute("aria-pressed", "true");
    expect(tile).toHaveClass("ui-product-tile--touch", "is-selected");
    await user.click(tile);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("shows explicit availability and prevents selecting an unavailable product", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();

    const { rerender } = render(
      <ProductTile
        availability="sold-out"
        name="Croissant mentega"
        onClick={onClick}
        priceLabel="Rp28.000"
      />,
    );

    expect(screen.getByText("Habis")).toBeVisible();
    await user.click(screen.getByRole("button", { name: /Croissant mentega/ }));
    expect(onClick).not.toHaveBeenCalled();

    rerender(
      <ProductTile
        availability="unavailable"
        name="Menu makan siang"
        priceLabel="Rp45.000"
        unavailableLabel="Tersedia pukul 11.00"
      />,
    );
    expect(screen.getByText("Tersedia pukul 11.00")).toBeVisible();
  });

  it("keeps the image loading state contextual and disabled", () => {
    render(
      <ProductTile imageLoading name="Matcha latte" priceLabel="Rp30.000" variant="customer" />,
    );

    const tile = screen.getByRole("button", { name: /Matcha latte/ });
    expect(tile).toHaveAttribute("aria-busy", "true");
    expect(tile).toBeDisabled();
  });
});

describe("CategoryRail", () => {
  it("identifies the active category and emits an intentional selection", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();

    render(
      <CategoryRail
        activeId="all"
        categories={categories}
        onSelect={onSelect}
        orientation="horizontal"
      />,
    );

    expect(screen.getByRole("button", { name: /Semua/ })).toHaveAttribute("aria-pressed", "true");
    await user.click(screen.getByRole("button", { name: /Kopi/ }));
    expect(onSelect).toHaveBeenCalledWith("coffee");

    await user.click(screen.getByRole("button", { name: "Menu musiman" }));
    expect(onSelect).toHaveBeenCalledOnce();
  });

  it("passes an axe smoke test for the POS catalog controls", async () => {
    const { container } = render(
      <div>
        <CategoryRail activeId="all" categories={categories} onSelect={() => undefined} />
        <ProductTile
          lowStockLabel="Sisa 3"
          name="Kopi filter pilihan barista"
          priceLabel="Rp32.000"
        />
      </div>,
    );

    const results = await axe(container);
    expect(results.violations).toEqual([]);
  });
});
