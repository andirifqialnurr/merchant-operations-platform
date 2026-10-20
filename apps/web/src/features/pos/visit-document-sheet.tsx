"use client";

import { useTranslations } from "next-intl";
import { Button } from "@merchant/ui/button";
import { ErrorState, Skeleton } from "@merchant/ui/feedback";
import { Receipt, type ReceiptPaper } from "@merchant/ui/receipt";
import { SegmentedControl } from "@merchant/ui/selection-control";
import { Sheet } from "@merchant/ui/sheet";

import { ApiClientError } from "@/lib/api-client";
import { useErrorMessage, useFormat } from "@/lib/i18n";
import { useVisitDocument } from "./api";
import { visitDocumentView } from "./visit-document-view";
import { RECEIPT_PAPERS, useReceiptPaper } from "./use-receipt-paper";

export function VisitDocumentSheet({
  tenantId,
  outletId,
  sessionId,
  onClose,
}: Readonly<{
  tenantId: string;
  outletId: string;
  sessionId: string;
  onClose: () => void;
}>) {
  const t = useTranslations("visitDocument");
  const pos = useTranslations("pos");
  const errorMessage = useErrorMessage();
  const { locale, money } = useFormat();
  const query = useVisitDocument(tenantId, outletId, sessionId);
  const [paper, setPaper] = useReceiptPaper();
  const ready = query.isSuccess && query.fetchStatus === "idle";
  const doc = ready ? query.data : undefined;
  const printable = Boolean(doc && doc.orders.length + doc.pendingOrders.length > 0);
  const retryable =
    !(query.error instanceof ApiClientError) ||
    query.error.status >= 500 ||
    query.error.status === 429;
  return (
    <Sheet
      open
      title={t("title")}
      closeLabel={pos("closeSheet")}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      footer={
        <Button
          size="lg"
          disabled={!printable}
          onClick={() => {
            if (printable) window.print();
          }}
        >
          {pos("print")}
        </Button>
      }
    >
      <div className="grid gap-4" data-receipt-document>
        <SegmentedControl
          label={pos("paper")}
          items={RECEIPT_PAPERS.map((value) => ({ label: pos(`paper_${value}`), value }))}
          value={paper}
          onValueChange={(value) => setPaper(value as ReceiptPaper)}
          size="lg"
        />
        {query.isError ? (
          <ErrorState
            title={t("loadFailed")}
            description={errorMessage(query.error)}
            {...(retryable
              ? {
                  action: (
                    <Button size="lg" variant="secondary" onClick={() => void query.refetch()}>
                      {pos("retry")}
                    </Button>
                  ),
                }
              : {})}
          />
        ) : doc ? (
          <Receipt
            ariaLabel={t("title")}
            paper={paper}
            {...visitDocumentView(
              doc,
              t,
              (amount) => money(amount, doc.currency),
              (iso) =>
                new Intl.DateTimeFormat(locale, {
                  dateStyle: "medium",
                  timeStyle: "short",
                  timeZone: doc.outlet.timezone,
                }).format(new Date(iso)),
              locale,
            )}
          />
        ) : (
          <div
            role="status"
            aria-label={query.fetchStatus === "paused" ? t("paused") : t("loading")}
          >
            {query.fetchStatus === "paused" ? (
              <p className="m-0 text-body-sm text-foreground-secondary">{t("paused")}</p>
            ) : (
              <Skeleton variant="ticket" />
            )}
          </div>
        )}
      </div>
    </Sheet>
  );
}
