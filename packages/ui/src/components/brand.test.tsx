import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";

import { Brand, BrandMark } from "./brand";

describe("brand", () => {
  it("names the mark only when it stands alone", () => {
    const { container, rerender } = render(<BrandMark label="Cafe Companion" />);
    expect(screen.getByRole("img", { name: "Cafe Companion" })).toBeInTheDocument();

    rerender(<Brand name="Cafe Companion" />);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByText("Cafe Companion")).toBeVisible();
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("applies size and tone variants", () => {
    const { container } = render(<BrandMark label="Cafe Companion" size="lg" tone="mono" />);
    expect(container.querySelector("svg")).toHaveClass("ui-brand-mark--lg", "ui-brand-mark--mono");
  });

  it("passes an axe smoke test", async () => {
    const { container } = render(
      <main>
        <Brand name="Cafe Companion" />
        <BrandMark label="Cafe Companion" tone="mono" />
      </main>,
    );
    expect((await axe(container)).violations).toEqual([]);
  });
});
