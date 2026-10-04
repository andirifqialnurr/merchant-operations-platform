"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { IconPlus } from "@tabler/icons-react";

import {
  PERMISSIONS,
  WORKSPACE_CURRENCIES,
  workspaceCurrencySchema,
  type Brand,
  type OrganizationSnapshot,
  type Outlet,
  type Tenant,
} from "@merchant/contracts";
import { Button } from "@merchant/ui/button";
import { DataTable, Panel } from "@merchant/ui/data-display";
import { Badge, EmptyState, Skeleton } from "@merchant/ui/feedback";
import { FormField, Input, Textarea } from "@merchant/ui/form-field";
import { ModuleAccessState } from "@merchant/ui/module-access-state";
import { Tabs } from "@merchant/ui/navigation";
import { AlertDialog, Sheet } from "@merchant/ui/overlay";
import { PageHeader } from "@merchant/ui/page";
import { Select } from "@merchant/ui/select";

import { useWorkspace } from "@/features/workspace";
import { ApiClientError, merchantApi } from "@/lib/api-client";
import { isLimitReached, LimitReachedState } from "@/shell/limit-reached-state";
import { RequestErrorState } from "@/shell/request-error-state";

import {
  organizationKey,
  useOrganization,
  useOrganizationMutation,
  type OrganizationMutation,
} from "./api";
import { OUTLET_TIME_ZONES, outletCodeFromName, slugFromName } from "./organization-codes";

type View = "brands" | "business" | "outlets";

function BusinessForm({
  canManage,
  currencyChange,
  mutation,
  tenant,
}: Readonly<{
  canManage: boolean;
  /** Decided by the server; it is checked again when the change is saved. */
  currencyChange: OrganizationSnapshot["currencyChange"];
  mutation: OrganizationMutation;
  tenant: Tenant;
}>) {
  const t = useTranslations("organization");
  const locale = useLocale();
  const queryClient = useQueryClient();
  const [name, setName] = useState(tenant.name);
  const [currency, setCurrency] = useState(tenant.currency);
  const [error, setError] = useState<string>();
  const [confirming, setConfirming] = useState(false);
  // The choice is offered only until the business records its first amount.
  const canChoose = canManage && currencyChange.allowed;
  const currencyLabel = (code: string) => {
    const known = t.has(`currencyName.${code}` as never)
      ? t(`currencyName.${code}` as never)
      : new Intl.DisplayNames(locale, { type: "currency" }).of(code);
    return known ? `${known} (${code})` : code;
  };

  function save(withCurrency: boolean) {
    mutation.mutate(
      {
        action: () =>
          merchantApi.updateTenant(tenant.id, {
            name: name.trim(),
            ...(withCurrency ? { currency: workspaceCurrencySchema.parse(currency) } : {}),
          }),
        success: t("saved"),
      },
      {
        // Somebody recorded a first amount meanwhile: show the currency as locked.
        // What was typed stays in the form.
        onError: (failure) => {
          if (failure instanceof ApiClientError && failure.code === "CURRENCY_LOCKED") {
            setCurrency(tenant.currency);
            void queryClient.invalidateQueries({ queryKey: organizationKey(tenant.id) });
          }
        },
      },
    );
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (name.trim().length < 2) {
      setError(t("nameRequired"));
      return;
    }
    if (canChoose && currency !== tenant.currency) setConfirming(true);
    else save(false);
  }

  return (
    <Panel>
      <form className="grid max-w-xl gap-4 p-4" noValidate onSubmit={submit}>
        <FormField {...(error ? { error } : {})} htmlFor="business-name" label={t("businessName")}>
          <Input
            id="business-name"
            maxLength={160}
            onChange={(event) => {
              setName(event.target.value);
              setError(undefined);
            }}
            readOnly={!canManage}
            value={name}
          />
        </FormField>
        {canChoose ? (
          <div className="grid grid-cols-[minmax(0,1fr)] gap-1.5">
            <span className="text-label">{t("currency")}</span>
            <Select
              emptyLabel={t("currency")}
              label={t("currency")}
              onValueChange={setCurrency}
              options={WORKSPACE_CURRENCIES.map((code) => ({
                label: currencyLabel(code),
                value: code,
              }))}
              placeholder={t("currency")}
              value={currency}
            />
            <p className="m-0 text-caption text-foreground-secondary">{t("currencyHint")}</p>
          </div>
        ) : (
          <dl className="m-0 grid gap-1">
            <dt className="text-label text-foreground-secondary">{t("currency")}</dt>
            <dd className="m-0 text-body">{currencyLabel(tenant.currency)}</dd>
            {canManage && currencyChange.reason ? (
              <dd className="m-0 text-caption text-foreground-secondary">
                {t(`currencyLocked.${currencyChange.reason}`)}
              </dd>
            ) : null}
          </dl>
        )}
        {canManage ? (
          <div className="pt-2">
            <Button loading={mutation.isPending} loadingLabel={t("saving")} type="submit">
              {t("save")}
            </Button>
          </div>
        ) : null}
      </form>
      <AlertDialog
        cancelLabel={t("cancel")}
        closeLabel={t("closeSheet")}
        confirmLabel={t("currencyConfirm")}
        onConfirm={() => save(true)}
        onOpenChange={setConfirming}
        open={confirming}
        title={t("currencyConfirmTitle", { currency: currencyLabel(currency) })}
      >
        {t("currencyConfirmDescription")}
      </AlertDialog>
    </Panel>
  );
}

