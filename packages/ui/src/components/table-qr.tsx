"use client";

import {
  IconPrinter,
  IconQrcode,
  IconRefresh,
  IconRotateClockwise,
  IconShieldOff,
} from "@tabler/icons-react";

import { AppIcon } from "./app-icon";

export type TableQrStatus = "not-generated" | "active" | "revoked";

export type TableQrRecord = {
  id: string;
  label: string;
  message?: string;
  qrImageSrc?: string;
  status: TableQrStatus;
};

/** Every text the manager shows or announces; it has none of its own. */
export type TableQrManagerLabels = {
  generate: string;
  /** The preview's name, e.g. "QR code of T4". */
  preview: (label: string) => string;
  print: string;
  /** The section's name, e.g. "QR of T4". */
  region: (label: string) => string;
  revoke: string;
  rotate: string;
  status: Record<TableQrStatus, string>;
};

export type TableQrManagerProps = {
  className?: string;
  disabled?: boolean;
  labels: TableQrManagerLabels;
  onGenerate?: (tableId: string) => void;
  onPrint?: (tableId: string) => void;
  onRevoke?: (tableId: string) => void;
  onRotate?: (tableId: string) => void;
  table: TableQrRecord;
};

function classes(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function assertTableQrContract(table: TableQrRecord) {
  if (!table.id.trim()) throw new TypeError("Table QR memerlukan id internal meja.");
  if (!table.label.trim()) throw new TypeError("Table QR memerlukan label meja.");
  if (table.message !== undefined && !table.message.trim()) {
    throw new TypeError("Pesan status Table QR harus berisi teks bila dikirim.");
  }
  if (table.qrImageSrc !== undefined && !table.qrImageSrc.trim()) {
    throw new TypeError("QR image source harus berisi teks bila dikirim.");
  }
}

export function TableQrManager({
  className,
  disabled = false,
  labels,
  onGenerate,
  onPrint,
  onRevoke,
  onRotate,
  table,
}: TableQrManagerProps) {
  assertTableQrContract(table);

  const visibleLabel = table.label.trim();
  const isActive = table.status === "active";
  const canGenerate = !disabled && !isActive;
  const canUseActiveQr = !disabled && isActive;

  return (
    <section
      aria-label={labels.region(visibleLabel)}
      className={classes("ui-table-qr", `ui-table-qr--${table.status}`, className)}
    >
      <header className="ui-table-qr__header">
        <span className="ui-table-qr__title">
          <AppIcon icon={IconQrcode} size="sm" />
          <span>{visibleLabel}</span>
        </span>
        <span className="ui-table-qr__status">{labels.status[table.status]}</span>
      </header>

      <div aria-label={labels.preview(visibleLabel)} className="ui-table-qr__preview" role="img">
        {isActive && table.qrImageSrc ? (
          <img alt="" src={table.qrImageSrc} />
        ) : (
          <AppIcon icon={IconQrcode} size="xl" />
        )}
      </div>

      {table.message ? <p className="ui-table-qr__message">{table.message.trim()}</p> : null}

      <div className="ui-table-qr__actions">
        <button disabled={!canGenerate} onClick={() => onGenerate?.(table.id)} type="button">
          <AppIcon icon={IconRefresh} size="sm" />
          <span>{labels.generate}</span>
        </button>
        <button disabled={!canUseActiveQr} onClick={() => onPrint?.(table.id)} type="button">
          <AppIcon icon={IconPrinter} size="sm" />
          <span>{labels.print}</span>
        </button>
        <button disabled={!canUseActiveQr} onClick={() => onRotate?.(table.id)} type="button">
          <AppIcon icon={IconRotateClockwise} size="sm" />
          <span>{labels.rotate}</span>
        </button>
        <button disabled={!canUseActiveQr} onClick={() => onRevoke?.(table.id)} type="button">
          <AppIcon icon={IconShieldOff} size="sm" />
          <span>{labels.revoke}</span>
        </button>
      </div>
    </section>
  );
}
