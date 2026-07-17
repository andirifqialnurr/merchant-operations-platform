import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Breadcrumb, Pagination, Tabs } from "./navigation";
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
  it("marks final breadcrumb as current", () => {
    render(<Breadcrumb items={[{ href: "/", label: "Beranda" }, { label: "Pesanan" }]} />);
    expect(screen.getByText("Pesanan")).toHaveAttribute("aria-current", "page");
  });
});
