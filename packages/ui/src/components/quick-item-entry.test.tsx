import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import { emptyQuickItem, QuickItemEntry, type QuickItem } from "./quick-item-entry";

const labels = {
  add: "Tambah item",
  decrease: "Kurangi",
  increase: "Tambah",
  item: (position: number) => `Item ${position}`,
  name: "Nama item",
  note: "Catatan",
  quantity: "Jumlah",
  remove: (position: number) => `Hapus item ${position}`,
};

function Form({
  error,
  onChange,
  start = [emptyQuickItem()],
}: {
  error?: string;
  onChange?: (items: QuickItem[]) => void;
  start?: QuickItem[];
}) {
  const [items, setItems] = useState(start);
  return (
    <QuickItemEntry
      {...(error ? { error } : {})}
      items={items}
      labels={labels}
      onItemsChange={(next) => {
        onChange?.(next);
        setItems(next);
      }}
    />
  );
}

const values = (items: QuickItem[]) =>
  items.map((item) => `${item.quantity}x ${item.name}${item.note ? ` (${item.note})` : ""}`);

describe("QuickItemEntry", () => {
  it("types a list from the keyboard: Enter in a name moves on to a new line", async () => {
    const user = userEvent.setup();
    const change = vi.fn();
    render(<Form onChange={change} />);

    await user.type(screen.getByLabelText("Nama item 1"), "Nasi goreng{Enter}");
    expect(await screen.findByLabelText("Nama item 2")).toHaveFocus();
    await user.type(screen.getByLabelText("Nama item 2"), "Es teh");
    await user.type(screen.getByLabelText("Catatan 2"), "tanpa gula");

    expect(values(change.mock.lastCall?.[0])).toEqual(["1x Nasi goreng", "1x Es teh (tanpa gula)"]);
  });

  it("does not add a line from an empty name, and Enter never submits the form", async () => {
    const user = userEvent.setup();
    const submit = vi.fn((event: { preventDefault(): void }) => event.preventDefault());
    render(
      <form onSubmit={submit}>
        <Form />
      </form>,
    );
    await user.type(screen.getByLabelText("Nama item 1"), "{Enter}");
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    await user.type(screen.getByLabelText("Nama item 1"), "Kopi{Enter}");
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(submit).not.toHaveBeenCalled();
  });

  it("counts with the stepper, never below one", async () => {
    const user = userEvent.setup();
    const change = vi.fn();
    render(<Form onChange={change} />);

    const quantity = screen.getByRole("group", { name: "Jumlah 1" });
    expect(screen.getByRole("button", { name: "Kurangi" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Tambah" }));
    await user.click(screen.getByRole("button", { name: "Tambah" }));
    expect(change.mock.lastCall?.[0][0].quantity).toBe(3);
    expect(quantity).toHaveTextContent("3");
  });

  it("removes a line, and always keeps one to type into", async () => {
    const user = userEvent.setup();
    const change = vi.fn();
    render(
      <Form
        onChange={change}
        start={[
          { key: "a", name: "Nasi goreng", note: "", quantity: 2 },
          { key: "b", name: "Es teh", note: "", quantity: 1 },
        ]}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Hapus item 1" }));
    expect(values(change.mock.lastCall?.[0])).toEqual(["1x Es teh"]);

    await user.click(screen.getByRole("button", { name: "Hapus item 1" }));
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    expect(screen.getByLabelText("Nama item 1")).toHaveValue("");
    // Nothing left to remove from a single empty line.
    expect(screen.getByRole("button", { name: "Hapus item 1" })).toBeDisabled();
  });

  it("stops adding at the limit and shows its error in words", async () => {
    const start = [
      { key: "a", name: "A", note: "", quantity: 1 },
      { key: "b", name: "B", note: "", quantity: 1 },
    ];
    function Limited() {
      const [items, setItems] = useState<QuickItem[]>(start);
      return (
        <QuickItemEntry
          error="Isi minimal satu item."
          items={items}
          labels={labels}
          maxItems={2}
          onItemsChange={setItems}
        />
      );
    }
    render(<Limited />);
    expect(screen.getByRole("button", { name: "Tambah item" })).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent("Isi minimal satu item.");
    expect(screen.getByLabelText("Nama item 1")).toHaveAccessibleDescription(
      "Isi minimal satu item.",
    );
  });

  it("passes an axe smoke test", async () => {
    const { container } = render(
      <Form start={[{ key: "a", name: "Nasi goreng", note: "pedas", quantity: 2 }]} />,
    );
    expect((await axe(container)).violations).toEqual([]);
  });
});
