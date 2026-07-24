"use client";

import { RefreshCw, Store, Utensils } from "lucide-react";

import { AppIcon } from "./app-icon";

export type CustomerQrResolutionStatus = "resolving" | "ready" | "closed" | "invalid";

export type CustomerQrContextMerchant = {
  banner?: string;
  logoAlt?: string;
  logoSrc?: string;
  name: string;
  outletName?: string;
};

export type CustomerQrResolution = {
  message?: string;
  status: CustomerQrResolutionStatus;
  tableLabel?: string;
};

export type CustomerQrPublicTableContext = {
  label: string;
};

export type CustomerQrResolutionInput = {
  message?: string;
  status: CustomerQrResolutionStatus;
  table?: CustomerQrPublicTableContext;
};

export type CustomerQrContextProps = {
  className?: string;
  disabled?: boolean;
  merchant: CustomerQrContextMerchant;
  onRetry?: () => void;
  onStartOrder?: () => void;
  resolution: CustomerQrResolution;
};

const statusLabel: Record<CustomerQrResolutionStatus, string> = {
  closed: "Tutup",
  invalid: "QR tidak valid",
  ready: "Siap pesan",
  resolving: "Memeriksa QR",
};

const defaultMessage: Record<CustomerQrResolutionStatus, string> = {
  closed: "Outlet belum menerima pesanan dari QR meja ini.",
  invalid: "Minta bantuan staf untuk memeriksa QR meja.",
  ready: "Pesanan akan terhubung ke meja ini.",
  resolving: "Kami sedang mencocokkan QR dengan meja.",
};

function classes(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function createCustomerQrResolution(input: CustomerQrResolutionInput): CustomerQrResolution {
  if (input.message !== undefined && !input.message.trim()) {
    throw new TypeError("Pesan Customer QR harus berisi teks bila dikirim.");
  }
  if (input.table !== undefined && !input.table.label.trim()) {
    throw new TypeError("Label meja Customer QR harus berisi teks bila dikirim.");
  }

  const resolution: CustomerQrResolution = {
    status: input.status,
  };

  if (input.message !== undefined) {
    resolution.message = input.message.trim();
  }
  if (input.table !== undefined) {
    resolution.tableLabel = input.table.label.trim();
  }

  assertCustomerQrResolution(resolution);

  return resolution;
}

function assertCustomerQrResolution(resolution: CustomerQrResolution) {
  if (
    (resolution.status === "ready" || resolution.status === "closed") &&
    !resolution.tableLabel?.trim()
  ) {
    throw new TypeError("Customer QR siap/tutup memerlukan label meja.");
  }
  if (resolution.tableLabel !== undefined && !resolution.tableLabel.trim()) {
    throw new TypeError("Label meja Customer QR harus berisi teks bila dikirim.");
  }
  if (resolution.message !== undefined && !resolution.message.trim()) {
    throw new TypeError("Pesan Customer QR harus berisi teks bila dikirim.");
  }
}

function assertCustomerQrContract(
  merchant: CustomerQrContextMerchant,
  resolution: CustomerQrResolution,
) {
  if (!merchant.name.trim()) throw new TypeError("Customer QR memerlukan nama merchant.");
  if (merchant.outletName !== undefined && !merchant.outletName.trim()) {
    throw new TypeError("Outlet Customer QR harus berisi teks bila dikirim.");
  }
  if (merchant.banner !== undefined && !merchant.banner.trim()) {
    throw new TypeError("Banner Customer QR harus berisi teks bila dikirim.");
  }
  if (merchant.logoSrc !== undefined && !merchant.logoSrc.trim()) {
    throw new TypeError("Logo Customer QR harus berisi source bila dikirim.");
  }
  if (merchant.logoSrc !== undefined && !merchant.logoAlt?.trim()) {
    throw new TypeError("Logo Customer QR memerlukan alt text bila source dikirim.");
  }
  if (merchant.logoAlt !== undefined && !merchant.logoAlt.trim()) {
    throw new TypeError("Alt logo Customer QR harus berisi teks bila dikirim.");
  }
  assertCustomerQrResolution(resolution);
}

export function CustomerQrContext({
  className,
  disabled = false,
  merchant,
  onRetry,
  onStartOrder,
  resolution,
}: CustomerQrContextProps) {
  assertCustomerQrContract(merchant, resolution);

  const merchantName = merchant.name.trim();
  const outletName = merchant.outletName?.trim();
  const tableLabel = resolution.tableLabel?.trim();
  const message = resolution.message?.trim() ?? defaultMessage[resolution.status];
  const canStart = !disabled && resolution.status === "ready";
  const canRetry = !disabled && resolution.status === "invalid";

  return (
    <section
      aria-label="Konteks pesanan QR"
      className={classes("ui-customer-qr", `ui-customer-qr--${resolution.status}`, className)}
      data-customer-storefront
    >
      <header className="ui-customer-qr__merchant">
        <span className="ui-customer-qr__logo" aria-hidden={merchant.logoSrc ? undefined : true}>
          {merchant.logoSrc ? (
            <img alt={merchant.logoAlt?.trim()} src={merchant.logoSrc} />
          ) : (
            <AppIcon icon={Store} size="lg" />
          )}
        </span>
        <span className="ui-customer-qr__identity">
          <strong>{merchantName}</strong>
          {outletName ? <span>{outletName}</span> : null}
        </span>
        <span className="ui-customer-qr__status">{statusLabel[resolution.status]}</span>
      </header>

      {merchant.banner ? <p className="ui-customer-qr__banner">{merchant.banner.trim()}</p> : null}

      {tableLabel ? (
        <div className="ui-customer-qr__context">
          <span className="ui-customer-qr__context-icon">
            <AppIcon icon={Utensils} size="lg" />
          </span>
          <span className="ui-customer-qr__context-copy">
            <span>Meja</span>
            <strong>{tableLabel}</strong>
          </span>
        </div>
      ) : null}

      <p className="ui-customer-qr__message">{message}</p>

      <div className="ui-customer-qr__actions">
        {resolution.status === "invalid" ? (
          <button disabled={!canRetry} onClick={() => onRetry?.()} type="button">
            <AppIcon icon={RefreshCw} size="sm" />
            <span>Coba lagi</span>
          </button>
        ) : (
          <button disabled={!canStart} onClick={() => onStartOrder?.()} type="button">
            <AppIcon icon={Utensils} size="sm" />
            <span>Mulai pesanan</span>
          </button>
        )}
      </div>
    </section>
  );
}
