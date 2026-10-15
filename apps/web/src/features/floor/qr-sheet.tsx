"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { IconDownload } from "@tabler/icons-react";

import type { TableQr } from "@merchant/contracts";
import { Button } from "@merchant/ui/button";
import { Skeleton } from "@merchant/ui/feedback";
import { AlertDialog, Sheet } from "@merchant/ui/overlay";
import { SegmentedControl } from "@merchant/ui/selection-control";
import { TableQrManager } from "@merchant/ui/table-qr";

import { merchantApi } from "@/lib/api-client";
import { useErrorMessage } from "@/lib/i18n";
import { useToast } from "@/providers/toast-provider";
import { RequestErrorState } from "@/shell/request-error-state";

import {
  cardFileName,
  downloadPdf,
  downloadPng,
  drawQrCard,
  printCard,
  type QrCardFormat,
} from "./qr-card";

const qrKey = (tenantId: string, outletId: string, tableId: string) =>
  ["floor", tenantId, outletId, "qr", tableId] as const;

/** Tables > a table > QR: make it, print or download its card, rotate or stop it. */
export function QrSheet({
  onClose,
  outletId,
  outletName,
  table,
  tenantId,
}: Readonly<{
  onClose: () => void;
  outletId: string;
  outletName: string;
  table: { id: string; label: string };
  tenantId: string;
}>) {
  const t = useTranslations("floor");
  const notify = useToast();
  const errorMessage = useErrorMessage();
  const queryClient = useQueryClient();
  const key = qrKey(tenantId, outletId, table.id);
  const query = useQuery({
    queryFn: () => merchantApi.tableQr(tenantId, outletId, table.id),
    queryKey: key,
  });
  const change = useMutation({
    mutationFn: ({ run }: { run: () => Promise<TableQr>; success: string }) => run(),
    onError: (error) => notify({ message: errorMessage(error), tone: "danger" }),
    onSuccess: (qr, { success }) => {
      queryClient.setQueryData(key, qr);
      notify({ message: success, tone: "success" });
    },
  });
  const [format, setFormat] = useState<QrCardFormat>("a6");
  const [card, setCard] = useState<{ canvas: HTMLCanvasElement; qr: string; src: string }>();
  const [confirm, setConfirm] = useState<"revoke" | "rotate">();
  const qr = query.data;
  const url = qr?.status === "ACTIVE" ? qr.url : null;

  // The card is drawn again whenever the QR or the paper changes.
  useEffect(() => {
    if (!url) return;
    let current = true;
    void drawQrCard(format, url, {
      instructions: t("qrInstructions"),
      outletName,
      tableLabel: table.label,
    }).then(async (canvas) => {
      // The status box shows the code alone; the card below shows the whole print.
      const qr = await QRCode.toDataURL(url, { margin: 1, width: 256 });
      if (current) setCard({ canvas, qr, src: canvas.toDataURL("image/png") });
    });
    return () => {
      current = false;
    };
  }, [format, outletName, t, table.label, url]);

  const shownCard = url ? card : undefined;
  const title = t("qrTitle", { label: table.label });

  return (
    <>
      <Sheet
        closeLabel={t("close")}
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
        open
        size="md"
        title={title}
      >
        {query.isPending ? (
          <Skeleton variant="table-row" />
        ) : query.isError ? (
          <RequestErrorState
            error={query.error}
            onRetry={() => void query.refetch()}
            title={t("qrLoadFailed")}
          />
        ) : qr ? (
          <div className="grid gap-4">
            <TableQrManager
              disabled={change.isPending}
              labels={{
                generate: t("qrGenerate"),
                preview: (label) => t("qrPreview", { label }),
                print: t("qrPrint"),
                region: (label) => t("qrTitle", { label }),
                revoke: t("qrRevoke"),
                rotate: t("qrRotate"),
                status: {
                  active: t("qrStatus.ACTIVE"),
                  "not-generated": t("qrStatus.NOT_GENERATED"),
                  revoked: t("qrStatus.REVOKED"),
                },
              }}
              onGenerate={() =>
                change.mutate({
                  run: () => merchantApi.generateTableQr(tenantId, outletId, table.id),
                  success: t("qrGenerated"),
                })
              }
              onPrint={() => {
                if (shownCard && !printCard(shownCard.canvas, format, title)) {
                  notify({ message: t("qrPrintBlocked"), tone: "danger" });
                }
              }}
              onRevoke={() => setConfirm("revoke")}
              onRotate={() => setConfirm("rotate")}
              table={{
                id: table.id,
                label: table.label,
                ...(qr.version ? { message: t("qrVersion", { version: qr.version }) } : {}),
                ...(shownCard ? { qrImageSrc: shownCard.qr } : {}),
                status:
                  qr.status === "ACTIVE"
                    ? "active"
                    : qr.status === "REVOKED"
                      ? "revoked"
                      : "not-generated",
              }}
            />
            {shownCard ? (
              <section aria-label={t("qrCard")} className="grid gap-3">
                <SegmentedControl
                  items={[
                    { label: t("qrFormat.a6"), value: "a6" },
                    { label: t("qrFormat.sticker"), value: "sticker" },
                  ]}
                  label={t("qrCardFormat")}
                  onValueChange={(value) => setFormat(value as QrCardFormat)}
                  value={format}
                />
                {/* Exactly what is printed; the card itself carries the words. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  alt={t("qrCardAlt", { label: table.label })}
                  className="mx-auto max-h-96 w-auto rounded-md border border-line-default"
                  src={shownCard.src}
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    iconLeft={IconDownload}
                    onClick={() =>
                      void downloadPng(shownCard.canvas, cardFileName(table.label, format, "png"))
                    }
                    variant="secondary"
                  >
                    {t("qrDownloadPng")}
                  </Button>
                  <Button
                    iconLeft={IconDownload}
                    onClick={() =>
                      void downloadPdf(
                        shownCard.canvas,
                        format,
                        cardFileName(table.label, format, "pdf"),
                      )
                    }
                    variant="secondary"
                  >
                    {t("qrDownloadPdf")}
                  </Button>
                </div>
              </section>
            ) : null}
          </div>
        ) : null}
      </Sheet>
      <AlertDialog
        cancelLabel={t("cancel")}
        closeLabel={t("close")}
        confirmLabel={confirm === "revoke" ? t("qrRevoke") : t("qrRotate")}
        onConfirm={() => {
          const action = confirm;
          setConfirm(undefined);
          change.mutate(
            action === "revoke"
              ? {
                  run: () => merchantApi.revokeTableQr(tenantId, outletId, table.id),
                  success: t("qrRevoked"),
                }
              : {
                  run: () => merchantApi.rotateTableQr(tenantId, outletId, table.id),
                  success: t("qrRotated"),
                },
          );
        }}
        onOpenChange={(open) => {
          if (!open) setConfirm(undefined);
        }}
        open={confirm !== undefined}
        title={
          confirm === "revoke"
            ? t("qrRevokeTitle", { label: table.label })
            : t("qrRotateTitle", { label: table.label })
        }
      >
        {confirm === "revoke" ? t("qrRevokeDescription") : t("qrRotateDescription")}
      </AlertDialog>
    </>
  );
}
