import type { ReactNode } from "react";
import { IconGauge } from "@tabler/icons-react";

import { AppIcon } from "./app-icon";

/**
 * How close usage is to its limit (design-system.md 16.2): normal below 80%,
 * near from 80%, almost from 90%, reached from 100%. A dimension without a
 * cap is `unlimited` and never fills.
 */
export type UsageLevel = "almost" | "near" | "normal" | "reached" | "unlimited";

export function usageLevel(used: number, limit: number | null): UsageLevel {
  if (limit === null) return "unlimited";
  if (limit <= 0 || used >= limit) return "reached";
  const percent = (used / limit) * 100;
  if (percent >= 90) return "almost";
  return percent >= 80 ? "near" : "normal";
}

export type UsageMeterProps = {
  /** Name of what is limited, e.g. "Produk aktif". */
  label: string;
  /**
   * The level in words, e.g. "Hampir habis". Shown for every level except
   * normal and unlimited, so the level never depends on color alone.
   */
  levelLabel?: string;
  /** Null when the package does not cap this dimension. */
  limit: number | null;
  /** One short line under the bar, e.g. the reset date of a billing cycle. */
  note?: ReactNode;
  used: number;
  /** Usage and limit as the reader sees them, e.g. "40 dari 50". */
  valueLabel: string;
};

/** One limited dimension: its name, usage against the limit, and how full it is. */
export function UsageMeter({ label, levelLabel, limit, note, used, valueLabel }: UsageMeterProps) {
  const level = usageLevel(used, limit);
  const showLevel = levelLabel && level !== "normal" && level !== "unlimited";
  return (
    <div className="ui-usage-meter" data-level={level}>
      <div className="ui-usage-meter__head">
        <span className="ui-usage-meter__label">{label}</span>
        <span className="ui-usage-meter__value">{valueLabel}</span>
      </div>
      {limit === null ? null : (
        <div
          aria-label={label}
          aria-valuemax={limit}
          aria-valuemin={0}
          aria-valuenow={Math.min(used, limit)}
          aria-valuetext={showLevel ? `${valueLabel}, ${levelLabel}` : valueLabel}
          className="ui-usage-meter__bar"
          role="meter"
        >
          <span
            style={{
              inlineSize: `${limit <= 0 ? 100 : Math.max(0, Math.min(100, (used / limit) * 100))}%`,
            }}
          />
        </div>
      )}
      {showLevel || note ? (
        <div className="ui-usage-meter__foot">
          {showLevel ? <span className="ui-usage-meter__level">{levelLabel}</span> : null}
          {note ? <span className="ui-usage-meter__note">{note}</span> : null}
        </div>
      ) : null}
    </div>
  );
}

export type UsageLimitStateProps = {
  /**
   * At most one action: the upgrade or add-on invitation. Pass it only for
   * people who may see billing; cashiers and kitchen staff get none.
   */
  action?: ReactNode;
  description: ReactNode;
  /** The dimension that is full, when its numbers are known. */
  meter?: UsageMeterProps;
  title: string;
};

/**
 * Shown where something new cannot be created because the package's limit is
 * full. What already exists keeps working, so this is not an error state.
 */
export function UsageLimitState({ action, description, meter, title }: UsageLimitStateProps) {
  return (
    <section className="ui-state ui-usage-limit" role="status">
      <AppIcon icon={IconGauge} size="xl" />
      <h2>{title}</h2>
      <p>{description}</p>
      {meter ? <UsageMeter {...meter} /> : null}
      {action}
    </section>
  );
}
