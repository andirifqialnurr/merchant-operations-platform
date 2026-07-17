import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Breadcrumb, Pagination, Sidebar, Stepper, Tabs, TopBar } from "@merchant/ui/navigation";
import { storyContractParameters } from "./story-contract";
const meta = {
  title: "Primitives/Navigation",
  component: Tabs,
  parameters: { ...storyContractParameters, layout: "padded" },
  tags: ["autodocs"],
} satisfies Meta<typeof Tabs>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Navigation: Story = {
  args: {
    items: [{ label: "Ringkasan", value: "summary" }],
    onValueChange: () => undefined,
    value: "summary",
  },
  render: () => {
    const [tab, setTab] = useState("summary");
    const [page, setPage] = useState(1);
    return (
      <div className="story-contract-page">
        <TopBar>Outlet Sudirman · Online</TopBar>
        <Sidebar items={[{ active: true, label: "Ringkasan" }, { label: "Pesanan" }]} />
        <Tabs
          items={[
            { label: "Ringkasan", value: "summary" },
            { label: "Pesanan", value: "orders" },
          ]}
          onValueChange={setTab}
          value={tab}
        />
        <Breadcrumb items={[{ href: "/", label: "Beranda" }, { label: "Pesanan" }]} />
        <Pagination onPageChange={setPage} page={page} total={240} />
        <Stepper
          current={1}
          steps={[{ label: "Outlet" }, { label: "Pembayaran" }, { label: "Selesai" }]}
        />
      </div>
    );
  },
};
