import type { ReactNode } from "react";

/**
 * A printable receipt. It knows nothing about orders or money: the caller
 * passes formatted rows and every label. On paper only the receipt prints;
 * the rest of the page is hidden by the print stylesheet.
 */

export type ReceiptPaper = "58mm" | "80mm" | "a4";

export type ReceiptRow = {
  /** Bold, slightly larger row, e.g. the total. */
  emphasis?: boolean;
  label: ReactNode;
  value: ReactNode;
};

export type ReceiptLine = {
  /** Omit for an unpriced review/pending line. */
  amount?: ReactNode;
  /** Variant and modifiers in one short line. */
  detail?: string;
  key: string;
  name: string;
  /** Already formatted, e.g. "2×". */
  quantity: string;
};

export type ReceiptGroup = {
  key: string;
  title: string;
  detail?: string;
  lines?: readonly ReceiptLine[];
  rows?: readonly ReceiptRow[];
};

export type ReceiptProps = {
  /** Accessible name of the receipt region. */
  ariaLabel: string;
  /** Marks a reprint, e.g. "SALINAN". Omit on the first print. */
  copyLabel?: string;
  /** Document type/state, supplied once by the caller. */
  documentLabel?: string;
  lineGroups?: readonly ReceiptGroup[];
  paymentGroups?: readonly ReceiptGroup[];
  /** Closing line, e.g. a thank-you. */
  footer?: string;
  lines: readonly ReceiptLine[];
  /** Sale number, time, cashier: one row each. */
  meta: readonly ReceiptRow[];
  paper?: ReceiptPaper;
  /** Payment method, cash received, change. */
  payment: readonly ReceiptRow[];
  /** Usually the workspace or brand name. */
  subtitle?: string;
  /** Usually the outlet name. */
  title: string;
  /** Subtotal, adjustments that apply, and the total. */
  totals: readonly ReceiptRow[];
};

function Rows({ rows }: Readonly<{ rows: readonly ReceiptRow[] }>) {
  if (rows.length === 0) return null;
  return (
    <dl className="ui-receipt__rows">
      {rows.map((row, index) => (
        <div
          className={row.emphasis ? "ui-receipt__row ui-receipt__row--emphasis" : "ui-receipt__row"}
          key={index}
        >
          <dt>{row.label}</dt>
          <dd>{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Lines({ lines }: Readonly<{ lines: readonly ReceiptLine[] }>) {
  if (lines.length === 0) return null;
  return (
    <ul className="ui-receipt__lines">
      {lines.map((line) => (
        <li key={line.key}>
          <div className="ui-receipt__line">
            <span>
              {line.quantity} {line.name}
            </span>
            {line.amount !== undefined ? <span>{line.amount}</span> : null}
          </div>
          {line.detail ? <p className="ui-receipt__detail">{line.detail}</p> : null}
        </li>
      ))}
    </ul>
  );
}

function Groups({ groups }: Readonly<{ groups: readonly ReceiptGroup[] }>) {
  return groups.map((group) => (
    <div className="ui-receipt__group" key={group.key}>
      <strong className="ui-receipt__group-title">{group.title}</strong>
      {group.detail ? <p className="ui-receipt__group-detail">{group.detail}</p> : null}
      <Lines lines={group.lines ?? []} />
      <Rows rows={group.rows ?? []} />
    </div>
  ));
}

export function Receipt({
  ariaLabel,
  copyLabel,
  documentLabel,
  footer,
  lines,
  lineGroups = [],
  paymentGroups = [],
  meta,
  paper = "80mm",
  payment,
  subtitle,
  title,
  totals,
}: ReceiptProps) {
  return (
    <section aria-label={ariaLabel} className={`ui-receipt ui-receipt--${paper}`}>
      {/* A div, not a header: overlays style their own header elements. */}
      <div className="ui-receipt__header">
        <strong>{title}</strong>
        {subtitle ? <span>{subtitle}</span> : null}
        {documentLabel ? <span className="ui-receipt__document-label">{documentLabel}</span> : null}
        {copyLabel ? <span className="ui-receipt__copy">{copyLabel}</span> : null}
      </div>

      <Rows rows={meta} />

      <Lines lines={lines} />
      <Groups groups={lineGroups} />

      <Rows rows={totals} />
      <Rows rows={payment} />
      <Groups groups={paymentGroups} />

      {footer ? <p className="ui-receipt__footer">{footer}</p> : null}
    </section>
  );
}
