import type { Meta, StoryObj } from "@storybook/react-vite";
import { ArrowRight, Check, Plus, Save, Trash2 } from "lucide-react";

import { Button, IconButton } from "@merchant/ui/button";

import { storyContractParameters } from "./story-contract";

const meta = {
  title: "Primitives/Button",
  component: Button,
  parameters: {
    ...storyContractParameters,
    layout: "padded",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: "Simpan perubahan",
  },
};

export const AllVariants: Story = {
  args: {
    children: "Variant button",
  },
  render: () => (
    <div className="story-contract-grid">
      {(["primary", "secondary", "outline", "ghost", "destructive", "link"] as const).map(
        (variant) => (
          <Button key={variant} variant={variant}>
            {variant}
          </Button>
        ),
      )}
    </div>
  ),
};

export const AllSizes: Story = {
  args: {
    children: "Size button",
  },
  render: () => (
    <div className="story-contract-grid">
      {(["xs", "sm", "md", "lg", "xl"] as const).map((size) => (
        <Button key={size} size={size}>
          Simpan ({size})
        </Button>
      ))}
    </div>
  ),
};

export const States: Story = {
  args: {
    children: "State button",
  },
  render: () => (
    <div className="story-contract-grid">
      <Button>Simpan</Button>
      <Button className="is-focus-reference">Focus</Button>
      <Button disabled>Disabled</Button>
      <Button loading loadingLabel="Menyimpan perubahan...">
        Simpan perubahan
      </Button>
      <Button variant="destructive">Hapus produk</Button>
    </div>
  ),
};

export const IconsAndFullWidth: Story = {
  args: {
    children: "Icon button",
  },
  render: () => (
    <div className="story-contract-page">
      <div className="story-contract-grid">
        <Button iconLeft={Save}>Simpan perubahan</Button>
        <Button iconRight={ArrowRight}>Lanjut</Button>
        <Button fullWidth iconLeft={Check} size="lg">
          Konfirmasi pembayaran pesanan meja 12 dan kirimkan bukti transaksi kepada pelanggan
        </Button>
      </div>
      <div className="story-contract-grid">
        {(["xs", "sm", "md", "lg", "xl"] as const).map((size) => (
          <IconButton icon={Plus} key={size} label={`Tambah (${size})`} size={size} />
        ))}
        <IconButton
          icon={Trash2}
          label="Hapus produk"
          tooltip="Hapus produk ini"
          variant="destructive"
        />
      </div>
    </div>
  ),
};

export const ThemeComparison: Story = {
  args: {
    children: "Theme button",
  },
  render: () => (
    <div className="story-contract-theme-comparison">
      <section data-theme-preview="light">
        <h2 className="text-heading-sm">Light</h2>
        <Button iconLeft={Save}>Simpan perubahan</Button>
      </section>
      <section data-theme-preview="dark">
        <h2 className="text-heading-sm">Dark</h2>
        <Button iconLeft={Save}>Simpan perubahan</Button>
      </section>
    </div>
  ),
};
