import type { Meta, StoryObj } from "@storybook/react-vite";
import { Combobox, Select } from "@merchant/ui/select";
import { storyContractParameters } from "./story-contract";
const options = [
  { label: "Outlet Sudirman", value: "sudirman" },
  {
    description: "Area layanan terbatas",
    disabled: true,
    disabledReason: "Akses belum diberikan",
    label: "Outlet Bandung",
    value: "bandung",
  },
  { label: "Outlet Senopati", value: "senopati" },
];
const meta = {
  title: "Primitives/Select",
  component: Select,
  parameters: { ...storyContractParameters, layout: "padded" },
  tags: ["autodocs"],
} satisfies Meta<typeof Select>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Sizes: Story = {
  args: {
    emptyLabel: "Tidak ada opsi tersedia.",
    label: "Outlet",
    options,
    placeholder: "Pilih opsi",
  },
  render: () => (
    <div className="story-contract-page">
      {(["sm", "md", "lg"] as const).map((size) => (
        <Select
          emptyLabel="Tidak ada opsi tersedia."
          placeholder="Pilih opsi"
          key={size}
          label={`Outlet ${size}`}
          options={options}
          size={size}
        />
      ))}
    </div>
  ),
};
export const States: Story = {
  args: {
    emptyLabel: "Tidak ada opsi tersedia.",
    label: "Outlet",
    options,
    placeholder: "Pilih opsi",
  },
  render: () => (
    <div className="story-contract-page">
      <Select
        emptyLabel="Tidak ada opsi tersedia."
        placeholder="Pilih opsi"
        defaultValue="sudirman"
        label="Outlet"
        options={options}
      />
      <Select
        emptyLabel="Tidak ada opsi tersedia."
        placeholder="Pilih opsi"
        error="Outlet wajib dipilih."
        label="Outlet"
        options={options}
      />
      <Combobox
        searchPlaceholder="Cari..."
        emptyLabel="Tidak ada opsi tersedia."
        placeholder="Pilih opsi"
        errorLabel="Gagal memuat daftar outlet."
        label="Cari outlet"
        onRetry={() => undefined}
        options={options}
      />
      <Combobox
        searchPlaceholder="Cari..."
        emptyLabel="Tidak ada opsi tersedia."
        placeholder="Pilih opsi"
        label="Cari outlet"
        loading
        options={options}
      />
    </div>
  ),
};
export const ThemeComparison: Story = {
  args: {
    emptyLabel: "Tidak ada opsi tersedia.",
    label: "Outlet",
    options,
    placeholder: "Pilih opsi",
  },
  render: () => (
    <div className="story-contract-theme-comparison">
      <section data-theme-preview="light">
        <h2 className="text-heading-sm">Light</h2>
        <Select
          emptyLabel="Tidak ada opsi tersedia."
          placeholder="Pilih opsi"
          label="Outlet"
          options={options}
        />
      </section>
      <section data-theme-preview="dark">
        <h2 className="text-heading-sm">Dark</h2>
        <Select
          emptyLabel="Tidak ada opsi tersedia."
          placeholder="Pilih opsi"
          label="Outlet"
          options={options}
        />
      </section>
    </div>
  ),
};
