import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Dialog, DropdownMenu, Tooltip } from "./overlay";
describe("overlay primitives", () => {
  it("closes dialog with Escape", async () => {
    const user = userEvent.setup();
    const close = vi.fn();
    render(
      <Dialog onOpenChange={close} open title="Edit outlet">
        <button>Simpan</button>
      </Dialog>,
    );
    await user.keyboard("{Escape}");
    expect(close).toHaveBeenCalledWith(false);
  });
  it("runs dropdown action and renders accessible tooltip", async () => {
    const user = userEvent.setup();
    const select = vi.fn();
    render(
      <>
        <DropdownMenu
          label="Aksi"
          trigger="Aksi"
          items={[{ label: "Arsipkan", onSelect: select }]}
        />
        <Tooltip content="Bantuan">?</Tooltip>
      </>,
    );
    await user.click(screen.getByRole("button", { name: "Aksi" }));
    await user.click(screen.getByRole("menuitem", { name: "Arsipkan" }));
    expect(select).toHaveBeenCalled();
    expect(screen.getByRole("tooltip")).toHaveTextContent("Bantuan");
  });
});
