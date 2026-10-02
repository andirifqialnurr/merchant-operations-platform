import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Breadcrumb, Pagination, Sidebar, Tabs } from "./navigation";
describe("navigation primitives", () => {
  it("changes tabs with keyboard and paginates", async () => {
    const user = userEvent.setup();
    const tab = vi.fn();
    const page = vi.fn();
    render(
      <>
        <Tabs
          items={[
            { label: "Ringkasan", value: "summary" },
            { label: "Pesanan", value: "orders" },
          ]}
          onValueChange={tab}
          value="summary"
        />
        <Pagination onPageChange={page} page={1} total={60} />
      </>,
    );
    await user.click(screen.getByRole("tab", { name: "Ringkasan" }));
    await user.keyboard("{ArrowRight}");
    expect(tab).toHaveBeenCalledWith("orders");
    await user.click(screen.getByRole("button", { name: "Halaman berikutnya" }));
    expect(page).toHaveBeenCalledWith(2);
  });
  it("keeps only the selected tab in the tab order and skips disabled tabs", async () => {
    const user = userEvent.setup();
    const tab = vi.fn();
    render(
      <Tabs
        items={[
          { label: "Produk", value: "products" },
          { disabled: true, label: "Kategori", value: "categories" },
          { label: "Modifier", value: "modifiers" },
        ]}
        label="Katalog"
        onValueChange={tab}
        value="products"
      />,
    );
    expect(screen.getByRole("tablist", { name: "Katalog" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Produk" })).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("tab", { name: "Modifier" })).toHaveAttribute("tabindex", "-1");
    await user.click(screen.getByRole("tab", { name: "Produk" }));
    await user.keyboard("{ArrowRight}");
    expect(tab).toHaveBeenLastCalledWith("modifiers");
  });
  it("shows an empty range and custom labels in pagination", () => {
    render(
      <Pagination
        formatRange={(start, end, total) => `${start}-${end} of ${total}`}
        nextLabel="Next page"
        onPageChange={vi.fn()}
        page={1}
        previousLabel="Previous page"
        total={0}
      />,
    );
    expect(screen.getByText("0-0 of 0")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next page" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Previous page" })).toBeDisabled();
  });
  it("marks final breadcrumb as current and keeps at most three levels", () => {
    render(
      <Breadcrumb
        items={[
          { href: "/", label: "Beranda" },
          { href: "/catalog", label: "Katalog" },
          { href: "/catalog/products", label: "Produk" },
          { label: "Es kopi susu" },
        ]}
      />,
    );
    expect(screen.getByText("Es kopi susu")).toHaveAttribute("aria-current", "page");
    expect(screen.queryByText("Beranda")).not.toBeInTheDocument();
  });
  it("marks the active sidebar item as the current page", () => {
    render(
      <Sidebar
        items={[
          { active: true, href: "/catalog", label: "Katalog" },
          { href: "/inventory", label: "Stok" },
        ]}
        label="Menu utama"
      />,
    );
    expect(screen.getByRole("navigation", { name: "Menu utama" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Katalog" })).toHaveAttribute("aria-current", "page");
  });
});
