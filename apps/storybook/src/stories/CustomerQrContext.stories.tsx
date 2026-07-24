import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";

import { CustomerQrContext, type CustomerQrResolution } from "@merchant/ui/customer-qr-context";

import { storyContractParameters } from "./story-contract";

const merchant = {
  banner: "Pesan dari meja, lalu staf akan mengantar pesanan ke tempat duduk Anda.",
  name: "Kopi Senja",
  outletName: "Cabang Meruya",
};

const readyResolution: CustomerQrResolution = {
  message: "Pesanan akan terhubung ke meja ini.",
  status: "ready",
  tableLabel: "Meja 05",
};

function StatefulCustomerQrContext() {
  const [resolution, setResolution] = useState<CustomerQrResolution>(readyResolution);

  return (
    <CustomerQrContext
      merchant={merchant}
      onRetry={() =>
        setResolution({
          message: "QR berhasil diperiksa ulang.",
          status: "ready",
          tableLabel: "Meja 05",
        })
      }
      onStartOrder={() =>
        setResolution({
          message: "Menu siap dibuka untuk meja ini.",
          status: "ready",
          tableLabel: "Meja 05",
        })
      }
      resolution={resolution}
    />
  );
}

const meta = {
  title: "Domain/QR Self Order/Customer QR Context",
  component: CustomerQrContext,
  args: {
    merchant,
    resolution: readyResolution,
  },
  parameters: {
    ...storyContractParameters,
    layout: "padded",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof CustomerQrContext>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Ready: Story = {
  render: () => <StatefulCustomerQrContext />,
};

export const Resolving: Story = {
  render: () => <CustomerQrContext merchant={merchant} resolution={{ status: "resolving" }} />,
};

export const Closed: Story = {
  render: () => (
    <CustomerQrContext
      merchant={merchant}
      resolution={{ status: "closed", tableLabel: "Meja 05" }}
    />
  ),
};

export const Invalid: Story = {
  render: () => (
    <CustomerQrContext
      merchant={merchant}
      onRetry={() => undefined}
      resolution={{
        message: "QR tidak dapat dipakai. Minta bantuan staf.",
        status: "invalid",
      }}
    />
  ),
};

export const ThemeComparison: Story = {
  render: () => (
    <div className="story-contract-theme-comparison">
      <section data-theme-preview="light">
        <h2 className="text-heading-sm">Light</h2>
        <StatefulCustomerQrContext />
      </section>
      <section data-theme-preview="dark">
        <h2 className="text-heading-sm">Dark</h2>
        <StatefulCustomerQrContext />
      </section>
    </div>
  ),
};

export const Mobile: Story = {
  parameters: { viewport: { defaultViewport: "mobile" } },
  render: () => <StatefulCustomerQrContext />,
};
