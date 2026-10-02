import { useState } from "react";

import type { Meta, StoryObj } from "@storybook/react-vite";
import { IconDownload, IconPlus } from "@tabler/icons-react";

import { Button } from "@merchant/ui/button";
import { Breadcrumb } from "@merchant/ui/navigation";
import { Chip, FilterBar, PageHeader } from "@merchant/ui/page";

import { storyContractParameters } from "./story-contract";

const meta = {
  title: "Patterns/Page",
  parameters: { ...storyContractParameters, layout: "padded" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Header: Story = {
  render: () => (
    <div className="story-contract-page">
      <PageHeader
        primaryAction={<Button iconLeft={IconPlus}>Tambah produk</Button>}
        title="Produk"
      />
      <PageHeader
        breadcrumb={
          <Breadcrumb items={[{ href: "#", label: "Stok" }, { label: "Opname Juli 2026" }]} />
        }
        primaryAction={<Button>Finalisasi</Button>}
        secondaryActions={
          <Button iconLeft={IconDownload} variant="secondary">
            Ekspor
          </Button>
        }
        title="Opname Juli 2026"
      />
      <PageHeader title="Laporan penjualan harian per outlet dan kasir" />
    </div>
  ),
};

function ChipExample() {
  const [selected, setSelected] = useState("all");
  const [filters, setFilters] = useState(["Status: Aktif", "Kategori: Kopi"]);
  return (
    <div className="story-contract-page">
      <div className="story-contract-grid">
        {[
          ["all", "Semua"],
          ["dine-in", "Makan di tempat"],
          ["takeaway", "Bawa pulang"],
        ].map(([value, label]) => (
          <Chip key={value} onClick={() => setSelected(value!)} selected={selected === value}>
            {label}
          </Chip>
        ))}
        <Chip disabled onClick={() => undefined}>
          Nonaktif
        </Chip>
      </div>
      <div className="story-contract-grid">
        {filters.map((filter) => (
          <Chip
            key={filter}
            onRemove={() => setFilters(filters.filter((item) => item !== filter))}
            removeLabel={`Hapus filter ${filter}`}
          >
            {filter}
          </Chip>
        ))}
      </div>
    </div>
  );
}

export const Chips: Story = {
  render: () => <ChipExample />,
};

function FilterExample() {
  const [query, setQuery] = useState("kopi");
  const [filters, setFilters] = useState(["Status: Aktif", "Kategori: Minuman dingin"]);
  return (
    <FilterBar
      chips={filters.map((filter) => ({
        key: filter,
        label: filter,
        onRemove: () => setFilters(filters.filter((item) => item !== filter)),
        removeLabel: `Hapus filter ${filter}`,
      }))}
      onReset={() => setFilters([])}
      resetLabel="Reset"
      search={{
        clearLabel: "Hapus pencarian",
        label: "Cari produk",
        onChange: setQuery,
        placeholder: "Cari produk",
        value: query,
      }}
    />
  );
}

export const Filter: Story = {
  render: () => <FilterExample />,
};

export const ThemeComparison: Story = {
  render: () => (
    <div className="story-contract-theme-comparison">
      {(["light", "dark"] as const).map((mode) => (
        <section data-theme-preview={mode} key={mode}>
          <PageHeader
            primaryAction={<Button iconLeft={IconPlus}>Tambah produk</Button>}
            title="Produk"
          />
          <div className="story-contract-grid">
            <Chip onClick={() => undefined} selected>
              Semua
            </Chip>
            <Chip onClick={() => undefined}>Aktif</Chip>
            <Chip onRemove={() => undefined} removeLabel="Hapus filter Kategori: Kopi">
              Kategori: Kopi
            </Chip>
          </div>
        </section>
      ))}
    </div>
  ),
};
