import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { AlertDialog, Dialog, DropdownMenu, Popover, Sheet, Tooltip } from "@merchant/ui/overlay";
import { Button } from "@merchant/ui/button";
import { storyContractParameters } from "./story-contract";
const meta = {
  title: "Primitives/Overlay",
  component: Dialog,
  parameters: { ...storyContractParameters, layout: "padded" },
  tags: ["autodocs"],
} satisfies Meta<typeof Dialog>;
export default meta;
type Story = StoryObj<typeof meta>;
export const DialogAndSheet: Story = {
  args: {
    children: "Konten overlay",
    closeLabel: "Tutup",
    onOpenChange: () => undefined,
    open: false,
    title: "Contoh",
  },
  render: () => {
    const [dialog, setDialog] = useState(false);
    const [sheet, setSheet] = useState(false);
    return (
      <div className="story-contract-grid">
        <Button onClick={() => setDialog(true)}>Buka dialog</Button>
        <Button onClick={() => setSheet(true)} variant="outline">
          Buka panel
        </Button>
        <Dialog
          closeLabel="Tutup"
          footer={<Button>Simpan</Button>}
          onOpenChange={setDialog}
          open={dialog}
          title="Edit outlet"
        >
          Konten form ditampilkan di sini.
        </Dialog>
        <Sheet closeLabel="Tutup" onOpenChange={setSheet} open={sheet} title="Filter pesanan">
          Filter ringkas untuk daftar pesanan.
        </Sheet>
      </div>
    );
  },
};
export const Menus: Story = {
  args: {
    children: "Konten overlay",
    closeLabel: "Tutup",
    onOpenChange: () => undefined,
    open: false,
    title: "Contoh",
  },
  render: () => (
    <div className="story-contract-grid">
      <Popover content="Konten filter ringan">Buka popover</Popover>
      <DropdownMenu
        label="Aksi pesanan"
        trigger="Aksi"
        items={[
          { label: "Duplikasi", onSelect: () => undefined },
          { destructive: true, label: "Hapus", onSelect: () => undefined },
        ]}
      />
      <Tooltip content="Informasi tambahan">?</Tooltip>
      <AlertDialog
        cancelLabel="Batal"
        closeLabel="Tutup"
        confirmLabel="Hapus outlet"
        onConfirm={() => undefined}
        onOpenChange={() => undefined}
        open={false}
        title="Hapus outlet"
      >
        Tindakan ini tidak dapat dibatalkan.
      </AlertDialog>
    </div>
  ),
};
