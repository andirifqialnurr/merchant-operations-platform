import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ArrowRight, Save, Trash2 } from "lucide-react";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import { Button, IconButton } from "./button";

describe("Button", () => {
  it("renders every variant and size contract", () => {
    const { rerender } = render(<Button variant="primary">Simpan</Button>);
    expect(screen.getByRole("button", { name: "Simpan" })).toHaveClass("ui-button--primary");

    for (const variant of ["secondary", "outline", "ghost", "destructive", "link"] as const) {
      rerender(<Button variant={variant}>Tindakan</Button>);
      expect(screen.getByRole("button", { name: "Tindakan" })).toHaveClass(`ui-button--${variant}`);
    }

    for (const size of ["xs", "sm", "md", "lg", "xl"] as const) {
      rerender(<Button size={size}>Tindakan</Button>);
      expect(screen.getByRole("button", { name: "Tindakan" })).toHaveClass(`ui-button--${size}`);
    }
  });

  it("prevents repeated action while loading and keeps a contextual label", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();

    render(
      <Button loading loadingLabel="Menyimpan perubahan..." onClick={onClick}>
        Simpan perubahan
      </Button>,
    );

    const button = screen.getByRole("button", { name: "Menyimpan perubahan..." });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    await user.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("supports icons and full-width layout without losing button semantics", () => {
    render(
      <Button fullWidth iconLeft={Save} iconRight={ArrowRight}>
        Simpan perubahan
      </Button>,
    );

    expect(screen.getByRole("button", { name: "Simpan perubahan" })).toHaveClass(
      "ui-button--full-width",
    );
  });

  it("provides an accessible icon button and tooltip fallback", () => {
    render(<IconButton icon={Trash2} label="Hapus produk" tooltip="Hapus produk ini" />);

    const button = screen.getByRole("button", { name: "Hapus produk" });
    expect(button).toHaveAttribute("title", "Hapus produk ini");
    expect(button).toHaveClass("ui-icon-button");
  });

  it("passes an axe smoke test", async () => {
    const { container } = render(
      <div>
        <Button iconLeft={Save}>Simpan perubahan</Button>
        <IconButton icon={Trash2} label="Hapus produk" />
      </div>,
    );

    const results = await axe(container);
    expect(results.violations).toEqual([]);
  });
});
