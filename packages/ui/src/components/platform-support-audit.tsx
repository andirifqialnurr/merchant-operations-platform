"use client";

import { ClipboardList, LifeBuoy, RefreshCw } from "lucide-react";

import { AppIcon } from "./app-icon";
import { Badge, type FeedbackTone } from "./feedback";

export type PlatformSupportState = "OPEN" | "WATCHING" | "RESOLVED";
export type PlatformAuditEventSeverity = "INFO" | "SUCCESS" | "WARNING" | "DANGER";

export type PlatformSupportContext = {
  channelLabel: string;
  disabled?: boolean;
  disabledReason?: string;
  key: string;
  label: string;
  priorityLabel?: string;
  scopeLabel: string;
  selected?: boolean;
  state: PlatformSupportState;
  summaryLabel?: string;
};

export type PlatformAuditEvent = {
  categoryLabel: string;
  contextKey: string;
  detailLabel: string;
  key: string;
  resolutionLabel?: string;
  severity: PlatformAuditEventSeverity;
  sourceLabel?: string;
  stateLabel: string;
  timeLabel?: string;
  title: string;
};

export type PlatformSupportAuditProps = {
  ariaLabel?: string;
  className?: string;
  contexts: readonly PlatformSupportContext[];
  events: readonly PlatformAuditEvent[];
  onRefresh?: () => void;
  onSelectContext?: (contextKey: string) => void;
  selectedContextKey: string;
  sourceLabel?: string;
  statusLabel?: string;
  title?: string;
};

const stateContent: Record<PlatformSupportState, { label: string; tone: FeedbackTone }> = {
  OPEN: { label: "Terbuka", tone: "warning" },
  RESOLVED: { label: "Selesai", tone: "success" },
  WATCHING: { label: "Dipantau", tone: "info" },
};

const severityContent: Record<PlatformAuditEventSeverity, { label: string; tone: FeedbackTone }> = {
  DANGER: { label: "Kritis", tone: "danger" },
  INFO: { label: "Info", tone: "info" },
  SUCCESS: { label: "Berhasil", tone: "success" },
  WARNING: { label: "Perhatian", tone: "warning" },
};

const platformSupportAuditSensitiveKeyPattern =
  /(?:id|tenant|subscription|user|owner|session|request|payment|billing|invoice|receipt|card|bank|phone|telepon|email|address|alamat|token|payload|permission|password|secret|actor|timestamp|createdAt|updatedAt|raw|outlet|brand|customer|order|hpp|cogs|cost|profit|margin|ledger|journal|webhook|attachment)/i;

const allowedActionProps = new Set(["onRefresh", "onSelectContext"]);
const allowedHiddenValueProps = new Set(["key", "contextKey", "selectedContextKey"]);

function classes(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function assertText(value: string | undefined, fieldName: string) {
  if (value !== undefined && !value.trim()) {
    throw new TypeError(`${fieldName} harus berisi teks bila dikirim.`);
  }
}

function assertNoSensitiveProps(value: unknown, path = "Platform support audit payload") {
  if (value === null || value === undefined || typeof value !== "object") return;

  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoSensitiveProps(item, `${path}[${index}]`));
    return;
  }

  for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
    if (/^on[A-Z]/.test(key) && !allowedActionProps.has(key)) {
      throw new TypeError(`${path} tidak menerima action prop di luar kontrak: ${key}.`);
    }
    if (!allowedHiddenValueProps.has(key) && platformSupportAuditSensitiveKeyPattern.test(key)) {
      throw new TypeError(`${path} tidak boleh menerima data sensitif/out-of-scope: ${key}.`);
    }
    if (nestedValue && typeof nestedValue === "object") {
      assertNoSensitiveProps(nestedValue, `${path}.${key}`);
    }
  }
}

function assertUniqueValues(
  items: readonly { key: string; label?: string; title?: string }[],
  label: string,
) {
  const hiddenValues = new Set<string>();
  const displayValues = new Set<string>();

  for (const item of items) {
    if (!item.key.trim()) throw new TypeError(`${label} memerlukan value tersembunyi.`);
    if (hiddenValues.has(item.key)) throw new TypeError(`${label} tidak boleh duplikat.`);
    hiddenValues.add(item.key);

    const displayValue = (item.label ?? item.title)?.trim().toLowerCase();
    if (!displayValue) throw new TypeError(`${label} memerlukan label tampilan.`);
    if (displayValues.has(displayValue))
      throw new TypeError(`${label} tidak boleh memiliki label duplikat.`);
    displayValues.add(displayValue);
  }
}

