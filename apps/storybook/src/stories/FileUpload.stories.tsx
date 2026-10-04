import type { Meta, StoryObj } from "@storybook/react-vite";

import { FileUpload } from "@merchant/ui/file-upload";

import { storyContractParameters } from "./story-contract";

/** A small coffee-colored square, so the stories need no file from the network. */
const PREVIEW =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect width="96" height="96" fill="#8a6a4f"/><circle cx="48" cy="48" r="22" fill="#e9dccb"/></svg>',
  );

const meta = {
  title: "Primitives/FileUpload",
  component: FileUpload,
  parameters: {
    ...storyContractParameters,
    layout: "padded",
  },
  tags: ["autodocs"],
  args: {
    accept: "image/jpeg,image/png,image/webp,image/avif",
    chooseLabel: "Pilih gambar",
    hint: "JPG, PNG, WebP, atau AVIF. Maksimal 5 MB.",
    label: "Gambar produk",
    onSelect: () => undefined,
    replaceLabel: "Ganti",
  },
} satisfies Meta<typeof FileUpload>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {};

export const Uploading: Story = {
  args: { previewUrl: PREVIEW, progress: 40, progressLabel: "Mengunggah 40%" },
};

export const Uploaded: Story = {
  args: {
    onRemove: () => undefined,
    previewAlt: "Kopi susu",
    previewUrl: PREVIEW,
    removeLabel: "Hapus",
  },
};

export const Refused: Story = {
  args: { error: "Berkas kosong atau terlalu besar." },
};

export const Disabled: Story = { args: { disabled: true } };

export const ThemeComparison: Story = {
  render: (args) => (
    <div className="story-contract-theme-comparison">
      {(["light", "dark"] as const).map((theme) => (
        <section data-theme-preview={theme} key={theme}>
          <div style={{ display: "grid", gap: "var(--space-5)" }}>
            <FileUpload {...args} />
            <FileUpload
              {...args}
              label="Sedang diunggah"
              previewUrl={PREVIEW}
              progress={40}
              progressLabel="Mengunggah 40%"
            />
            <FileUpload
              {...args}
              label="Sudah diunggah"
              onRemove={() => undefined}
              previewAlt="Kopi susu"
              previewUrl={PREVIEW}
              removeLabel="Hapus"
            />
            <FileUpload {...args} error="Berkas kosong atau terlalu besar." label="Ditolak" />
          </div>
        </section>
      ))}
    </div>
  ),
};
