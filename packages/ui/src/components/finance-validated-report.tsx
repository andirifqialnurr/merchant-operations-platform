"use client";

import {
  BarChart3,
  CheckCircle2,
  CircleDollarSign,
  Table2,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

import { AppIcon } from "./app-icon";
import { Chart } from "./data-display";
import { Badge } from "./feedback";
import {
  formatMoneyMinor,
  MoneyDisplay,
  type MoneyMinorValue,
  type MoneyNegativeFormat,
} from "./money-display";

export type FinanceValidatedReportMetricKind =
  | "sales"
  | "expense"
  | "other-income"
  | "cashbook"
  | "hpp-estimate"
  | "gross-profit"
  | "operating-profit"
  | "cash-variance";

export type FinanceValidatedReportTone = "neutral" | "info" | "success" | "warning" | "danger";

export type FinanceValidatedReportMetric = {
  amountMinor: MoneyMinorValue;
  categoryLabel?: string;
  id: string;
  kind: FinanceValidatedReportMetricKind;
  label?: string;
  noteLabel?: string;
  previousAmountMinor?: MoneyMinorValue | null;
  tone?: FinanceValidatedReportTone;
  validation: "validated";
  validationLabel?: string;
};

export type FinanceValidatedReportTrendPoint = {
  id: string;
  label: string;
  values: Partial<Record<FinanceValidatedReportMetricKind, MoneyMinorValue | null | undefined>>;
};

export type FinanceValidatedReportProps = {
  ariaLabel?: string;
  chartTitle?: string;
  className?: string;
  currency?: string;
  locale?: string;
  metrics: readonly FinanceValidatedReportMetric[];
  periodLabel: string;
  sourceLabel?: string;
  statusLabel?: string;
  tableTitle?: string;
  trendPoints?: readonly FinanceValidatedReportTrendPoint[];
};

type MetricContent = {
  categoryLabel: string;
  icon: typeof CircleDollarSign;
  label: string;
  tone: FinanceValidatedReportTone;
};

const metricContent: Record<FinanceValidatedReportMetricKind, MetricContent> = {
  cashbook: {
    categoryLabel: "Cashbook",
    icon: CircleDollarSign,
    label: "Cashbook",
    tone: "info",
  },
  "cash-variance": {
    categoryLabel: "Cash control",
    icon: TrendingDown,
    label: "Cash variance",
    tone: "warning",
  },
  expense: {
    categoryLabel: "Expense",
    icon: TrendingDown,
    label: "Expense",
    tone: "warning",
  },
  "gross-profit": {
    categoryLabel: "Profit estimate",
    icon: CircleDollarSign,
    label: "Gross profit",
    tone: "info",
  },
  "hpp-estimate": {
    categoryLabel: "Profit estimate",
    icon: Table2,
    label: "HPP estimate",
    tone: "warning",
  },
  "operating-profit": {
    categoryLabel: "Profit estimate",
    icon: CircleDollarSign,
    label: "Operating profit",
    tone: "success",
  },
  "other-income": {
    categoryLabel: "Other income",
    icon: TrendingUp,
    label: "Other income",
    tone: "success",
  },
  sales: {
    categoryLabel: "Sales",
    icon: TrendingUp,
    label: "Sales",
    tone: "success",
  },
};

const financeReportSensitiveKeyPattern =
  /(?:paymentId|paymentToken|paymentPayload|paymentAllocation|billId|invoiceId|orderId|customer|phone|telepon|email|audit|actor|timestamp|createdAt|updatedAt|validatedAt|validatedBy|barcode|token|payload|permission|internalId|tenantId|outletId|ledgerId|journalId|receiptId|shiftId|raw|ingredient|vendor|supplier|unitCost|costRow|recipeLine|stockMovement|reconciliation|refund|dispute|webhook|attachment|taxAccounting|formalReport|chartConfig|chartOptions|apexOptions|rawSeries|axisConfig)/i;

function classes(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function assertText(value: string | undefined, fieldName: string) {
  if (value !== undefined && !value.trim()) {
    throw new TypeError(`${fieldName} harus berisi teks bila dikirim.`);
  }
}

function assertNoSensitiveProps(value: unknown, path = "Finance validated report payload") {
  if (value === null || value === undefined || typeof value !== "object") return;

  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoSensitiveProps(item, `${path}[${index}]`));
    return;
  }

  for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
    if (/^on[A-Z]/.test(key)) {
      throw new TypeError(`${path} bersifat read-only dan tidak menerima action prop: ${key}.`);
    }
    if (financeReportSensitiveKeyPattern.test(key)) {
      throw new TypeError(`${path} tidak boleh menerima data sensitif/out-of-scope: ${key}.`);
    }
    if (nestedValue && typeof nestedValue === "object") {
      assertNoSensitiveProps(nestedValue, `${path}.${key}`);
    }
  }
}

