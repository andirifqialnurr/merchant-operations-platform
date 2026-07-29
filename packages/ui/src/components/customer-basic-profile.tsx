"use client";

import { Ban, CheckCircle2, Crown, RotateCcw, Search, UserRound } from "lucide-react";

import { AppIcon } from "./app-icon";
import { Button } from "./button";
import { Badge, type FeedbackTone } from "./feedback";

export type CustomerBasicStatus = "guest" | "known" | "member" | "blocked";
export type CustomerBasicTone = "neutral" | "info" | "success" | "warning" | "danger";

export type CustomerBasicItem = {
  channelLabel?: string;
  consentLabel?: string;
  contactLabel?: string;
  disabled?: boolean;
  disabledReason?: string;
  displayName: string;
  id: string;
  lastVisitLabel?: string;
  noteLabel?: string;
  pointBalanceLabel?: string;
  segmentLabel?: string;
  selected?: boolean;
  status: CustomerBasicStatus;
  statusLabel?: string;
  tone?: CustomerBasicTone;
  visitCountLabel?: string;
};

export type CustomerBasicProfileProps = {
  ariaLabel?: string;
  className?: string;
  items: readonly CustomerBasicItem[];
  onClearSelection?: () => void;
  onSelectCustomer?: (id: string) => void;
  selectedSummaryLabel?: string;
  sourceLabel?: string;
  statusLabel?: string;
  title?: string;
};

type CustomerBasicStatusContent = {
  defaultLabel: string;
  icon: typeof UserRound;
  tone: CustomerBasicTone;
};

const statusContent: Record<CustomerBasicStatus, CustomerBasicStatusContent> = {
  blocked: { defaultLabel: "Dibatasi", icon: Ban, tone: "danger" },
  guest: { defaultLabel: "Tamu", icon: UserRound, tone: "neutral" },
  known: { defaultLabel: "Dikenal", icon: CheckCircle2, tone: "info" },
  member: { defaultLabel: "Member", icon: Crown, tone: "success" },
};

const customerBasicSensitiveKeyPattern =
  /(?:customerId|customerInternalId|profileId|sessionId|cartId|orderId|paymentId|paymentToken|paymentPayload|billId|invoiceId|receiptId|phone|telepon|email|address|alamat|birth|dob|identity|nik|ktp|passport|token|payload|permission|internalId|tenantId|outletId|ledgerId|journalId|audit|actor|timestamp|createdAt|updatedAt|raw|webhook|attachment|loyaltyToken|rewardToken|hpp|cogs|cost|price|profit|margin)/i;

const allowedActionProps = new Set(["onClearSelection", "onSelectCustomer"]);

function classes(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function assertText(value: string | undefined, fieldName: string) {
  if (value !== undefined && !value.trim()) {
    throw new TypeError(`${fieldName} harus berisi teks bila dikirim.`);
  }
}

function assertNoSensitiveProps(value: unknown, path = "Customer Basic payload") {
  if (value === null || value === undefined || typeof value !== "object") return;

  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoSensitiveProps(item, `${path}[${index}]`));
    return;
  }

  for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
    if (/^on[A-Z]/.test(key) && !allowedActionProps.has(key)) {
      throw new TypeError(`${path} tidak menerima action prop di luar kontrak: ${key}.`);
    }
    if (customerBasicSensitiveKeyPattern.test(key)) {
      throw new TypeError(`${path} tidak boleh menerima data sensitif/out-of-scope: ${key}.`);
    }
    if (nestedValue && typeof nestedValue === "object") {
      assertNoSensitiveProps(nestedValue, `${path}.${key}`);
    }
  }
}

function assertUniqueIds(items: readonly CustomerBasicItem[]) {
  const seen = new Set<string>();

  for (const item of items) {
    if (!item.id.trim()) throw new TypeError("Customer Basic memerlukan id tersembunyi.");
    if (seen.has(item.id)) throw new TypeError("Customer Basic tidak boleh memiliki id duplikat.");
    seen.add(item.id);
  }
}

function toBadgeTone(tone: CustomerBasicTone): FeedbackTone {
  if (tone === "neutral") return "info";
  return tone;
}

function getInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function CustomerBasicProfile(props: CustomerBasicProfileProps) {
  assertNoSensitiveProps(props);
  assertUniqueIds(props.items);

  const {
    ariaLabel = "Customer Basic",
    className,
    items,
    onClearSelection,
    onSelectCustomer,
    selectedSummaryLabel,
    sourceLabel,
    statusLabel,
    title = "Customer Basic",
  } = props;

  assertText(ariaLabel, "Label Customer Basic");
  assertText(selectedSummaryLabel, "Ringkasan pilihan Customer Basic");
  assertText(sourceLabel, "Sumber Customer Basic");
  assertText(statusLabel, "Status Customer Basic");
  assertText(title, "Judul Customer Basic");
  items.forEach((item) => {
    assertText(item.channelLabel, "Channel Customer Basic");
    assertText(item.consentLabel, "Consent Customer Basic");
    assertText(item.contactLabel, "Kontak Customer Basic");
    assertText(item.disabledReason, "Alasan disabled Customer Basic");
    assertText(item.displayName, "Nama tampilan Customer Basic");
    assertText(item.lastVisitLabel, "Kunjungan terakhir Customer Basic");
    assertText(item.noteLabel, "Catatan Customer Basic");
    assertText(item.pointBalanceLabel, "Poin Customer Basic");
    assertText(item.segmentLabel, "Segment Customer Basic");
    assertText(item.statusLabel, "Status Customer Basic");
    assertText(item.visitCountLabel, "Jumlah kunjungan Customer Basic");
  });

  const selectedCount = items.filter((item) => item.selected).length;
  const actionable = Boolean(onSelectCustomer);

  return (
    <section aria-label={ariaLabel.trim()} className={classes("ui-customer-basic", className)}>
      <header className="ui-customer-basic__header">
        <div>
          <h2>{title.trim()}</h2>
          {sourceLabel ? <p>{sourceLabel.trim()}</p> : null}
        </div>
        {statusLabel ? <span>{statusLabel.trim()}</span> : null}
      </header>

      <div className="ui-customer-basic__summary" aria-label="Ringkasan Customer Basic">
        <span>{items.length}</span>
        <p>{selectedSummaryLabel?.trim() ?? `${selectedCount} dipilih`}</p>
        {onClearSelection ? (
          <Button
            disabled={selectedCount === 0}
            iconLeft={RotateCcw}
            onClick={() => onClearSelection()}
            size="sm"
            type="button"
            variant="ghost"
          >
            Bersihkan
          </Button>
        ) : null}
      </div>

      {items.length > 0 ? (
        <ul className="ui-customer-basic__list">
          {items.map((item) => {
            const content = statusContent[item.status];
            const StatusIcon = content.icon;
            const tone = item.tone ?? content.tone;
            const statusLabelText = item.statusLabel?.trim() || content.defaultLabel;
            const insights = [
              item.segmentLabel,
              item.channelLabel,
              item.visitCountLabel,
              item.pointBalanceLabel,
              item.lastVisitLabel,
            ].filter((value): value is string => Boolean(value?.trim()));

            return (
              <li
                aria-label={`Customer ${item.displayName.trim()}`}
                className={classes(
                  "ui-customer-basic-card",
                  `ui-customer-basic-card--${tone}`,
                  item.selected && "is-selected",
                  item.disabled && "is-disabled",
                )}
                key={item.id}
              >
                <article>
                  <header>
                    <span className="ui-customer-basic-card__avatar" aria-hidden="true">
                      {getInitials(item.displayName)}
                    </span>
                    <div>
                      <h3>{item.displayName.trim()}</h3>
                      <Badge tone={toBadgeTone(tone)}>
                        <AppIcon icon={StatusIcon} size="xs" />
                        {statusLabelText}
                      </Badge>
                    </div>
                  </header>

                  {item.contactLabel || item.consentLabel ? (
                    <dl className="ui-customer-basic-card__facts">
                      {item.contactLabel ? (
                        <div>
                          <dt>Kontak</dt>
                          <dd>{item.contactLabel.trim()}</dd>
                        </div>
                      ) : null}
                      {item.consentLabel ? (
                        <div>
                          <dt>Consent</dt>
                          <dd>{item.consentLabel.trim()}</dd>
                        </div>
                      ) : null}
                    </dl>
                  ) : null}

                  {insights.length > 0 ? (
                    <ul className="ui-customer-basic-card__insights">
                      {insights.map((insight) => (
                        <li key={insight}>{insight.trim()}</li>
                      ))}
                    </ul>
                  ) : null}

                  {item.noteLabel ? (
                    <p className="ui-customer-basic-card__note">{item.noteLabel.trim()}</p>
                  ) : null}

                  <div className="ui-customer-basic-card__actions">
                    <Button
                      disabled={!actionable || item.disabled}
                      iconLeft={Search}
                      onClick={() => onSelectCustomer?.(item.id)}
                      size="sm"
                      type="button"
                      variant={item.selected ? "secondary" : "outline"}
                    >
                      {item.selected ? "Terpilih" : "Pilih"}
                    </Button>
                    {item.disabled && item.disabledReason ? (
                      <small>{item.disabledReason.trim()}</small>
                    ) : null}
                  </div>
                </article>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="ui-customer-basic__empty">Customer belum tersedia.</p>
      )}
    </section>
  );
}
