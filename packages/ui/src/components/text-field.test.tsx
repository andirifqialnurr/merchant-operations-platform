import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import { FormField, Input, Textarea } from "./text-field";

describe("text field primitives", () => {
  it("connects the label and error description to the input", () => {
    render(
      <FormField
        error="Nama produk wajib diisi."
        htmlFor="product-name"
        label="Nama produk"
        required
      >
        <Input id="product-name" />
      </FormField>,
    );

    const input = screen.getByLabelText(/Nama produk/);
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("Nama produk wajib diisi.");
    expect(screen.getByRole("alert")).toHaveTextContent("Nama produk wajib diisi.");
  });

  it("supports clearable search and password visibility actions", async () => {
    const user = userEvent.setup();
    const onClear = vi.fn();

    const { rerender } = render(
      <Input clearable id="search" onClear={onClear} value="kopi" variant="search" readOnly />,
    );
    await user.click(screen.getByRole("button", { name: "Hapus pencarian" }));
    expect(onClear).toHaveBeenCalledOnce();

    rerender(<Input id="password" readOnly value="" variant="password" />);
    const password = document.querySelector<HTMLInputElement>("#password");
    expect(password).toHaveAttribute("type", "password");
    await user.click(screen.getByRole("button", { name: "Tampilkan kata sandi" }));
    expect(password).toHaveAttribute("type", "text");
  });

  it("renders prefix, suffix, readonly, invalid, and auto-grow contracts", () => {
    render(
      <div>
        <Input id="price" invalid prefix="Rp" readOnly suffix="/ porsi" value="25000" />
        <Textarea autoGrow id="note" invalid size="lg" />
      </div>,
    );

    expect(screen.getByDisplayValue("25000")).toHaveAttribute("readonly");
    expect(document.querySelector("#note")).toHaveClass("ui-textarea--auto-grow");
    expect(screen.getAllByRole("textbox")).toHaveLength(2);
  });

  it("passes an axe smoke test", async () => {
    const { container } = render(
      <FormField
        helperText="Gunakan nama yang mudah dikenali kasir."
        htmlFor="product-name"
        label="Nama produk"
      >
        <Input id="product-name" placeholder="Contoh: Kopi Susu Aren" />
      </FormField>,
    );

    const results = await axe(container);
    expect(results.violations).toEqual([]);
  });
});
