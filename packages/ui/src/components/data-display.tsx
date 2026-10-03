"use client";

import { type ComponentType, type ReactNode, useEffect, useId, useRef, useState } from "react";
import { IconChevronDown } from "@tabler/icons-react";
import { AppIcon } from "./app-icon";
import { Button } from "./button";
import { EmptyState, ErrorState, Skeleton } from "./feedback";

/*
 * Label props default to Indonesian until the i18n checkpoint moves every
 * default into the id/en dictionaries.
 */
type ChartType = "line" | "area" | "bar" | "donut";
type CartesianSeries = readonly { data: readonly number[]; name: string }[];
type ChartRendererProps = {
  height: number;
  options: Record<string, unknown>;
  series: unknown;
  type: ChartType;
};
type CommonChartProps = {
  emptyDescription?: string;
  emptyTitle: string;
  errorDescription?: string;
  errorTitle: string;
  /** Formats tooltip and axis values; defaults to a grouped number in `locale`. */
  formatValue?: (value: number) => string;
  height?: number;
  locale?: string;
  onRetry?: () => void;
  retryLabel: string;
  showLegend?: boolean;
  state?: "ready" | "loading" | "empty" | "error";
  /** Text alternative of the chart; always rendered below it. */
  summary: ReactNode;
  summaryLabel: string;
  title: string;
};
export type ChartProps =
  | (CommonChartProps & {
      categories: readonly string[];
      series: CartesianSeries;
      type: "line" | "area" | "bar";
    })
  | (CommonChartProps & {
      categories: readonly string[];
      series: readonly number[];
      type: "donut";
    });

/** P0 identity/status, P1 primary metric, P2 secondary, P3 audit. P2 and P3 hide on small screens. */
export type DataTableColumnPriority = 0 | 1 | 2 | 3;
export type DataTableColumn =
  | string
  | {
      align?: "start" | "end";
      label: string;
      priority?: DataTableColumnPriority;
    };

function columnOf(column: DataTableColumn) {
  return typeof column === "string" ? { label: column } : column;
}
function cellClass(column: DataTableColumn) {
  const { align, priority } = columnOf(column) as Exclude<DataTableColumn, string>;
  return (
    [align === "end" && "ui-table__cell--end", priority && `ui-table__cell--p${priority}`]
      .filter(Boolean)
      .join(" ") || undefined
  );
}

