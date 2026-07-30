"use client";

import { Building2, Crown, RefreshCw, ShieldCheck } from "lucide-react";

import { AppIcon } from "./app-icon";
import { Badge, type FeedbackTone } from "./feedback";
import { SegmentedControl, Switch } from "./selection-control";

export type PlatformTenantStatus = "ACTIVE" | "INACTIVE";
export type PlatformSubscriptionStatus = "TRIAL" | "ACTIVE" | "GRACE" | "SUSPENDED" | "TERMINATED";
export type PlatformEntitlementSource = "CORE" | "PLAN" | "OVERRIDE" | "DEPENDENCY" | "NONE";

export type PlatformTenantSummary = {
  disabled?: boolean;
  disabledReason?: string;
  id: string;
  name: string;
  selected?: boolean;
  status: PlatformTenantStatus;
  subscriptionStatus?: PlatformSubscriptionStatus;
};

export type PlatformSubscriptionSummary = {
  endsAtLabel?: string;
  graceEndsAtLabel?: string;
  planLabel: string;
  startsAtLabel: string;
  status: PlatformSubscriptionStatus;
};

export type PlatformModuleEntitlement = {
  disabled?: boolean;
  disabledReason?: string;
  enabled: boolean;
  key: string;
  name: string;
  reasonLabel: string;
  source: PlatformEntitlementSource;
  sourceLabel?: string;
};

export type PlatformTenantSubscriptionMasterProps = {
  ariaLabel?: string;
  className?: string;
  entitlements: readonly PlatformModuleEntitlement[];
  onChangeSubscriptionStatus?: (tenantId: string, status: PlatformSubscriptionStatus) => void;
  onRefresh?: () => void;
  onSelectTenant?: (tenantId: string) => void;
  onSetModuleEntitlement?: (tenantId: string, moduleKey: string, enabled: boolean) => void;
  selectedTenantId: string;
  sourceLabel?: string;
  statusLabel?: string;
  subscription?: PlatformSubscriptionSummary | null;
  tenants: readonly PlatformTenantSummary[];
  title?: string;
};

const subscriptionStatusContent: Record<
  PlatformSubscriptionStatus,
  { label: string; tone: FeedbackTone }
> = {
  ACTIVE: { label: "Aktif", tone: "success" },
  GRACE: { label: "Grace", tone: "warning" },
  SUSPENDED: { label: "Ditahan", tone: "danger" },
  TERMINATED: { label: "Berakhir", tone: "danger" },
  TRIAL: { label: "Trial", tone: "info" },
};

const tenantStatusContent: Record<PlatformTenantStatus, { label: string; tone: FeedbackTone }> = {
  ACTIVE: { label: "Tenant aktif", tone: "success" },
  INACTIVE: { label: "Tenant nonaktif", tone: "warning" },
};

const entitlementSourceContent: Record<
  PlatformEntitlementSource,
  { label: string; tone: FeedbackTone }
> = {
  CORE: { label: "Core", tone: "info" },
  DEPENDENCY: { label: "Dependency", tone: "warning" },
  NONE: { label: "Tidak aktif", tone: "danger" },
  OVERRIDE: { label: "Override", tone: "warning" },
  PLAN: { label: "Plan", tone: "success" },
};

const subscriptionStatusOptions: readonly PlatformSubscriptionStatus[] = [
  "TRIAL",
  "ACTIVE",
  "GRACE",
  "SUSPENDED",
  "TERMINATED",
];

const platformMasterSensitiveKeyPattern =
  /(?:tenantId|tenantInternalId|subscriptionId|moduleId|userId|ownerId|sessionId|requestId|paymentId|paymentToken|paymentPayload|billing|invoice|receipt|card|bank|phone|telepon|email|address|alamat|token|payload|permission|password|secret|audit|actor|timestamp|createdAt|updatedAt|raw|outletId|brandId|customer|order|hpp|cogs|cost|profit|margin|ledger|journal|webhook|attachment)/i;

const allowedActionProps = new Set([
  "onChangeSubscriptionStatus",
  "onRefresh",
  "onSelectTenant",
  "onSetModuleEntitlement",
]);
const allowedHiddenValueProps = new Set(["id", "key", "selectedTenantId"]);

function classes(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function assertText(value: string | undefined, fieldName: string) {
  if (value !== undefined && !value.trim()) {
    throw new TypeError(`${fieldName} harus berisi teks bila dikirim.`);
  }
}

function assertNoSensitiveProps(value: unknown, path = "Platform tenant subscription payload") {
  if (value === null || value === undefined || typeof value !== "object") return;

  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoSensitiveProps(item, `${path}[${index}]`));
    return;
  }

  for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
    if (/^on[A-Z]/.test(key) && !allowedActionProps.has(key)) {
      throw new TypeError(`${path} tidak menerima action prop di luar kontrak: ${key}.`);
    }
    if (!allowedHiddenValueProps.has(key) && platformMasterSensitiveKeyPattern.test(key)) {
      throw new TypeError(`${path} tidak boleh menerima data sensitif/out-of-scope: ${key}.`);
    }
    if (nestedValue && typeof nestedValue === "object") {
      assertNoSensitiveProps(nestedValue, `${path}.${key}`);
    }
  }
}

