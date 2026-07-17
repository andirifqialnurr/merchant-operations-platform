"use client";

import { type ComponentType, type ReactNode, useEffect, useState } from "react";
import { Button } from "./button";
import { EmptyState, ErrorState, Skeleton } from "./feedback";

type ChartType = "line" | "area" | "bar" | "donut";
type CartesianSeries = readonly { data: readonly number[]; name: string }[];
type ChartRendererProps = {
  height: number;
  options: Record<string, unknown>;
  series: unknown;
  type: ChartType;
};
type CommonChartProps = {
  height?: number;
  onRetry?: () => void;
  showLegend?: boolean;
  state?: "ready" | "loading" | "empty" | "error";
  summary: ReactNode;
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
export function DataTable({
  columns,
  rows,
  density = "default",
}: {
  columns: readonly string[];
  rows: readonly ReactNode[][];
  density?: "compact" | "default" | "comfortable";
}) {
  return (
    <div className={`ui-table ui-table--${density}`}>
      <table>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td key={j}>{c}</td>
              ))}
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
    <Card>
      <p>{label}</p>
      <strong>{value}</strong>
      {change ? <small>{change}</small> : null}
    </Card>
  );
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
    <span aria-label={name} className={`ui-avatar ui-avatar--${size}`}>
      {src ? <img alt="" src={src} /> : name.slice(0, 2).toUpperCase()}
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
  return (
    <div className="ui-accordion">
      {items.map((item, i) => (
        <section key={item.title}>
          <button
            aria-expanded={open === i}
            onClick={() => setOpen(open === i ? undefined : i)}
            type="button"
          >
            {item.title}
          </button>
          {open === i ? <div>{item.content}</div> : null}
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

export function Chart({
  categories,
  height = 280,
  onRetry,
  series,
  showLegend = true,
  state = "ready",
  summary,
  title,
  type,
}: ChartProps) {
  const [Renderer, setRenderer] = useState<ComponentType<ChartRendererProps> | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
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

  const options: Record<string, unknown> = {
    chart: {
      animations: { enabled: !reducedMotion },
      background: "transparent",
      toolbar: { show: false },
    },
    colors: [
      "var(--color-action-primary)",
      "var(--color-status-info)",
      "var(--color-status-neutral)",
      "var(--color-status-warning)",
      "var(--color-text-secondary)",
    ],
    dataLabels: { enabled: false },
    grid: { borderColor: "var(--color-border-subtle)" },
    labels: isDonut ? categories : undefined,
    legend: { show: showLegend },
    noData: { text: "Data belum tersedia" },
    responsive: [
      {
        breakpoint: 640,
        options: { legend: { position: "bottom" } },
      },
    ],
    stroke: { curve: "smooth", width: type === "bar" || isDonut ? 0 : 2 },
    tooltip: {
      enabled: true,
      y: { formatter: (value: number) => new Intl.NumberFormat("id-ID").format(value) },
    },
    xaxis: isDonut
      ? undefined
      : {
          categories,
          labels: { style: { colors: "var(--color-text-secondary)" } },
        },
    yaxis: isDonut
      ? undefined
      : { labels: { style: { colors: "var(--color-text-secondary)" } } },
  };

  return (
    <section aria-busy={state === "loading"} aria-label={title} className="ui-chart">
      <header>
        <h2>{title}</h2>
      </header>
      {state === "loading" || !Renderer ? (
        <div className="ui-chart__loading">
          <Skeleton variant="metric-card" />
        </div>
      ) : null}
      {state === "empty" ? (
        <EmptyState
          description="Belum ada data yang dapat ditampilkan untuk periode ini."
          title="Data chart belum tersedia"
        />
      ) : null}
      {state === "error" ? (
        <ErrorState
          action={onRetry ? <Button onClick={onRetry}>Coba lagi</Button> : undefined}
          description="Chart tidak dapat dimuat saat ini."
          title="Terjadi kesalahan"
        />
      ) : null}
      {state === "ready" && Renderer ? (
        <Renderer height={height} options={options} series={series} type={type} />
      ) : null}
      <div className="ui-chart__summary">
        <strong>Ringkasan data</strong>
        <div>{summary}</div>
      </div>
    </section>
  );
}
