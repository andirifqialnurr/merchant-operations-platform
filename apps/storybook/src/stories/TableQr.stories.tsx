import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";

import { TableQrManager, type TableQrRecord } from "@merchant/ui/table-qr";

import { storyContractParameters } from "./story-contract";

const qrImage =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 96 96'%3E%3Crect width='96' height='96' fill='white'/%3E%3Cpath d='M8 8h24v24H8zM16 16v8h8v-8zM64 8h24v24H64zM72 16v8h8v-8zM8 64h24v24H8zM16 72v8h8v-8zM40 12h8v8h-8zM52 20h8v8h-8zM40 36h16v8H40zM64 40h8v8h-8zM80 48h8v8h-8zM40 56h8v8h-8zM52 64h16v8H52zM72 72h8v16h-8zM40 80h16v8H40z' fill='black'/%3E%3C/svg%3E";

const initialTable: TableQrRecord = {
  id: "table-01",
  label: "Meja 01",
  message: "QR siap dicetak untuk meja ini.",
  qrImageSrc: qrImage,
  status: "active",
};

function StatefulQrManager() {
  const [table, setTable] = useState(initialTable);

  return (
    <TableQrManager
      onGenerate={() =>
        setTable({
          ...initialTable,
          message: "QR baru dibuat dan siap dicetak.",
          status: "active",
        })
      }
      onPrint={() =>
        setTable((current) => ({ ...current, message: "QR dikirim ke antrian cetak." }))
      }
      onRevoke={() =>
        setTable((current) => ({
          id: current.id,
          label: current.label,
          message: "QR dicabut. Buat QR baru sebelum mencetak.",
          status: "revoked",
        }))
      }
      onRotate={() =>
        setTable((current) => ({
          ...current,
          message: "QR dirotasi dan preview diperbarui.",
          status: "active",
        }))
      }
      table={table}
    />
  );
}

const meta = {
  title: "Domain/Table Layout/Table QR",
  component: TableQrManager,
  args: {
    table: initialTable,
  },
  parameters: {
    ...storyContractParameters,
    layout: "padded",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof TableQrManager>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Active: Story = {
  render: () => <StatefulQrManager />,
};

export const Missing: Story = {
  render: () => (
    <TableQrManager
      table={{
        id: "table-02",
        label: "Meja Patio",
        message: "QR belum dibuat untuk meja ini.",
        status: "not-generated",
      }}
    />
  ),
};

export const Revoked: Story = {
  render: () => (
    <TableQrManager
      table={{
        id: "table-03",
        label: "Meja Bar 01",
        message: "QR dicabut dan tidak bisa dicetak.",
        status: "revoked",
      }}
    />
  ),
};

export const ThemeComparison: Story = {
  render: () => (
    <div className="story-contract-theme-comparison">
      <section data-theme-preview="light">
        <h2 className="text-heading-sm">Light</h2>
        <StatefulQrManager />
      </section>
      <section data-theme-preview="dark">
        <h2 className="text-heading-sm">Dark</h2>
        <StatefulQrManager />
      </section>
    </div>
  ),
};

export const Mobile: Story = {
  parameters: { viewport: { defaultViewport: "mobile" } },
  render: () => <StatefulQrManager />,
};
