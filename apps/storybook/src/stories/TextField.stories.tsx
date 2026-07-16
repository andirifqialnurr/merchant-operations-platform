import type { Meta, StoryObj } from "@storybook/react-vite";

import { FormField, Input, Textarea } from "@merchant/ui/input";

import { storyContractParameters } from "./story-contract";

const meta = {
  title: "Primitives/Text field",
  component: Input,
  parameters: {
    ...storyContractParameters,
    layout: "padded",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof Input>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    id: "product-name",
    placeholder: "Contoh: Kopi Susu Aren",
  },
  render: (args) => (
    <FormField
      helperText="Gunakan nama yang mudah dikenali kasir."
      htmlFor="product-name"
      label="Nama produk"
      required
    >
      <Input {...args} />
    </FormField>
  ),
};

export const VariantsAndStates: Story = {
  args: { id: "field-story" },
  render: () => (
    <div className="story-contract-page">
      <FormField htmlFor="search-menu" label="Cari menu">
        <Input
          clearable
          id="search-menu"
          onClear={() => undefined}
          value="kopi"
          variant="search"
          readOnly
        />
      </FormField>
      <FormField htmlFor="password" label="Kata sandi">
        <Input id="password" variant="password" />
      </FormField>
      <FormField error="Harga jual wajib diisi." htmlFor="price" label="Harga jual" required>
        <Input id="price" invalid prefix="Rp" suffix="/ porsi" value="25000" readOnly />
      </FormField>
      <FormField htmlFor="disabled" label="Kode outlet">
        <Input disabled id="disabled" value="JKT-01" readOnly />
      </FormField>
    </div>
  ),
};

export const TextareaSizes: Story = {
  args: { id: "note-story" },
  render: () => (
    <div className="story-contract-page">
      {(["sm", "md", "lg"] as const).map((size) => (
        <FormField htmlFor={`note-${size}`} key={size} label={`Catatan (${size})`}>
          <Textarea id={`note-${size}`} placeholder="Tulis catatan untuk pesanan ini" size={size} />
        </FormField>
      ))}
      <FormField
        helperText="Area ini bertambah tinggi saat pelanggan menulis catatan panjang."
        htmlFor="customer-note"
        label="Catatan pelanggan"
      >
        <Textarea autoGrow id="customer-note" placeholder="Contoh: Tanpa es dan gula sedikit." />
      </FormField>
    </div>
  ),
};

export const LongLabelAndTheme: Story = {
  args: { id: "long-label" },
  render: () => (
    <div className="story-contract-theme-comparison">
      <section data-theme-preview="light">
        <h2 className="text-heading-sm">Light</h2>
        <FormField
          htmlFor="light-field"
          label="Nama produk untuk menu layanan makan di tempat dan pesanan bawa pulang"
        >
          <Input id="light-field" placeholder="Contoh: Kopi Susu Aren" />
        </FormField>
      </section>
      <section data-theme-preview="dark">
        <h2 className="text-heading-sm">Dark</h2>
        <FormField
          htmlFor="dark-field"
          label="Nama produk untuk menu layanan makan di tempat dan pesanan bawa pulang"
        >
          <Input id="dark-field" placeholder="Contoh: Kopi Susu Aren" />
        </FormField>
      </section>
    </div>
  ),
};