export function PlatformSupportAudit(props: PlatformSupportAuditProps) {
  assertNoSensitiveProps(props);
  assertUniqueValues(props.contexts, "Support context");
  assertUniqueValues(props.events, "Audit Event");

  const {
    ariaLabel = "Support context dan Audit Event",
    className,
    contexts,
    events,
    onRefresh,
    onSelectContext,
    selectedContextKey,
    sourceLabel,
    statusLabel,
    title = "Support context dan Audit Event",
  } = props;

  assertText(ariaLabel, "Label Support Audit");
  assertText(selectedContextKey, "Support context terpilih");
  assertText(sourceLabel, "Sumber Support Audit");
  assertText(statusLabel, "Status Support Audit");
  assertText(title, "Judul Support Audit");
  contexts.forEach((context) => {
    assertText(context.channelLabel, "Channel support context");
    assertText(context.disabledReason, "Alasan context disabled");
    assertText(context.key, "Key support context");
    assertText(context.label, "Label support context");
    assertText(context.priorityLabel, "Prioritas support context");
    assertText(context.scopeLabel, "Scope support context");
    assertText(context.summaryLabel, "Ringkasan support context");
  });
  events.forEach((event) => {
    assertText(event.categoryLabel, "Kategori Audit Event");
    assertText(event.contextKey, "Context Audit Event");
    assertText(event.detailLabel, "Detail Audit Event");
    assertText(event.key, "Key Audit Event");
    assertText(event.resolutionLabel, "Resolusi Audit Event");
    assertText(event.sourceLabel, "Sumber Audit Event");
    assertText(event.stateLabel, "Status Audit Event");
    assertText(event.timeLabel, "Waktu Audit Event");
    assertText(event.title, "Judul Audit Event");
  });

  const selectedContext = contexts.find((context) => context.key === selectedContextKey);
  if (!selectedContext) throw new TypeError("Support context terpilih harus tersedia.");

  const contextKeys = new Set(contexts.map((context) => context.key));
  const eventsForSelectedContext = events.filter((event) => {
    if (!contextKeys.has(event.contextKey)) {
      throw new TypeError("Audit Event harus terhubung ke support context yang tersedia.");
    }
    return event.contextKey === selectedContextKey;
  });
  const openContextCount = contexts.filter((context) => context.state !== "RESOLVED").length;
  const attentionEventCount = eventsForSelectedContext.filter(
    (event) => event.severity === "WARNING" || event.severity === "DANGER",
  ).length;

  return (
    <section
      aria-label={ariaLabel.trim()}
      className={classes("ui-platform-support-audit", className)}
      data-platform-support-audit
    >
      <header className="ui-platform-support-audit__header">
        <span className="ui-platform-support-audit__icon" aria-hidden="true">
          <AppIcon icon={LifeBuoy} size="lg" />
        </span>
        <div>
          <h2>{title.trim()}</h2>
          {sourceLabel ? <p>{sourceLabel.trim()}</p> : null}
        </div>
        <div className="ui-platform-support-audit__header-actions">
          {statusLabel ? <Badge tone="info">{statusLabel.trim()}</Badge> : null}
          {onRefresh ? (
            <button aria-label="Refresh Support Audit" onClick={() => onRefresh()} type="button">
              <AppIcon icon={RefreshCw} size="sm" />
            </button>
          ) : null}
        </div>
      </header>

      <div className="ui-platform-support-audit__summary" aria-label="Ringkasan Support Audit">
        <div>
          <strong>{contexts.length}</strong>
          <span>Support context</span>
        </div>
        <div>
          <strong>{openContextCount}</strong>
          <span>Perlu tindak lanjut</span>
        </div>
        <div>
          <strong>{attentionEventCount}</strong>
          <span>Event perlu perhatian</span>
        </div>
      </div>

      <div className="ui-platform-support-audit__layout">
        <aside aria-label="Daftar Support context" className="ui-platform-support-contexts">
          <header>
            <h3>Support context</h3>
            <span>{contexts.length} context</span>
          </header>
          <div className="ui-platform-support-contexts__list">
            {contexts.map((context) => {
              const selected = context.key === selectedContextKey || context.selected === true;
              const state = stateContent[context.state];

              return (
                <button
                  aria-pressed={selected}
                  className={classes(
                    "ui-platform-support-context",
                    selected && "is-selected",
                    context.disabled && "is-disabled",
                  )}
                  disabled={context.disabled || !onSelectContext}
                  key={context.key}
                  onClick={() => onSelectContext?.(context.key)}
                  type="button"
                >
                  <span>
                    <strong>{context.label.trim()}</strong>
                    <Badge tone={state.tone}>{state.label}</Badge>
                  </span>
                  <small>{context.scopeLabel.trim()}</small>
                  <small>{context.channelLabel.trim()}</small>
                  {context.priorityLabel ? <small>{context.priorityLabel.trim()}</small> : null}
                  {context.summaryLabel ? <p>{context.summaryLabel.trim()}</p> : null}
                  {context.disabled && context.disabledReason ? (
                    <small>{context.disabledReason.trim()}</small>
                  ) : null}
                </button>
              );
            })}
          </div>
        </aside>

        <section aria-label="Daftar Audit Event" className="ui-platform-audit-events">
          <header>
            <span aria-hidden="true">
              <AppIcon icon={ClipboardList} size="sm" />
            </span>
            <div>
              <h3>Audit Event</h3>
              <p>{selectedContext.label.trim()}</p>
            </div>
          </header>

          {eventsForSelectedContext.length > 0 ? (
            <div className="ui-platform-audit-events__rows" role="list">
              {eventsForSelectedContext.map((event) => {
                const severity = severityContent[event.severity];

                return (
                  <div className="ui-platform-audit-event" key={event.key} role="listitem">
                    <div>
                      <h4>{event.title.trim()}</h4>
                      <p>{event.detailLabel.trim()}</p>
                    </div>
                    <Badge tone={severity.tone}>{severity.label}</Badge>
                    <dl>
                      <div>
                        <dt>Kategori</dt>
                        <dd>{event.categoryLabel.trim()}</dd>
                      </div>
                      <div>
                        <dt>Status</dt>
                        <dd>{event.stateLabel.trim()}</dd>
                      </div>
                      {event.sourceLabel ? (
                        <div>
                          <dt>Sumber</dt>
                          <dd>{event.sourceLabel.trim()}</dd>
                        </div>
                      ) : null}
                      {event.timeLabel ? (
                        <div>
                          <dt>Waktu</dt>
                          <dd>{event.timeLabel.trim()}</dd>
                        </div>
                      ) : null}
                      {event.resolutionLabel ? (
                        <div>
                          <dt>Resolusi</dt>
                          <dd>{event.resolutionLabel.trim()}</dd>
                        </div>
                      ) : null}
                    </dl>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="ui-platform-support-audit__empty">
              Audit Event untuk context ini belum tersedia.
            </p>
          )}
        </section>
      </div>
    </section>
  );
}