function assertUniqueHiddenValues(
  items: readonly { id?: string; key?: string; name: string }[],
  valueField: "id" | "key",
  fieldName: string,
) {
  const hiddenValues = new Set<string>();
  const labels = new Set<string>();

  for (const item of items) {
    const hiddenValue = item[valueField];
    if (!hiddenValue?.trim()) throw new TypeError(`${fieldName} memerlukan value tersembunyi.`);
    if (hiddenValues.has(hiddenValue)) {
      throw new TypeError(`${fieldName} tidak boleh memiliki value tersembunyi duplikat.`);
    }
    hiddenValues.add(hiddenValue);

    const label = item.name.trim().toLowerCase();
    if (!label) throw new TypeError(`${fieldName} memerlukan label tampilan.`);
    if (labels.has(label)) throw new TypeError(`${fieldName} tidak boleh memiliki label duplikat.`);
    labels.add(label);
  }
}

export function PlatformTenantSubscriptionMaster(props: PlatformTenantSubscriptionMasterProps) {
  assertNoSensitiveProps(props);
  assertUniqueHiddenValues(props.tenants, "id", "Tenant platform");
  assertUniqueHiddenValues(props.entitlements, "key", "Entitlement platform");

  const {
    ariaLabel = "Platform tenant subscription master",
    className,
    entitlements,
    onChangeSubscriptionStatus,
    onRefresh,
    onSelectTenant,
    onSetModuleEntitlement,
    selectedTenantId,
    sourceLabel,
    statusLabel,
    subscription,
    tenants,
    title = "Tenant dan subscription",
  } = props;

  assertText(ariaLabel, "Label Platform tenant subscription master");
  assertText(selectedTenantId, "Tenant terpilih Platform tenant subscription master");
  assertText(sourceLabel, "Sumber Platform tenant subscription master");
  assertText(statusLabel, "Status Platform tenant subscription master");
  assertText(title, "Judul Platform tenant subscription master");
  tenants.forEach((tenant) => {
    assertText(tenant.disabledReason, "Alasan tenant disabled Platform master");
    assertText(tenant.name, "Nama tenant Platform master");
  });
  entitlements.forEach((entitlement) => {
    assertText(entitlement.disabledReason, "Alasan entitlement disabled Platform master");
    assertText(entitlement.key, "Key entitlement Platform master");
    assertText(entitlement.name, "Nama entitlement Platform master");
    assertText(entitlement.reasonLabel, "Alasan entitlement Platform master");
    assertText(entitlement.sourceLabel, "Sumber entitlement Platform master");
  });
  if (subscription) {
    assertText(subscription.endsAtLabel, "Tanggal akhir subscription Platform master");
    assertText(subscription.graceEndsAtLabel, "Grace subscription Platform master");
    assertText(subscription.planLabel, "Plan subscription Platform master");
    assertText(subscription.startsAtLabel, "Tanggal mulai subscription Platform master");
  }

  const selectedTenant = tenants.find((tenant) => tenant.id === selectedTenantId);
  if (!selectedTenant) throw new TypeError("Tenant terpilih harus tersedia pada daftar tenant.");

  const enabledCount = entitlements.filter((entitlement) => entitlement.enabled).length;
  const canChangeSubscription = Boolean(subscription && onChangeSubscriptionStatus);
  const canToggleEntitlement = Boolean(onSetModuleEntitlement);

  return (
    <section
      aria-label={ariaLabel.trim()}
      className={classes("ui-platform-master", className)}
      data-platform-master
    >
      <header className="ui-platform-master__header">
        <span className="ui-platform-master__icon" aria-hidden="true">
          <AppIcon icon={Crown} size="lg" />
        </span>
        <div>
          <h2>{title.trim()}</h2>
          {sourceLabel ? <p>{sourceLabel.trim()}</p> : null}
        </div>
        <div className="ui-platform-master__header-actions">
          {statusLabel ? <Badge tone="info">{statusLabel.trim()}</Badge> : null}
          {onRefresh ? (
            <button aria-label="Refresh master platform" onClick={() => onRefresh()} type="button">
              <AppIcon icon={RefreshCw} size="sm" />
            </button>
          ) : null}
        </div>
      </header>

      <div className="ui-platform-master__layout">
        <aside aria-label="Daftar tenant platform" className="ui-platform-master-tenants">
          <header>
            <h3>Tenant</h3>
            <span>{tenants.length} tenant</span>
          </header>
          <div className="ui-platform-master-tenants__list">
            {tenants.map((tenant) => {
              const tenantStatus = tenantStatusContent[tenant.status];
              const subscriptionStatus = tenant.subscriptionStatus
                ? subscriptionStatusContent[tenant.subscriptionStatus]
                : undefined;
              const selected = tenant.id === selectedTenantId || tenant.selected === true;

              return (
                <button
                  aria-pressed={selected}
                  className={classes(
                    "ui-platform-master-tenant",
                    selected && "is-selected",
                    tenant.disabled && "is-disabled",
                  )}
                  disabled={tenant.disabled || !onSelectTenant}
                  key={tenant.id}
                  onClick={() => onSelectTenant?.(tenant.id)}
                  type="button"
                >
                  <span>
                    <AppIcon icon={Building2} size="sm" />
                  </span>
                  <strong>{tenant.name.trim()}</strong>
                  <Badge tone={tenantStatus.tone}>{tenantStatus.label}</Badge>
                  {subscriptionStatus ? (
                    <Badge tone={subscriptionStatus.tone}>{subscriptionStatus.label}</Badge>
                  ) : (
                    <small>Subscription belum tersedia</small>
                  )}
                  {tenant.disabled && tenant.disabledReason ? (
                    <small>{tenant.disabledReason.trim()}</small>
                  ) : null}
                </button>
              );
            })}
          </div>
        </aside>

        <div className="ui-platform-master__main">
          <section aria-label="Subscription tenant platform" className="ui-platform-subscription">
            <header>
              <div>
                <h3>Subscription</h3>
                <p>{subscription?.planLabel.trim() ?? "Belum ada plan aktif"}</p>
              </div>
              <Badge
                tone={
                  subscription ? subscriptionStatusContent[subscription.status].tone : "warning"
                }
              >
                {subscription ? subscriptionStatusContent[subscription.status].label : "Kosong"}
              </Badge>
            </header>

            {subscription ? (
              <dl className="ui-platform-subscription__facts">
                <div>
                  <dt>Mulai</dt>
                  <dd>{subscription.startsAtLabel.trim()}</dd>
                </div>
                {subscription.endsAtLabel ? (
                  <div>
                    <dt>Berakhir</dt>
                    <dd>{subscription.endsAtLabel.trim()}</dd>
                  </div>
                ) : null}
                {subscription.graceEndsAtLabel ? (
                  <div>
                    <dt>Grace</dt>
                    <dd>{subscription.graceEndsAtLabel.trim()}</dd>
                  </div>
                ) : null}
                <div>
                  <dt>Modul aktif</dt>
                  <dd>{enabledCount} modul</dd>
                </div>
              </dl>
            ) : (
              <p className="ui-platform-master__empty">Subscription tenant belum tersedia.</p>
            )}

            <SegmentedControl
              disabled={!canChangeSubscription}
              items={subscriptionStatusOptions.map((status) => ({
                label: subscriptionStatusContent[status].label,
                value: status,
              }))}
              label="Status subscription"
              onValueChange={(status) =>
                onChangeSubscriptionStatus?.(selectedTenantId, status as PlatformSubscriptionStatus)
              }
              size="sm"
              value={subscription?.status ?? "TRIAL"}
            />
          </section>

          <section aria-label="Entitlement module platform" className="ui-platform-entitlements">
            <header>
              <span aria-hidden="true">
                <AppIcon icon={ShieldCheck} size="sm" />
              </span>
              <div>
                <h3>Entitlement module</h3>
                <p>
                  {enabledCount} aktif dari {entitlements.length} modul
                </p>
              </div>
            </header>

            {entitlements.length > 0 ? (
              <ul>
                {entitlements.map((entitlement) => {
                  const source = entitlementSourceContent[entitlement.source];
                  const sourceLabel = entitlement.sourceLabel?.trim() || source.label;
                  const disabled = entitlement.disabled || !canToggleEntitlement;

                  return (
                    <li className="ui-platform-entitlement" key={entitlement.key}>
                      <div>
                        <h4>{entitlement.name.trim()}</h4>
                        <p>{entitlement.reasonLabel.trim()}</p>
                      </div>
                      <Badge tone={source.tone}>{sourceLabel}</Badge>
                      <Switch
                        checked={entitlement.enabled}
                        disabled={disabled}
                        label={entitlement.enabled ? "Aktif" : "Nonaktif"}
                        onChange={(event) =>
                          onSetModuleEntitlement?.(
                            selectedTenantId,
                            entitlement.key,
                            event.currentTarget.checked,
                          )
                        }
                        size="sm"
                      />
                      {entitlement.disabled && entitlement.disabledReason ? (
                        <small>{entitlement.disabledReason.trim()}</small>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="ui-platform-master__empty">Entitlement module belum tersedia.</p>
            )}
          </section>
        </div>
      </div>
    </section>
  );
}
