import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";

import { UsageLimitState, UsageMeter, usageLevel } from "./usage-limit-state";

describe("usageLevel", () => {
  it("follows the thresholds of the design system", () => {
    expect(usageLevel(0, 50)).toBe("normal");
    expect(usageLevel(39, 50)).toBe("normal");
    expect(usageLevel(40, 50)).toBe("near");
    expect(usageLevel(44, 50)).toBe("near");
    expect(usageLevel(45, 50)).toBe("almost");
    expect(usageLevel(49, 50)).toBe("almost");
    expect(usageLevel(50, 50)).toBe("reached");
    expect(usageLevel(70, 50)).toBe("reached");
  });

  it("treats no cap as unlimited and a zero cap as reached", () => {
    expect(usageLevel(1_000_000, null)).toBe("unlimited");
    expect(usageLevel(0, 0)).toBe("reached");
  });
});

describe("UsageMeter", () => {
  it("shows the name, the usage against the limit, and a meter with the same numbers", () => {
    render(<UsageMeter label="Produk aktif" limit={50} used={20} valueLabel="20 dari 50" />);

    expect(screen.getByText("Produk aktif")).toBeVisible();
    expect(screen.getByText("20 dari 50")).toBeVisible();
    const meter = screen.getByRole("meter", { name: "Produk aktif" });
    expect(meter).toHaveAttribute("aria-valuenow", "20");
    expect(meter).toHaveAttribute("aria-valuemax", "50");
    expect(meter).toHaveAttribute("aria-valuetext", "20 dari 50");
  });

  it("says the level in words once usage is near the limit, not only by color", () => {
    const { container, rerender } = render(
      <UsageMeter
        label="Produk aktif"
        levelLabel="Mendekati batas"
        limit={50}
        used={20}
        valueLabel="20 dari 50"
      />,
    );
    // Normal usage needs no extra words.
    expect(screen.queryByText("Mendekati batas")).not.toBeInTheDocument();
    expect(container.querySelector(".ui-usage-meter")).toHaveAttribute("data-level", "normal");

    rerender(
      <UsageMeter
        label="Produk aktif"
        levelLabel="Mendekati batas"
        limit={50}
        used={42}
        valueLabel="42 dari 50"
      />,
    );
    expect(screen.getByText("Mendekati batas")).toBeVisible();
    expect(container.querySelector(".ui-usage-meter")).toHaveAttribute("data-level", "near");
    expect(screen.getByRole("meter")).toHaveAttribute(
      "aria-valuetext",
      "42 dari 50, Mendekati batas",
    );
  });

  it("keeps the bar full and the numbers honest when usage is over the limit", () => {
    const { container } = render(
      <UsageMeter
        label="Penjualan bulan ini"
        levelLabel="Melebihi kuota"
        limit={1000}
        note="Reset 1 Nov 2026"
        used={1200}
        valueLabel="1.200 dari 1.000"
      />,
    );
    const meter = screen.getByRole("meter");
    expect(meter).toHaveAttribute("aria-valuenow", "1000");
    expect(meter).toHaveAttribute("aria-valuetext", "1.200 dari 1.000, Melebihi kuota");
    expect(meter.firstElementChild).toHaveStyle({ inlineSize: "100%" });
    expect(screen.getByText("Reset 1 Nov 2026")).toBeVisible();
    expect(container.querySelector(".ui-usage-meter")).toHaveAttribute("data-level", "reached");
  });

  it("shows no bar for a dimension without a cap", () => {
    render(
      <UsageMeter label="Outlet aktif" levelLabel="unused" limit={null} used={3} valueLabel="3" />,
    );
    expect(screen.queryByRole("meter")).not.toBeInTheDocument();
    expect(screen.getByText("3")).toBeVisible();
    expect(screen.queryByText("unused")).not.toBeInTheDocument();
  });
});

describe("UsageLimitState", () => {
  it("explains the full limit with its numbers and at most one action", async () => {
    const { container } = render(
      <UsageLimitState
        action={<button type="button">Lihat langganan</button>}
        description="Paket ini memuat 50 produk aktif. Produk yang sudah ada tetap bisa dijual."
        meter={{
          label: "Produk aktif",
          levelLabel: "Batas tercapai",
          limit: 50,
          used: 50,
          valueLabel: "50 dari 50",
        }}
        title="Batas produk tercapai"
      />,
    );
    const state = screen.getByRole("status");
    expect(within(state).getByRole("heading", { name: "Batas produk tercapai" })).toBeVisible();
    expect(within(state).getByRole("meter", { name: "Produk aktif" })).toBeVisible();
    expect(within(state).getByText("Batas tercapai")).toBeVisible();
    expect(within(state).getAllByRole("button")).toHaveLength(1);
    expect((await axe(container)).violations).toEqual([]);
  });

  it("works without numbers and without an action, for people who do not see billing", async () => {
    const { container } = render(
      <UsageLimitState
        description="Hubungi pemilik bisnis untuk menambah kapasitas."
        title="Batas produk tercapai"
      />,
    );
    expect(screen.queryByRole("meter")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect((await axe(container)).violations).toEqual([]);
  });
});
