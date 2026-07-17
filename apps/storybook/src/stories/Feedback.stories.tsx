import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  Alert,
  Badge,
  EmptyState,
  ErrorState,
  Progress,
  Skeleton,
  Spinner,
  StatusBar,
  ToastStack,
} from "@merchant/ui/feedback";
import { Button } from "@merchant/ui/button";
import { storyContractParameters } from "./story-contract";
const meta = {
  title: "Primitives/Feedback",
  component: Badge,
  parameters: { ...storyContractParameters, layout: "padded" },
  tags: ["autodocs"],
} satisfies Meta<typeof Badge>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Variants: Story = {
  args: { children: "Status" },
  render: () => (
    <div className="story-contract-page">
      {(["info", "success", "warning", "danger", "loading", "offline"] as const).map((tone) => (
        <Badge key={tone} tone={tone}>
          {tone}
        </Badge>
      ))}
      <Alert title="Perubahan tersimpan" tone="success">
        Data outlet diperbarui.
      </Alert>
      <StatusBar label="Offline" tone="offline">
        Perubahan akan disinkronkan saat terhubung.
      </StatusBar>
      <Progress label="Unggah menu" value={64} />
      <Spinner />
      <Skeleton variant="product-card" />
    </div>
  ),
};
export const States: Story = {
  args: { children: "Status" },
  render: () => (
    <div className="story-contract-page">
      <EmptyState
        action={<Button>Tambah produk</Button>}
        description="Belum ada produk pada kategori ini."
        title="Produk belum tersedia"
      />
      <ErrorState
        action={<Button variant="outline">Coba lagi</Button>}
        description="Data tidak dapat dimuat saat ini."
        title="Terjadi kesalahan"
      />
      <ToastStack
        items={[
          { id: "saved", message: "Perubahan tersimpan", tone: "success", title: "Berhasil" },
        ]}
      />
    </div>
  ),
};
