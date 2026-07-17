import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  Accordion,
  Avatar,
  Card,
  Chart,
  DataTable,
  DescriptionList,
  Divider,
  MetricCard,
  Timeline,
} from "@merchant/ui/data-display";
import { storyContractParameters } from "./story-contract";

const meta = {
  title: "Primitives/Data display",
  component: Chart,
  parameters: { ...storyContractParameters, layout: "padded" },
  tags: ["autodocs"],
} satisfies Meta<typeof Chart>;

export default meta;
type Story = StoryObj<typeof meta>;

const dailyOrders = [24, 37, 31, 45, 52, 48, 61];
const days = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];

export const Components: Story = {
  args: {
    categories: days,
    series: [{ data: dailyOrders, name: "Pesanan" }],
    summary: "Total 298 pesanan dalam tujuh hari.",
    title: "Tren pesanan",
    type: "line",
  },
  render: () => (
    <div className="story-contract-page">
      <Card variant="outlined">Panel informasi tanpa nested card.</Card>
      <MetricCard change="Naik 12%" label="Penjualan hari ini" value="Rp4.850.000" />
      <Avatar name="Ayu Sari" />
      <Divider />
      <DataTable
        columns={["Produk", "Terjual", "Pendapatan"]}
        rows={[["Es kopi susu", "48", "Rp1.200.000"], ["Croissant", "30", "Rp900.000"]]}
      />
      <DescriptionList items={[{ label: "Outlet", value: "Sudirman" }, { label: "Shift", value: "Pagi" }]} />
      <Accordion items={[{ content: "Diperbarui pada 09.30 WIB.", title: "Informasi operasional" }]} />
      <Timeline items={[{ description: "Kasir A", time: "09.30", title: "Shift dibuka" }]} />
    </div>
  ),
};

export const ChartTypes: Story = {
  args: {
    categories: days,
    series: [{ data: dailyOrders, name: "Pesanan" }],
    summary: "Total 298 pesanan dalam tujuh hari.",
    title: "Tren pesanan",
    type: "line",
  },
  render: () => (
    <div className="story-contract-page">
      <Chart
        categories={days}
        series={[{ data: dailyOrders, name: "Pesanan" }]}
        summary="Total 298 pesanan dalam tujuh hari."
        title="Tren pesanan"
        type="line"
      />
      <Chart
        categories={days}
        series={[{ data: dailyOrders, name: "Penjualan" }]}
        summary="Penjualan tertinggi terjadi pada Minggu."
        title="Area penjualan"
        type="area"
      />
      <Chart
        categories={["Dine in", "Bawa pulang", "Delivery"]}
        series={[{ data: [142, 96, 60], name: "Pesanan" }]}
        summary="Dine in menyumbang pesanan terbanyak."
        title="Kanal pesanan"
        type="bar"
      />
      <Chart
        categories={["Tunai", "QRIS", "Transfer"]}
        series={[48, 36, 16]}
        summary="QRIS merupakan metode pembayaran terbesar kedua."
        title="Metode pembayaran"
        type="donut"
      />
    </div>
  ),
};

export const ChartStates: Story = {
  args: {
    categories: days,
    series: [{ data: dailyOrders, name: "Pesanan" }],
    summary: "Total 298 pesanan dalam tujuh hari.",
    title: "Tren pesanan",
    type: "line",
  },
  render: () => (
    <div className="story-contract-page">
      <Chart categories={days} series={[{ data: dailyOrders, name: "Pesanan" }]} state="loading" summary="Memuat tren pesanan." title="Memuat chart" type="line" />
      <Chart categories={days} series={[{ data: [], name: "Pesanan" }]} state="empty" summary="Tidak ada pesanan pada periode ini." title="Chart kosong" type="line" />
      <Chart categories={days} onRetry={() => undefined} series={[{ data: [], name: "Pesanan" }]} state="error" summary="Data belum dapat dimuat." title="Chart gagal" type="line" />
    </div>
  ),
};
