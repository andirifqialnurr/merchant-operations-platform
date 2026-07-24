"use client";

import { Printer, QrCode, RefreshCw, RotateCw, ShieldOff } from "lucide-react";

import { AppIcon } from "./app-icon";

export type TableQrStatus = "not-generated" | "active" | "revoked";

export type TableQrRecord = {
  id: string;
  label: string;
  message?: string;
  qrImageSrc?: string;
  status: TableQrStatus;
};

export type TableQrManagerProps = {
  className?: string;
  disabled?: boolean;
  onGenerate?: (tableId: string) => void;
  onPrint?: (tableId: string) => void;
  onRevoke?: (tableId: string) => void;
  onRotate?: (tableId: string) => void;
  table: TableQrRecord;
};

const statusLabel: Record<TableQrStatus, string> = {
  active: "Aktif",
  "not-generated": "Belum dibuat",
  revoked: "Dicabut",
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
      aria-label={`QR meja ${visibleLabel}`}
      className={classes("ui-table-qr", `ui-table-qr--${table.status}`, className)}
    >
      <header className="ui-table-qr__header">
        <span className="ui-table-qr__title">
          <AppIcon icon={QrCode} size="sm" />
          <span>{visibleLabel}</span>
        </span>
        <span className="ui-table-qr__status">{statusLabel[table.status]}</span>
      </header>

      <div className="ui-table-qr__preview" role="img" aria-label={`Preview QR ${visibleLabel}`}>
        {isActive && table.qrImageSrc ? (
          <img alt="" src={table.qrImageSrc} />
        ) : (
          <AppIcon icon={QrCode} size="xl" />
        )}
      </div>

      {table.message ? <p className="ui-table-qr__message">{table.message.trim()}</p> : null}

      <div className="ui-table-qr__actions">
        <button disabled={!canGenerate} onClick={() => onGenerate?.(table.id)} type="button">
          <AppIcon icon={RefreshCw} size="sm" />
          <span>Buat QR</span>
        </button>
        <button disabled={!canUseActiveQr} onClick={() => onPrint?.(table.id)} type="button">
          <AppIcon icon={Printer} size="sm" />
          <span>Cetak QR</span>
        </button>
        <button disabled={!canUseActiveQr} onClick={() => onRotate?.(table.id)} type="button">
          <AppIcon icon={RotateCw} size="sm" />
          <span>Rotasi QR</span>
        </button>
        <button disabled={!canUseActiveQr} onClick={() => onRevoke?.(table.id)} type="button">
          <AppIcon icon={ShieldOff} size="sm" />
          <span>Cabut QR</span>
        </button>
      </div>
    </section>
  );
}
