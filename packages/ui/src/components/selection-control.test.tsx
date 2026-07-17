import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import { Checkbox, QuantityStepper, SegmentedControl, Switch } from "./selection-control";

describe("selection controls", () => {
  it("supports labelled indeterminate checkbox and switch", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <>
        <Checkbox indeterminate label="Pilih semua pesanan" onChange={onChange} />
        <Switch label="Pesanan aktif" />
      </>,
    );
    const checkbox = screen.getByLabelText("Pilih semua pesanan") as HTMLInputElement;
    expect(checkbox.indeterminate).toBe(true);
    await user.click(checkbox);
    expect(onChange).toHaveBeenCalledOnce();
    expect(screen.getByRole("switch", { name: "Pesanan aktif" })).toBeInTheDocument();
  });

  it("changes segmented value with the arrow keys and observes quantity limits", async () => {
    const user = userEvent.setup();
    render(
      <>
        <SegmentedControl
          defaultValue="grid"
          items={[
            { label: "Grid", value: "grid" },
            { label: "Daftar", value: "list" },
          ]}
          label="Tampilan menu"
        />
        <QuantityStepper defaultValue={1} label="Jumlah produk" max={2} min={1} />
      </>,
    );
    const grid = screen.getByRole("radio", { name: "Grid" });
    await user.click(grid);
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("radio", { name: "Daftar" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("button", { name: "Kurangi Jumlah produk" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Tambah Jumlah produk" }));
    expect(screen.getByRole("status")).toHaveTextContent("2");
  });

  it("passes an axe smoke test", async () => {
    const { container } = render(<Checkbox label="Saya menyetujui syarat layanan" />);
    expect((await axe(container)).violations).toEqual([]);
  });
});
