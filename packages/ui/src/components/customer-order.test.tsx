import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import { OrderProgress, StickyCartBar } from "./customer-order";

describe("StickyCartBar", () => {
  it("shows the count and total and opens the cart", async () => {
    const onOpen = vi.fn();
    const { container } = render(
      <StickyCartBar countLabel="3 item" onOpen={onOpen} totalLabel="Rp75.000" />,
    );

    const button = screen.getByRole("button", { name: /3 item.*Rp75\.000/ });
    await userEvent.click(button);
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect((await axe(container)).violations).toEqual([]);
  });
});

describe("OrderProgress", () => {
  const steps = ["Diterima", "Disiapkan", "Siap"];

  it("marks done steps and names the current one", async () => {
    const { container } = render(
      <OrderProgress current={1} label="Progres pesanan 12" steps={steps} />,
    );

    const list = screen.getByRole("list", { name: "Progres pesanan 12" });
    const items = list.querySelectorAll("li");
    expect(items[0]).toHaveClass("is-done");
    expect(items[1]).toHaveAttribute("aria-current", "step");
    expect(items[2]).not.toHaveAttribute("aria-current");
    expect(screen.getByText("Disiapkan")).toBeVisible();
    expect((await axe(container)).violations).toEqual([]);
  });

  it("fills every step once the order is at the last one", () => {
    render(<OrderProgress current={2} label="Progres" steps={steps} />);
    const items = screen.getByRole("list").querySelectorAll("li");
    expect(items[0]).toHaveClass("is-done");
    expect(items[1]).toHaveClass("is-done");
    expect(items[2]).toHaveClass("is-current");
  });
});
