"use client";

import { Grid3X3, RefreshCw, ShieldCheck } from "lucide-react";

import { AppIcon } from "./app-icon";
import { Badge, type FeedbackTone } from "./feedback";
import { Switch } from "./selection-control";

export type PlatformEntitlementModuleKind = "CORE" | "COMMERCIAL";
export type PlatformEntitlementCellSource = "CORE" | "PLAN" | "DEPENDENCY" | "OVERRIDE" | "NONE";

export type PlatformEntitlementPlan = {
  code: string;
  disabled?: boolean;
  disabledReason?: string;
  name: string;
  selected?: boolean;
  tenantCountLabel?: string;
};

export type PlatformEntitlementModule = {
  dependencyLabel?: string;
  kind: PlatformEntitlementModuleKind;
  key: string;
  name: string;
  purposeLabel: string;
};

export type PlatformEntitlementMatrixCell = {
  disabled?: boolean;
  disabledReason?: string;
  enabled: boolean;
  moduleKey: string;
  planCode: string;
  reasonLabel: string;
  source: PlatformEntitlementCellSource;
  sourceLabel?: string;
};

export type PlatformEntitlementMatrixProps = {
  ariaLabel?: string;
  cells: readonly PlatformEntitlementMatrixCell[];
  className?: string;
  modules: readonly PlatformEntitlementModule[];
  onRefresh?: () => void;
  onSelectPlan?: (planCode: string) => void;
  onTogglePlanModule?: (planCode: string, moduleKey: string, enabled: boolean) => void;
  plans: readonly PlatformEntitlementPlan[];
  selectedPlanCode: string;
  sourceLabel?: string;
  statusLabel?: string;
  title?: string;
};

const cellSourceContent: Record<
  PlatformEntitlementCellSource,
  { label: string; tone: FeedbackTone }
> = {
  CORE: { label: "Core", tone: "info" },
  DEPENDENCY: { label: "Dependency", tone: "warning" },
  NONE: { label: "Tidak aktif", tone: "danger" },
  OVERRIDE: { label: "Override", tone: "warning" },
  PLAN: { label: "Plan", tone: "success" },
};

const moduleKindContent: Record<
  PlatformEntitlementModuleKind,
  { label: string; tone: FeedbackTone }
> = {
  COMMERCIAL: { label: "Commercial", tone: "success" },
  CORE: { label: "Core", tone: "info" },
};

const platformEntitlementMatrixSensitiveKeyPattern =
  /(?:id|tenant|subscription|user|owner|session|request|payment|billing|invoice|receipt|card|bank|phone|telepon|email|address|alamat|token|payload|permission|password|secret|audit|actor|timestamp|createdAt|updatedAt|raw|outlet|brand|customer|order|hpp|cogs|cost|profit|margin|ledger|journal|webhook|attachment)/i;

const allowedActionProps = new Set(["onRefresh", "onSelectPlan", "onTogglePlanModule"]);
const allowedHiddenValueProps = new Set([
  "code",
  "key",
  "moduleKey",
  "planCode",
  "selectedPlanCode",
  "tenantCountLabel",
]);

function classes(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function assertText(value: string | undefined, fieldName: string) {
  if (value !== undefined && !value.trim()) {
    throw new TypeError(`${fieldName} harus berisi teks bila dikirim.`);
  }
}

function assertNoSensitiveProps(value: unknown, path = "Platform entitlement matrix payload") {
  if (value === null || value === undefined || typeof value !== "object") return;

  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoSensitiveProps(item, `${path}[${index}]`));
    return;
  }

  for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
    if (/^on[A-Z]/.test(key) && !allowedActionProps.has(key)) {
      throw new TypeError(`${path} tidak menerima action prop di luar kontrak: ${key}.`);
    }
    if (
      !allowedHiddenValueProps.has(key) &&
      platformEntitlementMatrixSensitiveKeyPattern.test(key)
    ) {
      throw new TypeError(`${path} tidak boleh menerima data sensitif/out-of-scope: ${key}.`);
    }
    if (nestedValue && typeof nestedValue === "object") {
      assertNoSensitiveProps(nestedValue, `${path}.${key}`);
    }
  }
}