/** Deactivate (after a confirmation) or activate again, next to the save button. */
function StatusAction({
  active,
  blockedReason,
  busy,
  onActivate,
  onDeactivate,
}: Readonly<{
  active: boolean;
  /** Why this cannot be deactivated now; shown beside the disabled action. */
  blockedReason: string | undefined;
  busy: boolean;
  onActivate: () => void;
  onDeactivate: () => void;
}>) {
  const t = useTranslations("organization");
  return (
    <Button
      disabled={busy || (active && Boolean(blockedReason))}
      onClick={active ? onDeactivate : onActivate}
      variant="secondary"
    >
      {active ? t("deactivate") : t("activate")}
    </Button>
  );
}

function BrandSheet({
  activeOutlets,
  brand,
  canManage,
  mutation,
  onClose,
  tenantId,
}: Readonly<{
  /** Active outlets under this brand; a brand with any cannot be deactivated. */
  activeOutlets: number;
  /** Undefined while a new brand is being made. */
  brand: Brand | undefined;
  canManage: boolean;
  mutation: OrganizationMutation;
  onClose: () => void;
  tenantId: string;
}>) {
  const t = useTranslations("organization");
  const [name, setName] = useState(brand?.name ?? "");
  const [error, setError] = useState<string>();
  const [limitError, setLimitError] = useState<ApiClientError>();
  const [confirming, setConfirming] = useState(false);
  const busy = mutation.isPending;
  const blockedReason = activeOutlets > 0 ? t("brandHasOutlets") : undefined;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (name.trim().length < 2 || (!brand && slugFromName(name).length < 2)) {
      setError(t("nameRequired"));
      return;
    }
    mutation.mutate(
      brand
        ? {
            action: () => merchantApi.updateBrand(tenantId, brand.id, { name: name.trim() }),
            success: t("saved"),
          }
        : {
            action: () =>
              merchantApi.createBrand(tenantId, { name: name.trim(), slug: slugFromName(name) }),
            success: t("brandCreated"),
          },
      {
        onError: (failure) => setLimitError(isLimitReached(failure) ? failure : undefined),
        onSuccess: onClose,
      },
    );
  }

  return (
    <>
      <Sheet
        closeLabel={t("closeSheet")}
        footer={
          canManage && !limitError ? (
            <>
              {brand ? (
                <StatusAction
                  active={brand.status === "ACTIVE"}
                  blockedReason={blockedReason}
                  busy={busy}
                  onActivate={() =>
                    mutation.mutate(
                      {
                        action: () =>
                          merchantApi.updateBrand(tenantId, brand.id, { status: "ACTIVE" }),
                        success: t("activated"),
                      },
                      {
                        onError: (failure) =>
                          setLimitError(isLimitReached(failure) ? failure : undefined),
                        onSuccess: onClose,
                      },
                    )
                  }
                  onDeactivate={() => setConfirming(true)}
                />
              ) : null}
              <Button form="brand-form" loading={busy} loadingLabel={t("saving")} type="submit">
                {t("save")}
              </Button>
            </>
          ) : undefined
        }
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
        open
        title={brand ? brand.name : t("newBrand")}
      >
        {limitError ? (
          <LimitReachedState error={limitError} />
        ) : (
          <form className="grid gap-6" id="brand-form" noValidate onSubmit={submit}>
            <FormField {...(error ? { error } : {})} htmlFor="brand-name" label={t("brandName")}>
              <Input
                id="brand-name"
                maxLength={160}
                onChange={(event) => {
                  setName(event.target.value);
                  setError(undefined);
                }}
                readOnly={!canManage}
                value={name}
              />
            </FormField>
            {canManage && brand?.status === "ACTIVE" && blockedReason ? (
              <p className="m-0 text-label text-foreground-secondary">{blockedReason}</p>
            ) : null}
          </form>
        )}
      </Sheet>
      {brand ? (
        <AlertDialog
          cancelLabel={t("cancel")}
          closeLabel={t("closeSheet")}
          confirmLabel={t("deactivate")}
          onConfirm={() =>
            mutation.mutate(
              {
                action: () => merchantApi.updateBrand(tenantId, brand.id, { status: "INACTIVE" }),
                success: t("deactivated"),
              },
              { onSuccess: onClose },
            )
          }
          onOpenChange={setConfirming}
          open={confirming}
          title={t("deactivateTitle", { name: brand.name })}
        >
          {t("deactivateBrandDescription")}
        </AlertDialog>
      ) : null}
    </>
  );
}