function assertUniqueIds(items: readonly { id: string }[], fieldName: string) {
  const seen = new Set<string>();

  for (const item of items) {
    if (!item.id.trim()) throw new TypeError(`${fieldName} memerlukan id tersembunyi.`);
    if (seen.has(item.id)) throw new TypeError(`${fieldName} tidak boleh memiliki id duplikat.`);
    seen.add(item.id);
  }
}

function assertValidatedMetrics(metrics: readonly FinanceValidatedReportMetric[]) {
  const seenKinds = new Set<FinanceValidatedReportMetricKind>();

  for (const metric of metrics) {
    if (metric.validation !== "validated") {
      throw new TypeError("Finance report hanya menerima metrik yang tervalidasi.");
    }
    if (seenKinds.has(metric.kind)) {
      throw new TypeError(`Finance report hanya menerima satu lokasi utama untuk ${metric.kind}.`);
    }
    seenKinds.add(metric.kind);
  }
}

function parseMinorValue(value: MoneyMinorValue) {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) {
      throw new TypeError("Finance report hanya menerima number berupa safe integer minor-unit.");
    }
    return BigInt(value);
  }
  if (!/^-?\d+$/.test(value)) {
    throw new TypeError("Finance report hanya menerima string integer minor-unit.");
  }
  return BigInt(value);
}

function toChartNumber(value: MoneyMinorValue) {
  const parsed = parseMinorValue(value);
  const asNumber = Number(parsed);
  if (!Number.isSafeInteger(asNumber)) {
    throw new TypeError("Finance report chart memerlukan nilai minor-unit dalam rentang aman.");
  }
  return asNumber;
}

function formatDelta(
  current: MoneyMinorValue,
  previous: MoneyMinorValue | null | undefined,
  {
    currency,
    locale,
    negativeFormat,
  }: { currency: string; locale: string; negativeFormat: MoneyNegativeFormat },
) {
  if (previous === null || previous === undefined) return null;

  const currentValue = parseMinorValue(current);
  const previousValue = parseMinorValue(previous);
  const delta = currentValue - previousValue;
  const formattedDelta = formatMoneyMinor(delta, { currency, locale, negativeFormat });

  if (previousValue === 0n) return formattedDelta;

  const absolutePrevious = previousValue < 0n ? -previousValue : previousValue;
  const basisPoints = (delta * 10_000n) / absolutePrevious;
  const percentValue = Number(basisPoints) / 100;
  const formattedPercent = new Intl.NumberFormat(locale, {
    maximumFractionDigits: 1,
    minimumFractionDigits: 0,
    signDisplay: "exceptZero",
    style: "percent",
  }).format(percentValue / 100);

  return `${formattedDelta} (${formattedPercent})`;
}

function buildChartSeries(
  metrics: readonly FinanceValidatedReportMetric[],
  trendPoints: readonly FinanceValidatedReportTrendPoint[] | undefined,
) {
  if (!trendPoints?.length) return [];

  return metrics
    .map((metric) => {
      const data: number[] = [];

      for (const point of trendPoints) {
        const value = point.values[metric.kind];
        if (value === null || value === undefined) return null;
        data.push(toChartNumber(value));
      }

      return { data, name: metric.label?.trim() || metricContent[metric.kind].label };
    })
    .filter((series): series is { data: number[]; name: string } => series !== null);
}