export function Card({
  children,
  variant = "outlined",
  size = "md",
}: {
  children: ReactNode;
  variant?: "plain" | "outlined" | "interactive" | "elevated" | "selected";
  size?: "sm" | "md" | "lg";
}) {
  return <section className={`ui-card ui-card--${variant} ui-card--${size}`}>{children}</section>;
}
/** A page section: optional heading and actions over content. Panels are never nested. */
export function Panel({
  actions,
  children,
  title,
}: {
  actions?: ReactNode;
  children: ReactNode;
  title?: string;
}) {
  const titleId = useId();
  return (
    <section aria-labelledby={title ? titleId : undefined} className="ui-panel">
      {title || actions ? (
        <header>
          {title ? <h2 id={titleId}>{title}</h2> : <span />}
          {actions ? <div>{actions}</div> : null}
        </header>
      ) : null}
      {children}
    </section>
  );
}
export function DataTable({
  caption,
  columns,
  density = "default",
  empty,
  onRowSelect,
  rows,
}: {
  /** Visually hidden table name for assistive technology. */
  caption?: string;
  columns: readonly DataTableColumn[];
  density?: "compact" | "default" | "comfortable";
  /** Rendered in place of the body when there are no rows. */
  empty?: ReactNode;
  /** Makes rows selectable by pointer and keyboard, e.g. to open a detail sheet. */
  onRowSelect?: (rowIndex: number) => void;
  rows: readonly ReactNode[][];
}) {
  return (
    <div className={`ui-table ui-table--${density}`}>
      <table>
        {caption ? <caption className="ui-visually-hidden">{caption}</caption> : null}
        <thead>
          <tr>
            {columns.map((column) => (
              <th className={cellClass(column)} key={columnOf(column).label} scope="col">
                {columnOf(column).label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && empty ? (
            <tr className="ui-table__empty">
              <td colSpan={columns.length}>{empty}</td>
            </tr>
          ) : null}
          {rows.map((row, rowIndex) => (
            <tr
              className={onRowSelect ? "ui-table__row--selectable" : undefined}
              key={rowIndex}
              onClick={onRowSelect ? () => onRowSelect(rowIndex) : undefined}
              onKeyDown={
                onRowSelect
                  ? (event) => {
                      if (event.key === "Enter" && event.target === event.currentTarget) {
                        onRowSelect(rowIndex);
                      }
                    }
                  : undefined
              }
              tabIndex={onRowSelect ? 0 : undefined}
            >
              {row.map((cell, cellIndex) => {
                const column = columns[cellIndex];
                return (
                  <td className={column ? cellClass(column) : undefined} key={cellIndex}>
                    {cell}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export function DescriptionList({
  items,
}: {
  items: readonly { label: string; value: ReactNode }[];
}) {
  return (
    <dl className="ui-description-list">
      {items.map((i) => (
        <div key={i.label}>
          <dt>{i.label}</dt>
          <dd>{i.value}</dd>
        </div>
      ))}
    </dl>
  );
}
export function MetricCard({
  label,
  value,
  change,
}: {
  label: string;
  value: ReactNode;
  change?: ReactNode;
}) {
  return (
    <div className="ui-metric">
      <p>{label}</p>
      <strong>{value}</strong>
      {change ? <small>{change}</small> : null}
    </div>
  );
}
function initials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const letters = words.length > 1 ? `${words[0]![0]}${words.at(-1)![0]}` : name.trim().slice(0, 2);
  return letters.toUpperCase();
}
export function Avatar({
  name,
  src,
  size = "md",
}: {
  name: string;
  src?: string;
  size?: "sm" | "md" | "lg";
}) {
  return (
    <span aria-label={name} className={`ui-avatar ui-avatar--${size}`} role="img">
      {src ? <img alt="" src={src} /> : initials(name)}
    </span>
  );
}
export function Divider({ vertical = false }: { vertical?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={vertical ? "ui-divider ui-divider--vertical" : "ui-divider"}
    />
  );
}
export function Accordion({ items }: { items: readonly { title: string; content: ReactNode }[] }) {
  const [open, setOpen] = useState<number | undefined>();
  const id = useId();
  return (
    <div className="ui-accordion">
      {items.map((item, i) => (
        <section key={item.title}>
          <button
            aria-controls={`${id}-${i}`}
            aria-expanded={open === i}
            onClick={() => setOpen(open === i ? undefined : i)}
            type="button"
          >
            <span>{item.title}</span>
            <AppIcon icon={IconChevronDown} size="sm" />
          </button>
          {open === i ? <div id={`${id}-${i}`}>{item.content}</div> : null}
        </section>
      ))}
    </div>
  );
}
export function Timeline({
  items,
}: {
  items: readonly { title: string; description?: string; time: string }[];
}) {
  return (
    <ol className="ui-timeline">
      {items.map((i) => (
        <li key={`${i.title}-${i.time}`}>
          <span />
          <div>
            <strong>{i.title}</strong>
            {i.description ? <p>{i.description}</p> : null}
            <time>{i.time}</time>
          </div>
        </li>
      ))}
    </ol>
  );
}

const CHART_TOKENS = {
  border: "--color-border-subtle",
  series1: "--color-chart-series-1",
  series2: "--color-chart-series-2",
  series3: "--color-chart-series-3",
  series4: "--color-chart-series-4",
  series5: "--color-chart-series-5",
  series6: "--color-chart-series-6",
  text: "--color-text-secondary",
} as const;
type ChartPalette = Record<keyof typeof CHART_TOKENS, string> & { dark: boolean };

function fallbackPalette(): ChartPalette {
  const entries = Object.entries(CHART_TOKENS).map(([key, token]) => [key, `var(${token})`]);
  return {
    ...(Object.fromEntries(entries) as Record<keyof typeof CHART_TOKENS, string>),
    dark: false,
  };
}
/**
 * ApexCharts computes hover and gradient shades from concrete colors, so the
 * tokens are resolved from the chart's own element and re-read on theme change.
 */
function useChartPalette(elementRef: { current: HTMLElement | null }) {
  const [palette, setPalette] = useState<ChartPalette>(fallbackPalette);
  useEffect(() => {
    function read() {
      const element = elementRef.current;
      if (!element) return;
      const style = window.getComputedStyle(element);
      const next = fallbackPalette();
      for (const [key, token] of Object.entries(CHART_TOKENS)) {
        const value = style.getPropertyValue(token).trim();
        if (value) next[key as keyof typeof CHART_TOKENS] = value;
      }
      next.dark = style.colorScheme.trim().startsWith("dark");
      setPalette(next);
    }
    read();
    const observer = new MutationObserver(read);
    observer.observe(document.documentElement, {
      attributeFilter: ["data-theme", "class", "style"],
      attributes: true,
    });
    const scheme =
      typeof window.matchMedia === "function"
        ? window.matchMedia("(prefers-color-scheme: dark)")
        : undefined;
    scheme?.addEventListener("change", read);
    return () => {
      observer.disconnect();
      scheme?.removeEventListener("change", read);
    };
  }, [elementRef]);
  return palette;
}

export function Chart({
  categories,
  emptyDescription,
  emptyTitle,
  errorDescription,
  errorTitle,
  formatValue,
  height = 280,
  locale = "id-ID",
  onRetry,
  retryLabel,
  series,
  showLegend = true,
  state = "ready",
  summary,
  summaryLabel,
  title,
  type,
}: ChartProps) {
  const [Renderer, setRenderer] = useState<ComponentType<ChartRendererProps> | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  const palette = useChartPalette(sectionRef);
  const titleId = useId();
  const isDonut = type === "donut";

  useEffect(() => {
    if (typeof window.matchMedia !== "function") {
      return;
    }

    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncReducedMotion = () => setReducedMotion(mediaQuery.matches);
    syncReducedMotion();
    mediaQuery.addEventListener("change", syncReducedMotion);
    return () => mediaQuery.removeEventListener("change", syncReducedMotion);
  }, []);

  useEffect(() => {
    if (state !== "ready") {
      return;
    }

    let active = true;
    void import("react-apexcharts").then(({ default: ApexChart }) => {
      if (active) {
        setRenderer(() => ApexChart as unknown as ComponentType<ChartRendererProps>);
      }
    });
    return () => {
      active = false;
    };
  }, [state]);

  const format = formatValue ?? ((value: number) => new Intl.NumberFormat(locale).format(value));
  const axisLabels = { style: { colors: palette.text, fontSize: "12px" } };
  const options: Record<string, unknown> = {
    chart: {
      animations: { enabled: !reducedMotion },
      background: "transparent",
      fontFamily: "inherit",
      foreColor: palette.text,
      toolbar: { show: false },
      zoom: { enabled: false },
    },
    colors: [
      palette.series1,
      palette.series2,
      palette.series3,
      palette.series4,
      palette.series5,
      palette.series6,
    ],
    dataLabels: { enabled: false },
    fill: type === "area" ? { opacity: 0.16, type: "solid" } : { opacity: 1 },
    grid: { borderColor: palette.border, strokeDashArray: 0 },
    labels: isDonut ? categories : undefined,
    legend: { fontSize: "12px", markers: { size: 5 }, show: showLegend },
    plotOptions: { bar: { borderRadius: 3, columnWidth: "56%" } },
    responsive: [
      {
        breakpoint: 640,
        options: { legend: { position: "bottom" } },
      },
    ],
    stroke: { curve: "smooth", width: type === "bar" || isDonut ? 0 : 2 },
    theme: { mode: palette.dark ? "dark" : "light" },
    tooltip: {
      enabled: true,
      theme: palette.dark ? "dark" : "light",
      y: { formatter: format },
    },
    xaxis: isDonut
      ? undefined
      : {
          axisBorder: { color: palette.border },
          axisTicks: { show: false },
          categories,
          labels: axisLabels,
        },
    yaxis: isDonut ? undefined : { labels: { ...axisLabels, formatter: format } },
  };

  return (
    <section
      aria-busy={state === "loading"}
      aria-labelledby={titleId}
      className="ui-chart"
      ref={sectionRef}
    >
      <header>
        <h2 id={titleId}>{title}</h2>
      </header>
      {state === "loading" || (state === "ready" && !Renderer) ? (
        <div className="ui-chart__loading">
          <Skeleton variant="metric-card" />
        </div>
      ) : null}
      {state === "empty" ? <EmptyState description={emptyDescription} title={emptyTitle} /> : null}
      {state === "error" ? (
        <ErrorState
          action={
            onRetry ? (
              <Button onClick={onRetry} variant="secondary">
                {retryLabel}
              </Button>
            ) : undefined
          }
          description={errorDescription}
          title={errorTitle}
        />
      ) : null}
      {state === "ready" && Renderer ? (
        <Renderer height={height} options={options} series={series} type={type} />
      ) : null}
      <div className="ui-chart__summary">
        <strong>{summaryLabel}</strong>
        <div>{summary}</div>
      </div>
    </section>
  );
}
