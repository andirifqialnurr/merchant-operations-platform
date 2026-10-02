import { useState } from "react";

import type { Meta, StoryObj } from "@storybook/react-vite";
import { Boxes, Compass, LayoutGrid, Package, Plus, Settings, Users, Wallet } from "lucide-react";

import { AppIcon } from "@merchant/ui/app-icon";
import { AppShell, ContextSwitcher, UserMenu } from "@merchant/ui/app-shell";
import { Button } from "@merchant/ui/button";
import { DataTable, Panel } from "@merchant/ui/data-display";
import { Badge } from "@merchant/ui/feedback";
import { Tabs } from "@merchant/ui/navigation";
import { FilterBar, PageHeader } from "@merchant/ui/page";
import { Select } from "@merchant/ui/select";

const meta = {
  title: "Patterns/AppShell",
  parameters: { layout: "fullscreen" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const navigation = [
  { active: true, href: "#", icon: <AppIcon icon={Package} />, label: "Katalog" },
  { href: "#", icon: <AppIcon icon={LayoutGrid} />, label: "Meja" },
  { href: "#", icon: <AppIcon icon={Boxes} />, label: "Stok" },
  { href: "#", icon: <AppIcon icon={Wallet} />, label: "Keuangan" },
  { href: "#", icon: <AppIcon icon={Users} />, label: "Karyawan" },
  { href: "#", icon: <AppIcon icon={Settings} />, label: "Pengaturan" },
];

const products = [
  ["Es kopi susu gula aren", "Kopi", "Rp25.000", "14 Jul 2026"],
  ["Americano", "Kopi", "Rp22.000", "12 Jul 2026"],
  ["Croissant mentega", "Roti", "Rp28.000", "10 Jul 2026"],
  ["Matcha latte", "Non-kopi", "Rp30.000", "8 Jul 2026"],
] as const;

function ShellExample() {
  const [workspaceId, setWorkspaceId] = useState("w1");
  const [locationId, setLocationId] = useState("l1");
  const [language, setLanguage] = useState("id");
  const [theme, setTheme] = useState("system");
  const [tab, setTab] = useState("products");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<string | undefined>("ACTIVE");

  const rows = products
    .filter(([name]) => name.toLowerCase().includes(query.toLowerCase()))
    .map(([name, category, price, updated]) => [
      name,
      category,
      <Badge key="status" tone="success">
        Aktif
      </Badge>,
      price,
      updated,
    ]);

  return (
    <AppShell
      account={
        <UserMenu
          email="andi@kopisenja.id"
          label="Menu akun"
          language={{
            label: "Bahasa",
            onChange: setLanguage,
            options: [
              { label: "Indonesia", value: "id" },
              { label: "English", value: "en" },
            ],
            value: language,
          }}
          name="Andi Rifqi"
          onSignOut={() => undefined}
          signOutLabel="Keluar"
          theme={{
            label: "Tema",
            onChange: setTheme,
            options: [
              { label: "Terang", value: "light" },
              { label: "Gelap", value: "dark" },
              { label: "Sistem", value: "system" },
            ],
            value: theme,
          }}
        />
      }
      brand="Cafe Companion"
      context={
        <ContextSwitcher
          label="Ganti bisnis atau outlet"
          locationId={locationId}
          locationLabel="Outlet"
          locations={[
            { id: "l1", name: "Sudirman" },
            { id: "l2", name: "Kemang" },
          ]}
          onLocationChange={setLocationId}
          onWorkspaceChange={setWorkspaceId}
          workspaceId={workspaceId}
          workspaceLabel="Bisnis"
          workspaces={[
            { id: "w1", name: "Kopi Senja" },
            { id: "w2", name: "Roti Pagi" },
          ]}
        />
      }
      footerNavigation={[{ href: "#", icon: <AppIcon icon={Compass} />, label: "Jelajahi modul" }]}
      labels={{
        closeNavigation: "Tutup navigasi",
        moreNavigation: "Lainnya",
        navigation: "Navigasi utama",
        openNavigation: "Buka navigasi",
        skipToContent: "Lewati navigasi",
      }}
      navigation={navigation}
    >
      <PageHeader
        primaryAction={<Button iconLeft={Plus}>Tambah produk</Button>}
        tabs={
          <Tabs
            items={[
              { label: "Produk", value: "products" },
              { label: "Kategori", value: "categories" },
              { label: "Modifier", value: "modifiers" },
            ]}
            label="Katalog"
            onValueChange={setTab}
            value={tab}
          />
        }
        title="Katalog"
      />
      <FilterBar
        chips={
          status
            ? [
                {
                  key: "status",
                  label: "Status: Aktif",
                  onRemove: () => setStatus(undefined),
                  removeLabel: "Hapus filter Status: Aktif",
                },
              ]
            : []
        }
        filtersLabel="Filter"
        onReset={() => setStatus(undefined)}
        resetLabel="Reset"
        search={{
          clearLabel: "Hapus pencarian",
          label: "Cari produk",
          onChange: setQuery,
          placeholder: "Cari produk",
          value: query,
        }}
        sheetCloseLabel="Tutup filter"
        sheetDoneLabel="Tampilkan hasil"
      >
        <Select
          label="Status"
          onValueChange={setStatus}
          options={[
            { label: "Aktif", value: "ACTIVE" },
            { label: "Nonaktif", value: "INACTIVE" },
          ]}
          placeholder="Status"
          {...(status ? { value: status } : {})}
        />
      </FilterBar>
      <Panel>
        <DataTable
          caption="Daftar produk"
          columns={[
            "Produk",
            { label: "Kategori", priority: 2 },
            "Status",
            { align: "end", label: "Harga" },
            { label: "Diperbarui", priority: 3 },
          ]}
          empty="Tidak ada produk yang cocok."
          onRowSelect={() => undefined}
          rows={rows}
        />
      </Panel>
    </AppShell>
  );
}

export const BackofficeListPage: Story = {
  render: () => <ShellExample />,
};
