import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import { FloorSelector } from "./floor-selector";

const floors = [
  { id: "floor-internal-1", label: "Lantai 1", tableCount: 8 },
  { disabled: true, id: "floor-internal-2", label: "Mezzanine", tableCount: 4 },
  { id: "floor-internal-3", label: "Rooftop", tableCount: 0 },
] as const;

describe("FloorSelector", () => {
  it("shows staff labels and optional counts without exposing internal ids", async () => {
    const onValueChange = vi.fn();
    const user = userEvent.setup();
    render(
      <FloorSelector activeId="floor-internal-1" floors={floors} onValueChange={onValueChange} />,
    );

    expect(screen.getByRole("tab", { name: "Lantai 1, 8 meja" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tab", { name: "Mezzanine, 4 meja" })).toBeDisabled();
    expect(screen.getByRole("tab", { name: "Rooftop, 0 meja" })).toBeVisible();
    expect(screen.queryByText(/floor-internal/)).not.toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Rooftop, 0 meja" }));
    expect(onValueChange).toHaveBeenCalledWith("floor-internal-3");
  });

  it("supports keyboard selection and skips disabled floors", async () => {
    const onValueChange = vi.fn();
    const user = userEvent.setup();
    render(
      <FloorSelector activeId="floor-internal-1" floors={floors} onValueChange={onValueChange} />,
    );

    const activeTab = screen.getByRole("tab", { name: "Lantai 1, 8 meja" });
    activeTab.focus();
    await user.keyboard("{ArrowRight}");

    expect(onValueChange).toHaveBeenCalledWith("floor-internal-3");
    expect(screen.getByRole("tab", { name: "Rooftop, 0 meja" })).toHaveFocus();
  });

  it("keeps one enabled tab reachable while the active id is stale", () => {
    render(
      <FloorSelector activeId="floor-stale" floors={floors} onValueChange={() => undefined} />,
    );

    expect(screen.getByRole("tab", { name: "Lantai 1, 8 meja" })).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("tab", { name: "Rooftop, 0 meja" })).toHaveAttribute("tabindex", "-1");
  });

  it("uses the custom select behavior for long or compact variants", async () => {
    const onValueChange = vi.fn();
    const user = userEvent.setup();
    render(
      <FloorSelector
        activeId="floor-internal-1"
        floors={floors}
        onValueChange={onValueChange}
        variant="select"
      />,
    );

    await user.click(screen.getByRole("button", { name: "Lantai 1" }));
    expect(screen.getByRole("option", { name: "Rooftop, 0 meja" })).toBeVisible();
    await user.click(screen.getByRole("option", { name: "Rooftop, 0 meja" }));
    expect(onValueChange).toHaveBeenCalledWith("floor-internal-3");
  });

  it("omits unavailable count metadata and handles an empty source", () => {
    const { rerender } = render(
      <FloorSelector
        activeId="floor-a"
        floors={[{ id: "floor-a", label: "Lantai Utama" }]}
        onValueChange={() => undefined}
      />,
    );

    expect(screen.getByRole("tab", { name: "Lantai Utama" })).toBeVisible();
    expect(screen.queryByText(/meja/)).not.toBeInTheDocument();

    rerender(<FloorSelector activeId="" floors={[]} onValueChange={() => undefined} />);
    expect(screen.getByText("Belum ada lantai.")).toBeVisible();
  });

  it("rejects malformed floor metadata", () => {
    expect(() =>
      render(
        <FloorSelector
          activeId="floor-a"
          floors={[
            { id: "floor-a", label: "Lantai 1" },
            { id: "floor-a", label: "Lantai 2" },
          ]}
          onValueChange={() => undefined}
        />,
      ),
    ).toThrow(/id duplikat/);
  });

  it("passes an axe smoke test", async () => {
    const { container } = render(
      <FloorSelector activeId="floor-internal-1" floors={floors} onValueChange={() => undefined} />,
    );

    expect((await axe(container)).violations).toEqual([]);
  });
});