function assertUniqueValues(
  items: readonly { code?: string; key?: string; name: string }[],
  field: "code" | "key",
  label: string,
) {
  const hiddenValues = new Set<string>();
  const displayValues = new Set<string>();

  for (const item of items) {
    const hiddenValue = item[field];
    if (!hiddenValue?.trim()) throw new TypeError(`${label} memerlukan value tersembunyi.`);
    if (hiddenValues.has(hiddenValue)) throw new TypeError(`${label} tidak boleh duplikat.`);
    hiddenValues.add(hiddenValue);

    const displayValue = item.name.trim().toLowerCase();
    if (!displayValue) throw new TypeError(`${label} memerlukan label tampilan.`);
    if (displayValues.has(displayValue))
      throw new TypeError(`${label} tidak boleh memiliki label duplikat.`);
    displayValues.add(displayValue);
  }
}

function getCell(
  cells: readonly PlatformEntitlementMatrixCell[],
  planCode: string,
  moduleKey: string,
) {
  return cells.find((cell) => cell.planCode === planCode && cell.moduleKey === moduleKey);
}

export function PlatformEntitlementMatrix(props: PlatformEntitlementMatrixProps) {
  assertNoSensitiveProps(props);
  assertUniqueValues(props.plans, "code", "Plan entitlement");
  assertUniqueValues(props.modules, "key", "Module entitlement");

  const {
    ariaLabel = "Platform Entitlement Matrix",
    cells,
    className,
    modules,
    onRefresh,
    onSelectPlan,
    onTogglePlanModule,
    plans,
    selectedPlanCode,
    sourceLabel,
    statusLabel,
    title = "Entitlement Matrix",
  } = props;

  assertText(ariaLabel, "Label Platform Entitlement Matrix");
  assertText(selectedPlanCode, "Plan terpilih Platform Entitlement Matrix");
  assertText(sourceLabel, "Sumber Platform Entitlement Matrix");
  assertText(statusLabel, "Status Platform Entitlement Matrix");
  assertText(title, "Judul Platform Entitlement Matrix");
  plans.forEach((plan) => {
    assertText(plan.disabledReason, "Alasan plan disabled Entitlement Matrix");
    assertText(plan.name, "Nama plan Entitlement Matrix");
    assertText(plan.tenantCountLabel, "Jumlah tenant plan Entitlement Matrix");
  });
  modules.forEach((module) => {
    assertText(module.dependencyLabel, "Dependency module Entitlement Matrix");
    assertText(module.key, "Key module Entitlement Matrix");
    assertText(module.name, "Nama module Entitlement Matrix");
    assertText(module.purposeLabel, "Tujuan module Entitlement Matrix");
  });
  cells.forEach((cell) => {
    assertText(cell.disabledReason, "Alasan cell disabled Entitlement Matrix");
    assertText(cell.moduleKey, "Module cell Entitlement Matrix");
    assertText(cell.planCode, "Plan cell Entitlement Matrix");
    assertText(cell.reasonLabel, "Alasan cell Entitlement Matrix");
    assertText(cell.sourceLabel, "Sumber cell Entitlement Matrix");
  });

  const selectedPlan = plans.find((plan) => plan.code === selectedPlanCode);
  if (!selectedPlan) throw new TypeError("Plan terpilih harus tersedia pada daftar plan.");

  const selectedEnabledCount = modules.filter(
    (module) => getCell(cells, selectedPlanCode, module.key)?.enabled === true,
  ).length;

  return (
    <section
      aria-label={ariaLabel.trim()}
      className={classes("ui-platform-entitlement-matrix", className)}
      data-platform-entitlement-matrix
    >
      <header className="ui-platform-entitlement-matrix__header">
        <span className="ui-platform-entitlement-matrix__icon" aria-hidden="true">
          <AppIcon icon={Grid3X3} size="lg" />
        </span>
        <div>
          <h2>{title.trim()}</h2>
          {sourceLabel ? <p>{sourceLabel.trim()}</p> : null}
        </div>
        <div className="ui-platform-entitlement-matrix__header-actions">
          {statusLabel ? <Badge tone="info">{statusLabel.trim()}</Badge> : null}
          {onRefresh ? (
            <button
              aria-label="Refresh Entitlement Matrix"
              onClick={() => onRefresh()}
              type="button"
            >
              <AppIcon icon={RefreshCw} size="sm" />
            </button>
          ) : null}
        </div>
      </header>

      <div
        className="ui-platform-entitlement-matrix__summary"
        aria-label="Ringkasan Entitlement Matrix"
      >
        <div>
          <strong>{plans.length}</strong>
          <span>Plan</span>
        </div>
        <div>
          <strong>{modules.length}</strong>
          <span>Module</span>
        </div>
        <div>
          <strong>{selectedEnabledCount}</strong>
          <span>Aktif pada plan terpilih</span>
        </div>
      </div>

      <div className="ui-platform-entitlement-matrix__layout">
        <aside
          aria-label="Plan Entitlement Matrix"
          className="ui-platform-entitlement-matrix-plans"
        >
          <header>
            <h3>Plan</h3>
            <span>{plans.length} plan</span>
          </header>
          <div className="ui-platform-entitlement-matrix-plans__list">
            {plans.map((plan) => {
              const selected = plan.code === selectedPlanCode || plan.selected === true;
              const enabledCount = modules.filter(
                (module) => getCell(cells, plan.code, module.key)?.enabled === true,
              ).length;

              return (
                <button
                  aria-pressed={selected}
                  className={classes(
                    "ui-platform-entitlement-matrix-plan",
                    selected && "is-selected",
                    plan.disabled && "is-disabled",
                  )}
                  disabled={plan.disabled || !onSelectPlan}
                  key={plan.code}
                  onClick={() => onSelectPlan?.(plan.code)}
                  type="button"
                >
                  <strong>{plan.name.trim()}</strong>
                  {plan.tenantCountLabel ? <span>{plan.tenantCountLabel.trim()}</span> : null}
                  {modules.length > 0 ? <small>{enabledCount} module aktif</small> : null}
                  {plan.disabled && plan.disabledReason ? (
                    <small>{plan.disabledReason.trim()}</small>
                  ) : null}
                </button>
              );
            })}
          </div>
        </aside>

        <section
          aria-label="Matrix module entitlement"
          className="ui-platform-entitlement-matrix-table"
        >
          <header>
            <span aria-hidden="true">
              <AppIcon icon={ShieldCheck} size="sm" />
            </span>
            <div>
              <h3>Module default</h3>
              <p>Plan terpilih</p>
            </div>
          </header>

          {modules.length > 0 ? (
            <div className="ui-platform-entitlement-matrix-table__rows" role="list">
              {modules.map((module) => {
                const cell = getCell(cells, selectedPlanCode, module.key);
                const source = cellSourceContent[cell?.source ?? "NONE"];
                const kind = moduleKindContent[module.kind];
                const enabled = cell?.enabled === true;
                const disabled = !cell || cell.disabled || !onTogglePlanModule;
                const reasonLabel = cell?.reasonLabel.trim() ?? "Belum tersedia untuk plan ini.";
                const sourceLabel = cell?.sourceLabel?.trim() || source.label;

                return (
                  <div
                    className="ui-platform-entitlement-matrix-row"
                    key={module.key}
                    role="listitem"
                  >
                    <div>
                      <h4>{module.name.trim()}</h4>
                      <p>{module.purposeLabel.trim()}</p>
                      {module.dependencyLabel ? (
                        <small>{module.dependencyLabel.trim()}</small>
                      ) : null}
                    </div>
                    <Badge tone={kind.tone}>{kind.label}</Badge>
                    <Badge tone={source.tone}>{sourceLabel}</Badge>
                    <Switch
                      checked={enabled}
                      disabled={disabled}
                      label={enabled ? "Aktif" : "Nonaktif"}
                      onChange={(event) =>
                        onTogglePlanModule?.(
                          selectedPlanCode,
                          module.key,
                          event.currentTarget.checked,
                        )
                      }
                      size="sm"
                    />
                    <p>{reasonLabel}</p>
                    {cell?.disabled && cell.disabledReason ? (
                      <small>{cell.disabledReason.trim()}</small>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="ui-platform-entitlement-matrix__empty">
              Module entitlement belum tersedia.
            </p>
          )}
        </section>
      </div>
    </section>
  );
}
