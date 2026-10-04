import type { Meta, StoryObj } from "@storybook/react-vite";

import { PermissionMatrix } from "@merchant/ui/permission-matrix";

import { storyContractParameters } from "./story-contract";

const all = ["owner", "manager", "cashier", "kitchen", "waiter"];

const meta = {
  title: "Patterns/PermissionMatrix",
  component: PermissionMatrix,
  parameters: {
    ...storyContractParameters,
    layout: "padded",
  },
  tags: ["autodocs"],
  args: {
    caption: "Izin tiap peran",
    columns: [
      { key: "owner", label: "Pemilik" },
      { key: "manager", label: "Manajer" },
      { key: "cashier", label: "Kasir" },
      { key: "kitchen", label: "Dapur" },
      { key: "waiter", label: "Pelayan" },
    ],
    grantedLabel: "Boleh",
    groups: [
      {
        key: "selling",
        label: "Penjualan dan kasir",
        rows: [
          {
            granted: new Set(["owner", "manager", "cashier", "waiter"]),
            key: "order.create",
            label: "Membuat pesanan",
          },
          {
            granted: new Set(["owner", "manager", "cashier"]),
            key: "payment.confirm",
            label: "Menerima pembayaran",
          },
          {
            granted: new Set(["owner", "manager"]),
            key: "payment.refund",
            label: "Mengembalikan uang (refund)",
          },
        ],
      },
      {
        key: "catalog",
        label: "Katalog",
        rows: [
          { granted: new Set(["owner", "manager"]), key: "catalog.read", label: "Melihat katalog" },
          {
            granted: new Set(["owner", "manager"]),
            key: "catalog.manage",
            label: "Mengubah produk, kategori, dan harga",
          },
        ],
      },
      {
        key: "people",
        label: "Pengguna dan peran",
        rows: [
          {
            granted: new Set(["owner", "manager"]),
            key: "access.membership.manage",
            label: "Mengundang dan mencabut akses pengguna",
          },
          {
            granted: new Set(["owner"]),
            key: "access.role.manage",
            label: "Membuat dan mengubah peran",
          },
        ],
      },
    ],
    notGrantedLabel: "Tidak",
    permissionLabel: "Izin",
  },
} satisfies Meta<typeof PermissionMatrix>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** Many roles: the permission names stay in place while the roles scroll. */
export const ManyRoles: Story = {
  args: {
    columns: [
      ...all.map((key) => ({ key, label: key[0]?.toUpperCase() + key.slice(1) })),
      ...["Shift leader", "Barista", "Gudang", "Keuangan", "Supervisor"].map((label) => ({
        key: label,
        label,
      })),
    ],
  },
};

export const ThemeComparison: Story = {
  render: (args) => (
    <div className="story-contract-theme-comparison">
      <section data-theme-preview="light">
        <PermissionMatrix {...args} />
      </section>
      <section data-theme-preview="dark">
        <PermissionMatrix {...args} />
      </section>
    </div>
  ),
};
