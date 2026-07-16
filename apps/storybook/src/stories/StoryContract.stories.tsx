import type { Meta, StoryObj } from "@storybook/react-vite";

import { storyContractParameters } from "./story-contract";

const meta = {
  title: "Foundation/Story contract",
  parameters: { ...storyContractParameters, layout: "padded" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Template: Story = {
  render: () => (
    <div className="story-contract-page">
      <section className="story-contract-section">
        <h2 className="text-heading-sm">Size</h2>
        <div className="story-contract-grid">
          <button className="story-contract-control size-sm" type="button">
            Simpan (sm)
          </button>
          <button className="story-contract-control size-md" type="button">
            Simpan (md)
          </button>
          <button className="story-contract-control size-lg" type="button">
            Simpan (lg)
          </button>
        </div>
      </section>
      <section className="story-contract-section">
        <h2 className="text-heading-sm">Variant</h2>
        <div className="story-contract-grid">
          <button className="story-contract-control" type="button">
            Primary
          </button>
          <button className="story-contract-control variant-secondary" type="button">
            Secondary
          </button>
          <button className="story-contract-control variant-outline" type="button">
            Outline
          </button>
          <button className="story-contract-control variant-ghost" type="button">
            Ghost
          </button>
        </div>
      </section>
      <section className="story-contract-section">
        <h2 className="text-heading-sm">State</h2>
        <div className="story-contract-grid">
          <button className="story-contract-control" type="button">
            Default
          </button>
          <button className="story-contract-control is-focus-reference" type="button">
            Focus
          </button>
          <button className="story-contract-control" disabled type="button">
            Disabled
          </button>
          <button aria-busy className="story-contract-control" disabled type="button">
            Menyimpan perubahan...
          </button>
          <div>
            <button
              aria-describedby="template-error"
              className="story-contract-control"
              type="button"
            >
              Error
            </button>
            <p className="story-contract-feedback text-body-sm" id="template-error" role="alert">
              Perubahan belum tersimpan. Periksa koneksi lalu coba lagi.
            </p>
          </div>
        </div>
      </section>
      <section className="story-contract-section">
        <h2 className="text-heading-sm">Long Indonesian label</h2>
        <button className="story-contract-control" type="button">
          Konfirmasi pembayaran pesanan meja 12 dan kirimkan bukti transaksi kepada pelanggan
        </button>
      </section>
      <section className="story-contract-section">
        <h2 className="text-heading-sm">Empty</h2>
        <p className="story-contract-empty text-body-sm">Belum ada data yang dapat ditampilkan.</p>
      </section>
      <div className="story-contract-notes">
        <section>
          <h2 className="text-heading-sm">Keyboard</h2>
          <ul>
            <li>Tab memindahkan fokus ke control.</li>
            <li>Enter dan Space menjalankan action.</li>
          </ul>
        </section>
        <section>
          <h2 className="text-heading-sm">Accessibility</h2>
          <ul>
            <li>Label action menjelaskan hasil yang akan dilakukan.</li>
            <li>Focus visible memakai semantic focus ring.</li>
          </ul>
        </section>
      </div>
    </div>
  ),
};

export const ThemeComparison: Story = {
  render: () => (
    <div className="story-contract-theme-comparison">
      <section data-theme-preview="light">
        <h2 className="text-heading-sm">Light</h2>
        <button className="story-contract-control" type="button">
          Konfirmasi pembayaran
        </button>
      </section>
      <section data-theme-preview="dark">
        <h2 className="text-heading-sm">Dark</h2>
        <button className="story-contract-control" type="button">
          Konfirmasi pembayaran
        </button>
      </section>
    </div>
  ),
};