function OutletSheet({
  brands,
  canManage,
  mutation,
  onClose,
  outlet,
  tenantId,
}: Readonly<{
  brands: readonly Brand[];
  canManage: boolean;
  mutation: OrganizationMutation;
  onClose: () => void;
  /** Undefined while a new outlet is being made. */
  outlet: Outlet | undefined;
  tenantId: string;
}>) {
  const t = useTranslations("organization");
  const activeBrands = brands.filter(
    (brand) => brand.status === "ACTIVE" || brand.id === outlet?.brandId,
  );
  const [name, setName] = useState(outlet?.name ?? "");
  const [brandId, setBrandId] = useState(
    outlet?.brandId ?? (activeBrands.length === 1 ? activeBrands[0]?.id : undefined),
  );
  const [address, setAddress] = useState(outlet?.address ?? "");
  const [timezone, setTimezone] = useState<string>(outlet?.timezone ?? OUTLET_TIME_ZONES[0]);
  const [errors, setErrors] = useState<{ address?: string; brand?: string; name?: string }>({});
  const [limitError, setLimitError] = useState<ApiClientError>();
  const [confirming, setConfirming] = useState(false);
  const busy = mutation.isPending;
  const zones = OUTLET_TIME_ZONES.some((zone) => zone === timezone)
    ? OUTLET_TIME_ZONES
    : [...OUTLET_TIME_ZONES, timezone];

  function clear(field: keyof typeof errors) {
    setErrors((current) => {
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const place = address.trim();
    const next = {
      ...(name.trim().length < 2 || (!outlet && outletCodeFromName(name).length < 2)
        ? { name: t("nameRequired") }
        : {}),
      ...(brandId ? {} : { brand: t("brandRequired") }),
      ...(place.length > 0 && place.length < 3 ? { address: t("addressTooShort") } : {}),
    };
    setErrors(next);
    if (Object.keys(next).length > 0 || !brandId) return;
    mutation.mutate(
      outlet
        ? {
            action: () =>
              merchantApi.updateOutlet(tenantId, outlet.id, {
                address: place || null,
                ...(brandId !== outlet.brandId ? { brandId } : {}),
                name: name.trim(),
                timezone,
              }),
            success: t("saved"),
          }
        : {
            action: () =>
              merchantApi.createOutlet(tenantId, {
                ...(place ? { address: place } : {}),
                brandId,
                code: outletCodeFromName(name),
                name: name.trim(),
                timezone,
              }),
            success: t("outletCreated"),
          },
      {
        onError: (failure) => setLimitError(isLimitReached(failure) ? failure : undefined),
        onSuccess: onClose,
      },
    );
  }

  return (
    <>
      <Sheet
        closeLabel={t("closeSheet")}
        footer={
          canManage && !limitError ? (
            <>
              {outlet ? (
                <StatusAction
                  active={outlet.status === "ACTIVE"}
                  blockedReason={undefined}
                  busy={busy}
                  onActivate={() =>
                    mutation.mutate(
                      {
                        action: () =>
                          merchantApi.updateOutlet(tenantId, outlet.id, { status: "ACTIVE" }),
                        success: t("activated"),
                      },
                      {
                        onError: (failure) =>
                          setLimitError(isLimitReached(failure) ? failure : undefined),
                        onSuccess: onClose,
                      },
                    )
                  }
                  onDeactivate={() => setConfirming(true)}
                />
              ) : null}
              <Button form="outlet-form" loading={busy} loadingLabel={t("saving")} type="submit">
                {t("save")}
              </Button>
            </>
          ) : undefined
        }
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
        open
        title={outlet ? outlet.name : t("newOutlet")}
      >
        {limitError ? (
          <LimitReachedState error={limitError} />
        ) : (
          <form
            className="grid grid-cols-[minmax(0,1fr)] gap-6"
            id="outlet-form"
            noValidate
            onSubmit={submit}
          >
            <FormField
              {...(errors.name ? { error: errors.name } : {})}
              htmlFor="outlet-name"
              label={t("outletName")}
            >
              <Input
                id="outlet-name"
                maxLength={160}
                onChange={(event) => {
                  setName(event.target.value);
                  clear("name");
                }}
                readOnly={!canManage}
                value={name}
              />
            </FormField>
            <div className="grid grid-cols-[minmax(0,1fr)] gap-1.5">
              <span className="text-label">{t("brand")}</span>
              <Select
                {...(errors.brand ? { error: errors.brand } : {})}
                {...(brandId ? { value: brandId } : {})}
                disabled={!canManage}
                emptyLabel={t("noBrands")}
                label={t("brand")}
                onValueChange={(value) => {
                  setBrandId(value);
                  clear("brand");
                }}
                options={activeBrands.map((brand) => ({ label: brand.name, value: brand.id }))}
                placeholder={t("selectBrand")}
              />
            </div>
            <FormField
              {...(errors.address ? { error: errors.address } : {})}
              htmlFor="outlet-address"
              label={t("address")}
              optionalLabel={t("optional")}
            >
              <Textarea
                id="outlet-address"
                maxLength={500}
                onChange={(event) => {
                  setAddress(event.target.value);
                  clear("address");
                }}
                readOnly={!canManage}
                rows={3}
                value={address}
              />
            </FormField>
            <div className="grid grid-cols-[minmax(0,1fr)] gap-1.5">
              <span className="text-label">{t("timeZone")}</span>
              <Select
                disabled={!canManage}
                emptyLabel={t("timeZone")}
                label={t("timeZone")}
                onValueChange={setTimezone}
                options={zones.map((zone) => ({
                  label: t.has(`timeZoneName.${zone}` as never)
                    ? t(`timeZoneName.${zone}` as never)
                    : zone,
                  value: zone,
                }))}
                placeholder={t("timeZone")}
                value={timezone}
              />
            </div>
          </form>
        )}
      </Sheet>
      {outlet ? (
        <AlertDialog
          cancelLabel={t("cancel")}
          closeLabel={t("closeSheet")}
          confirmLabel={t("deactivate")}
          onConfirm={() =>
            mutation.mutate(
              {
                action: () => merchantApi.updateOutlet(tenantId, outlet.id, { status: "INACTIVE" }),
                success: t("deactivated"),
              },
              { onSuccess: onClose },
            )
          }
          onOpenChange={setConfirming}
          open={confirming}
          title={t("deactivateTitle", { name: outlet.name })}
        >
          {t("deactivateOutletDescription")}
        </AlertDialog>
      ) : null}
    </>
  );
}

export function OrganizationPage() {
  const t = useTranslations("organization");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { can, workspace } = useWorkspace();
  const tenantId = workspace.tenant.id;
  // The structure of the business belongs to the whole business, not to one outlet.
  const canRead = can(PERMISSIONS.organizationRead) && workspace.allOutlets;
  const canManage = canRead && can(PERMISSIONS.organizationManage);
  const query = useOrganization(tenantId, canRead);
  const mutation = useOrganizationMutation(tenantId);
  const requestedTab = searchParams.get("tab");
  const view: View =
    requestedTab === "brands" || requestedTab === "outlets" ? requestedTab : "business";
  const open = searchParams.get("id") ?? undefined;

  function navigate(nextView: View, id?: string) {
    const params = new URLSearchParams();
    if (nextView !== "business") params.set("tab", nextView);
    if (id) params.set("id", id);
    const queryString = params.toString();
    router.replace(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false });
  }
  const setOpen = (id: string | undefined) => navigate(view, id);

  if (!canRead) {
    return (
      <ModuleAccessState
        description={t("accessDenied")}
        reason="permission-denied"
        title={t("accessDeniedTitle")}
      />
    );
  }

  const brands = query.data?.brands ?? [];
  const outlets = query.data?.outlets ?? [];
  const brandName = (id: string) => brands.find((brand) => brand.id === id)?.name ?? "";
  const activeOutletsOf = (id: string) =>
    outlets.filter((outlet) => outlet.brandId === id && outlet.status === "ACTIVE").length;
  const brand = brands.find((item) => item.id === open);
  const outlet = outlets.find((item) => item.id === open);
  const status = (value: "ACTIVE" | "INACTIVE") => (
    <Badge key="status" tone={value === "ACTIVE" ? "success" : "neutral"}>
      {t(`statusName.${value}`)}
    </Badge>
  );

  return (
    <>
      <PageHeader
        {...(canManage && view !== "business"
          ? {
              primaryAction: (
                <Button iconLeft={IconPlus} onClick={() => setOpen("new")}>
                  {view === "brands" ? t("createBrand") : t("createOutlet")}
                </Button>
              ),
            }
          : {})}
        tabs={
          <Tabs
            items={[
              { label: t("viewBusiness"), value: "business" },
              { label: t("viewBrands"), value: "brands" },
              { label: t("viewOutlets"), value: "outlets" },
            ]}
            label={t("views")}
            onValueChange={(value) => {
              navigate(value === "brands" || value === "outlets" ? value : "business");
            }}
            value={view}
          />
        }
        title={t("title")}
      />
      {query.isPending ? (
        <div className="grid gap-2">
          <Skeleton variant="table-row" />
          <Skeleton variant="table-row" />
          <Skeleton variant="table-row" />
        </div>
      ) : query.isError ? (
        <RequestErrorState
          error={query.error}
          onRetry={() => void query.refetch()}
          title={t("loadFailed")}
        />
      ) : view === "business" ? (
        <BusinessForm
          canManage={canManage}
          currencyChange={query.data.currencyChange}
          key={`${tenantId}:${query.data.tenant.updatedAt}`}
          mutation={mutation}
          tenant={query.data.tenant}
        />
      ) : view === "brands" ? (
        <Panel>
          <DataTable
            caption={t("viewBrands")}
            columns={[
              t("brand"),
              { align: "end", label: t("outletCount"), priority: 2 },
              t("status"),
            ]}
            empty={<EmptyState description={t("emptyBrands")} title={t("viewBrands")} />}
            onRowSelect={(index: number) => setOpen(brands[index]?.id)}
            rows={brands.map((item) => [
              item.name,
              String(activeOutletsOf(item.id)),
              status(item.status),
            ])}
          />
        </Panel>
      ) : (
        <Panel>
          <DataTable
            caption={t("viewOutlets")}
            columns={[
              t("outlet"),
              { label: t("brand"), priority: 2 },
              { label: t("timeZone"), priority: 2 },
              t("status"),
            ]}
            empty={<EmptyState description={t("emptyOutlets")} title={t("viewOutlets")} />}
            onRowSelect={(index: number) => setOpen(outlets[index]?.id)}
            rows={outlets.map((item) => [
              item.name,
              brandName(item.brandId),
              t.has(`timeZoneShort.${item.timezone}` as never)
                ? t(`timeZoneShort.${item.timezone}` as never)
                : item.timezone,
              status(item.status),
            ])}
          />
        </Panel>
      )}
      {view === "brands" && (brand || (open === "new" && canManage)) ? (
        <BrandSheet
          activeOutlets={brand ? activeOutletsOf(brand.id) : 0}
          brand={brand}
          canManage={canManage}
          key={`${tenantId}:${brand?.id ?? "new"}`}
          mutation={mutation}
          onClose={() => setOpen(undefined)}
          tenantId={tenantId}
        />
      ) : null}
      {view === "outlets" && (outlet || (open === "new" && canManage)) ? (
        <OutletSheet
          brands={brands}
          canManage={canManage}
          key={`${tenantId}:${outlet?.id ?? "new"}`}
          mutation={mutation}
          onClose={() => setOpen(undefined)}
          outlet={outlet}
          tenantId={tenantId}
        />
      ) : null}
    </>
  );
}
