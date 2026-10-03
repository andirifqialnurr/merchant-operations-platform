import type { Meta, StoryObj } from "@storybook/react-vite";

import { Button } from "@merchant/ui/button";
import { ModuleAccessState } from "@merchant/ui/module-access-state";

import { storyContractParameters } from "./story-contract";

const meta = {
  title: "Patterns/ModuleAccessState",
  component: ModuleAccessState,
  parameters: {
    ...storyContractParameters,
    layout: "padded",
  },
  tags: ["autodocs"],
  args: {
    description: "Peran Anda tidak mengizinkan tindakan ini. Minta akses ke pemilik bisnis.",
    reason: "permission-denied",
    title: "Anda tidak punya akses",
  },
} satisfies Meta<typeof ModuleAccessState>;

export default meta;
type Story = StoryObj<typeof meta>;

export const PermissionDenied: Story = {};

export const NotEntitled: Story = {
  args: {
    action: <Button variant="secondary">Lihat modul</Button>,
    description: "Modul ini tidak termasuk dalam langganan bisnis ini.",
    reason: "not-entitled",
    title: "Kitchen Display belum tersedia",
  },
};

export const TierRequired: Story = {
  args: {
    action: <Button variant="secondary">Lihat langganan</Button>,
    description: "Pisah tagihan tersedia mulai tingkat Pro.",
    reason: "tier-required",
    title: "Butuh tingkat Pro",
  },
};

export const Provisioning: Story = {
  args: {
    description: "Modul sedang disiapkan. Biasanya selesai dalam beberapa detik.",
    reason: "provisioning",
    title: "Menyiapkan Kasir",
  },
};

export const SetupRequired: Story = {
  args: {
    action: <Button>Lanjutkan pengaturan</Button>,
    description: "Selesaikan langkah berikut sebelum kasir dipakai.",
    reason: "setup-required",
    steps: [
      { done: true, label: "Beri nama perangkat kasir pertama" },
      { done: false, label: "Pilih ukuran struk" },
    ],
    stepsLabel: "Langkah pengaturan",
    title: "Kasir belum selesai diatur",
  },
};

export const Paused: Story = {
  args: {
    action: <Button variant="secondary">Coba lagi</Button>,
    description: "Modul ini sedang dijeda. Data terakhir tetap tersimpan.",
    reason: "paused",
    title: "Kasir dijeda",
  },
};

export const SubscriptionSuspended: Story = {
  args: {
    description: "Langganan bisnis ini tidak dapat dipakai. Hubungi pemilik bisnis.",
    reason: "subscription-suspended",
    title: "Langganan ditangguhkan",
  },
};

export const ThemeComparison: Story = {
  render: (args) => (
    <div className="story-contract-theme-comparison">
      <section data-theme-preview="light">
        <ModuleAccessState {...args} />
      </section>
      <section data-theme-preview="dark">
        <ModuleAccessState {...args} />
      </section>
    </div>
  ),
};
