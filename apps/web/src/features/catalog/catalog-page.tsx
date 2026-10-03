"use client";

import { useTranslations } from "next-intl";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { IconPlus } from "@tabler/icons-react";

import { PERMISSIONS } from "@merchant/contracts";
import { Button } from "@merchant/ui/button";
import { ErrorState, Skeleton } from "@merchant/ui/feedback";
import { ModuleAccessState } from "@merchant/ui/module-access-state";
import { Tabs } from "@merchant/ui/navigation";
import { PageHeader } from "@merchant/ui/page";

import { useWorkspace } from "@/features/workspace";
import { RequestErrorState } from "@/shell/request-error-state";

import { useCatalog, useCatalogMutation, useOutletCatalog } from "./api";
import { CategoriesView } from "./categories-view";
import { ModifiersView } from "./modifiers-view";
import { OutletProductsView } from "./outlet-products-view";
import { ProductsView } from "./products-view";

const tabs = ["products", "categories", "modifiers"] as const;
type Tab = (typeof tabs)[number];
const addLabelKeys = {
  categories: "addCategory",
  modifiers: "addModifier",
  products: "addProduct",
} as const satisfies Record<Tab, string>;

function TableSkeleton() {
  return (
    <div className="grid gap-2">
      <Skeleton variant="table-row" />
      <Skeleton variant="table-row" />
      <Skeleton variant="table-row" />
    </div>
  );
}

export function CatalogPage() {
  const t = useTranslations("catalog");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { can, outlet, workspace } = useWorkspace();
  const tenantId = workspace.tenant.id;
  const canRead = can(PERMISSIONS.catalogRead);
  const canManage = can(PERMISSIONS.catalogManage);
  // The full catalog needs access to every outlet; others get their outlet's view.
  const fullCatalog = workspace.allOutlets;

  const master = useCatalog(tenantId, canRead && fullCatalog);
  const outletCatalog = useOutletCatalog(
    tenantId,
    canRead && !fullCatalog ? outlet?.id : undefined,
  );
  const mutation = useCatalogMutation(tenantId);

  const requestedTab = searchParams.get("tab");
  const tab: Tab = tabs.find((item) => item === requestedTab) ?? "products";
  const selectedId = searchParams.get("id") ?? undefined;

  // Tab and open row live in the URL so a view can be shared and survives reload.
  function navigate(next: { id?: string | undefined; tab?: Tab }) {
    const params = new URLSearchParams();
    const nextTab = next.tab ?? tab;
    if (nextTab !== "products") params.set("tab", nextTab);
    if (next.id) params.set("id", next.id);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }
  const select = (id: string | undefined) => navigate({ id });

  if (!canRead) {
    return (
      <ModuleAccessState
        description={t("accessDenied")}
        reason="permission-denied"
        title={t("accessDeniedTitle")}
      />
    );
  }

  const query = fullCatalog ? master : outletCatalog;
  const header = (
    <PageHeader
      {...(fullCatalog && canManage
        ? {
            primaryAction: (
              <Button iconLeft={IconPlus} onClick={() => select("new")}>
                {t(addLabelKeys[tab])}
              </Button>
            ),
          }
        : {})}
      {...(fullCatalog
        ? {
            tabs: (
              <Tabs
                items={[
                  { label: t("products"), value: "products" },
                  { label: t("category"), value: "categories" },
                  { label: t("modifiers"), value: "modifiers" },
                ]}
                label={t("tabs")}
                onValueChange={(value) => navigate({ tab: value as Tab })}
                value={tab}
              />
            ),
          }
        : {})}
      title={t("title")}
    />
  );

  if (!fullCatalog && !outlet) {
    return (
      <>
        {header}
        <ErrorState description={t("noOutlet")} title={t("accessDeniedTitle")} />
      </>
    );
  }

  if (query.isPending) {
    return (
      <>
        {header}
        <TableSkeleton />
      </>
    );
  }

  if (query.isError) {
    return (
      <>
        {header}
        <RequestErrorState
          error={query.error}
          onRetry={() => void query.refetch()}
          title={t("loadFailed")}
        />
      </>
    );
  }

  const shared = { canManage, mutation, onSelect: select, selectedId, tenantId };

  return (
    <>
      {header}
      {master.data && tab === "products" ? (
        <ProductsView {...shared} outlet={outlet} snapshot={master.data} />
      ) : null}
      {master.data && tab === "categories" ? (
        <CategoriesView {...shared} snapshot={master.data} />
      ) : null}
      {master.data && tab === "modifiers" ? (
        <ModifiersView {...shared} snapshot={master.data} />
      ) : null}
      {!fullCatalog && outletCatalog.data && outlet ? (
        <OutletProductsView {...shared} outletId={outlet.id} snapshot={outletCatalog.data} />
      ) : null}
    </>
  );
}
