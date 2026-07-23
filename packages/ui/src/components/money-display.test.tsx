import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";

import { formatMoneyMinor, MoneyDisplay } from "./money-display";

describe("formatMoneyMinor", () => {
  it("formats IDR minor-unit exactly for zero, negative, and large values", () => {
    expect(formatMoneyMinor(0)).toBe("Rp0");
    expect(formatMoneyMinor(-50_000)).toBe("-Rp50.000");
    expect(formatMoneyMinor("900719925474099312345")).toBe("Rp900.719.925.474.099.312.345");
  });

  it("supports currency fraction digits and accounting parentheses", () => {
    expect(formatMoneyMinor(123_45, { currency: "USD" })).toBe("$123,45");
    expect(formatMoneyMinor(-123_45, { currency: "USD", negativeFormat: "parentheses" })).toBe(
      "($123,45)",
    );
  });

  it("rejects values that can lose minor-unit precision", () => {
    expect(() => formatMoneyMinor(Number.MAX_SAFE_INTEGER + 1)).toThrow(/safe integer/);
    expect(() => formatMoneyMinor("12.50")).toThrow(/string integer/);
  });
});

describe("MoneyDisplay", () => {
  it("keeps a real zero distinct from unavailable data", () => {
    render(
      <main>
        <MoneyDisplay amountMinor={0} data-testid="zero" />
        <MoneyDisplay amountMinor={null} data-testid="unavailable" />
      </main>,
    );

    expect(screen.getByTestId("zero")).toHaveTextContent("Rp0");
    expect(screen.getByTestId("unavailable")).toHaveTextContent("-");
    expect(screen.getByText("Nominal tidak tersedia")).toBeInTheDocument();
  });

  it("maps variants and default sizes to their visual contract", () => {
    render(
      <main>
        <MoneyDisplay amountMinor={25_000} data-testid="inline" />
        <MoneyDisplay amountMinor={25_000} data-testid="summary" variant="summary" />
        <MoneyDisplay amountMinor={25_000} data-testid="total" variant="total" />
        <MoneyDisplay amountMinor={-25_000} data-testid="accounting" variant="accounting" />
      </main>,
    );

    expect(screen.getByTestId("inline")).toHaveClass(
      "ui-money-display--inline",
      "ui-money-display--md",
    );
    expect(screen.getByTestId("summary")).toHaveClass(
      "ui-money-display--summary",
      "ui-money-display--lg",
    );
    expect(screen.getByTestId("total")).toHaveClass(
      "ui-money-display--total",
      "ui-money-display--xl",
    );
    expect(screen.getByTestId("accounting")).toHaveClass(
      "ui-money-display--accounting",
      "ui-money-display--sm",
    );
  });

  it("passes an axe smoke test including unavailable data", async () => {
    const { container } = render(
      <main>
        <MoneyDisplay amountMinor={75_900} variant="total" />
        <MoneyDisplay amountMinor={null} unavailableLabel="Pendapatan belum tersedia" />
      </main>,
    );

    expect((await axe(container)).violations).toEqual([]);
  });
});
