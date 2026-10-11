import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import { MultiSelect } from "./select";

const options = [
  { label: "Pusat", value: "pusat" },
  { label: "Timur", value: "timur" },
  { label: "Barat", value: "barat" },
  { disabled: true, disabledReason: "Outlet nonaktif", label: "Lama", value: "lama" },
];

function Outlets({ onChange }: { onChange?: (values: string[]) => void }) {
  const [values, setValues] = useState<string[]>([]);
  return (
    <MultiSelect
      emptyLabel="Belum ada outlet."
      label="Outlet"
      onValuesChange={(next) => {
        onChange?.(next);
        setValues(next);
      }}
      options={options}
      placeholder="Pilih outlet"
      selectedLabel={(count) => `${count} outlet dipilih`}
      values={values}
    />
  );
}

describe("MultiSelect", () => {
  it("keeps the menu open while several options are switched on and off", async () => {
    const user = userEvent.setup();
    const change = vi.fn();
    render(<Outlets onChange={change} />);

    const trigger = screen.getByRole("button", { name: "Pilih outlet" });
    await user.click(trigger);
    expect(screen.getByRole("listbox")).toHaveAttribute("aria-multiselectable", "true");
    // Chosen out of order; the values come back in the order of the options.
    await user.click(screen.getByRole("option", { name: "Timur" }));
    await user.click(screen.getByRole("option", { name: "Pusat" }));
    expect(change).toHaveBeenLastCalledWith(["pusat", "timur"]);
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Pusat" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("option", { name: "Barat" })).toHaveAttribute("aria-selected", "false");

    await user.click(screen.getByRole("option", { name: "Timur" }));
    expect(change).toHaveBeenLastCalledWith(["pusat"]);
  });

  it("names what is chosen, and counts it when there are many", async () => {
    const user = userEvent.setup();
    render(<Outlets />);
    const trigger = screen.getByRole("button", { name: "Pilih outlet" });
    await user.click(trigger);
    await user.click(screen.getByRole("option", { name: "Pusat" }));
    expect(trigger).toHaveTextContent("Pusat");
    await user.click(screen.getByRole("option", { name: "Timur" }));
    expect(trigger).toHaveTextContent("Pusat, Timur");
    await user.click(screen.getByRole("option", { name: "Barat" }));
    expect(trigger).toHaveTextContent("3 outlet dipilih");
  });

  it("works from the keyboard and returns focus to the trigger on Escape", async () => {
    const user = userEvent.setup();
    const change = vi.fn();
    render(<Outlets onChange={change} />);

    const trigger = screen.getByRole("button", { name: "Pilih outlet" });
    trigger.focus();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("option", { name: "Pusat" })).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("option", { name: "Timur" })).toHaveFocus();
    await user.keyboard(" ");
    expect(change).toHaveBeenLastCalledWith(["timur"]);
    // The disabled option is skipped: after Barat comes Pusat again.
    await user.keyboard("{ArrowDown}{ArrowDown}");
    expect(screen.getByRole("option", { name: "Pusat" })).toHaveFocus();
    expect(screen.getByRole("option", { name: /Lama/ })).toBeDisabled();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("shows its error and an empty list in words", async () => {
    const user = userEvent.setup();
    render(
      <MultiSelect
        emptyLabel="Belum ada outlet."
        error="Pilih minimal satu outlet."
        label="Outlet"
        onValuesChange={() => undefined}
        options={[]}
        placeholder="Pilih outlet"
        selectedLabel={(count) => `${count} outlet dipilih`}
        values={[]}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Pilih minimal satu outlet.");
    await user.click(screen.getByRole("button", { name: "Pilih outlet" }));
    expect(screen.getByText("Belum ada outlet.")).toBeInTheDocument();
  });

  it("passes an axe smoke test", async () => {
    const { container } = render(<Outlets />);
    expect((await axe(container)).violations).toEqual([]);
  });
});

describe("a list inside a sheet", () => {
  it("closes on Escape without closing the sheet around it", async () => {
    const { Sheet } = await import("./overlay");
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(
      <Sheet closeLabel="Tutup" onOpenChange={onOpenChange} open title="Undang pengguna">
        <Outlets />
      </Sheet>,
    );
    await user.click(screen.getByRole("button", { name: "Pilih outlet" }));
    await user.click(screen.getByRole("option", { name: "Pusat" }));
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    // What was typed in the sheet is still there.
    expect(onOpenChange).not.toHaveBeenCalled();
    // With nothing left open inside, Escape closes the sheet as before.
    await user.keyboard("{Escape}");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
