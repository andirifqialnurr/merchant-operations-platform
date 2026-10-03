import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AlertDialog, Dialog, DropdownMenu, Popover, Sheet, Tooltip } from "./overlay";
describe("overlay primitives", () => {
  it("closes dialog with Escape", async () => {
    const user = userEvent.setup();
    const close = vi.fn();
    render(
      <Dialog closeLabel="Tutup" onOpenChange={close} open title="Edit outlet">
        <button>Simpan</button>
      </Dialog>,
    );
    await user.keyboard("{Escape}");
    expect(close).toHaveBeenCalledWith(false);
  });
  it("names the dialog and sheet from their titles and close labels", () => {
    render(
      <>
        <Dialog closeLabel="Tutup" onOpenChange={vi.fn()} open title="Edit outlet">
          Isi
        </Dialog>
        <Sheet closeLabel="Tutup panel produk" onOpenChange={vi.fn()} open title="Produk">
          Isi
        </Sheet>
      </>,
    );
    expect(screen.getByRole("dialog", { name: "Edit outlet" })).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Produk" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tutup" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tutup panel produk" })).toBeInTheDocument();
  });
  it("confirms an alert dialog through design-system buttons", async () => {
    const user = userEvent.setup();
    const confirm = vi.fn();
    const close = vi.fn();
    render(
      <AlertDialog
        closeLabel="Tutup"
        cancelLabel="Kembali"
        confirmLabel="Hapus produk"
        onConfirm={confirm}
        onOpenChange={close}
        open
        title="Hapus produk?"
      >
        Produk tidak dapat dipulihkan.
      </AlertDialog>,
    );
    expect(screen.getByRole("button", { name: "Kembali" })).toHaveClass("ui-button--secondary");
    const confirmButton = screen.getByRole("button", { name: "Hapus produk" });
    expect(confirmButton).toHaveClass("ui-button--destructive");
    await user.click(confirmButton);
    expect(confirm).toHaveBeenCalled();
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
    expect(screen.getByText("?")).toHaveAccessibleDescription("Bantuan");
  });
  it("moves through dropdown items with arrow keys and closes with Escape", async () => {
    const user = userEvent.setup();
    render(
      <DropdownMenu
        label="Aksi"
        trigger="Aksi"
        items={[
          { label: "Ubah", onSelect: vi.fn() },
          { disabled: true, label: "Duplikat", onSelect: vi.fn() },
          { destructive: true, label: "Hapus", onSelect: vi.fn() },
        ]}
      />,
    );
    const trigger = screen.getByRole("button", { name: "Aksi" });
    await user.click(trigger);
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("menuitem", { name: "Ubah" })).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("menuitem", { name: "Hapus" })).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
  it("closes a popover when the user presses outside", async () => {
    const user = userEvent.setup();
    render(
      <>
        <Popover content="Filter status">Filter</Popover>
        <button type="button">Di luar</button>
      </>,
    );
    await user.click(screen.getByRole("button", { name: "Filter" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("Filter status");
    await user.click(screen.getByRole("button", { name: "Di luar" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