export function FinanceValidatedReport(props: FinanceValidatedReportProps) {
  assertNoSensitiveProps(props);
  assertUniqueIds(props.metrics, "Finance report metric");
  assertUniqueIds(props.trendPoints ?? [], "Finance report trend point");
  assertValidatedMetrics(props.metrics);

  const {
    ariaLabel = "Report Finance tervalidasi",
    chartTitle = "Trend metrik tervalidasi",
    className,
    currency = "IDR",
    locale = "id-ID",
    metrics,
    periodLabel,
    sourceLabel,
    statusLabel,
    tableTitle = "Tabel metrik tervalidasi",
    trendPoints,
  } = props;

  assertText(chartTitle, "Judul chart Finance report");
  assertText(periodLabel, "Periode Finance report");
  assertText(sourceLabel, "Sumber Finance report");
  assertText(statusLabel, "Status Finance report");
  assertText(tableTitle, "Judul tabel Finance report");
  metrics.forEach((metric) => {
    assertText(metric.categoryLabel, "Kategori metrik Finance report");
    assertText(metric.label, "Label metrik Finance report");
    assertText(metric.noteLabel, "Catatan metrik Finance report");
    assertText(metric.validationLabel, "Label validasi metrik Finance report");
  });
  trendPoints?.forEach((point) => assertText(point.label, "Label periode chart Finance report"));

  const chartSeries = buildChartSeries(metrics, trendPoints);
  const chartCategories = trendPoints?.map((point) => point.label.trim()) ?? [];
  const negativeFormat: MoneyNegativeFormat = "minus";
  const tableRows = metrics.map((metric) => {
    const content = metricContent[metric.kind];
    const Icon = content.icon;
    const tone = metric.tone ?? content.tone;
    const label = metric.label?.trim() || content.label;
    const categoryLabel = metric.categoryLabel?.trim() || content.categoryLabel;
    const deltaLabel = formatDelta(metric.amountMinor, metric.previousAmountMinor, {
      currency,
      locale,
      negativeFormat,
    });

    return {
      categoryLabel,
      deltaLabel,
      icon: Icon,
      label,
      metric,
      tone,
      validationLabel: metric.validationLabel?.trim() || "Tervalidasi",
    };
  });
  const reportSummary =
    chartSeries.length > 0
      ? `${chartSeries.length} dari ${metrics.length} metrik tervalidasi tampil pada trend.`
      : "Belum ada titik trend tervalidasi untuk chart.";

  return (
    <section aria-label={ariaLabel} className={classes("ui-finance-report", className)}>
      <header className="ui-finance-report__header">
        <div>
          <h2>Finance report</h2>
          <p>{periodLabel.trim()}</p>
          {sourceLabel ? <small>{sourceLabel.trim()}</small> : null}
        </div>
        {statusLabel ? <span>{statusLabel.trim()}</span> : null}
      </header>

      <div className="ui-finance-report__summary" aria-label="Ringkasan metrik tervalidasi">
        <div>
          <span>{metrics.length}</span>
          <p>Metrik tervalidasi</p>
        </div>
        <div>
          <span>{chartSeries.length}</span>
          <p>Series chart</p>
        </div>
      </div>

      <div className="ui-finance-report__content">
        <Chart
          categories={chartCategories}
          height={320}
          series={chartSeries}
          state={chartSeries.length > 0 ? "ready" : "empty"}
          summary={reportSummary}
          title={chartTitle.trim()}
          type="line"
        />

        <section aria-label={tableTitle.trim()} className="ui-finance-report-table">
          <header>
            <span className="ui-finance-report-table__icon" aria-hidden="true">
              <AppIcon icon={BarChart3} size="sm" />
            </span>
            <div>
              <h3>{tableTitle.trim()}</h3>
              <p>Hanya metrik tervalidasi yang masuk ke tabel dan chart.</p>
            </div>
          </header>

          {tableRows.length > 0 ? (
            <div className="ui-finance-report-table__scroll">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Metrik</th>
                    <th scope="col">Kategori</th>
                    <th scope="col">Nominal</th>
                    <th scope="col">Perubahan</th>
                    <th scope="col">Validasi</th>
                  </tr>
                </thead>
                <tbody>
                  {tableRows.map((row) => (
                    <tr key={row.metric.id}>
                      <th scope="row">
                        <span
                          className={classes(
                            "ui-finance-report-table__metric-icon",
                            `ui-finance-report-table__metric-icon--${row.tone}`,
                          )}
                          aria-hidden="true"
                        >
                          <AppIcon icon={row.icon} size="sm" />
                        </span>
                        <span>
                          <span>{row.label}</span>
                          {row.metric.noteLabel ? (
                            <small>{row.metric.noteLabel.trim()}</small>
                          ) : null}
                        </span>
                      </th>
                      <td>{row.categoryLabel}</td>
                      <td>
                        <MoneyDisplay
                          amountMinor={row.metric.amountMinor}
                          currency={currency}
                          locale={locale}
                          negativeFormat={negativeFormat}
                          variant="accounting"
                        />
                      </td>
                      <td>
                        {row.deltaLabel ?? (
                          <span className="ui-finance-report-table__muted">-</span>
                        )}
                      </td>
                      <td>
                        <Badge tone="success">
                          <AppIcon icon={CheckCircle2} size="xs" />
                          {row.validationLabel}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="ui-finance-report-table__empty">
              Belum ada metrik tervalidasi untuk report.
            </p>
          )}
        </section>
      </div>
    </section>
  );
}
