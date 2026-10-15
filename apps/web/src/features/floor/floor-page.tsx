"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { IconStack2 } from "@tabler/icons-react";

import { PERMISSIONS } from "@merchant/contracts";
import { Button } from "@merchant/ui/button";
import { Panel } from "@merchant/ui/data-display";
import { ErrorState, Skeleton } from "@merchant/ui/feedback";
import { FloorSelector } from "@merchant/ui/floor-selector";
import { ModuleAccessState } from "@merchant/ui/module-access-state";
import { PageHeader } from "@merchant/ui/page";

import { useWorkspace } from "@/features/workspace";
import { RequestErrorState } from "@/shell/request-error-state";

import { useFloorMutation, useFloors } from "./api";
import { StructureSheet } from "./structure-sheet";

/** Tables: the floors of the current outlet and the areas on them. */
export function FloorPage() {
  const t = useTranslations("floor");
  const { can, outlet, workspace } = useWorkspace();

  if (!can(PERMISSIONS.tableLayoutManage)) {
    return (
      <ModuleAccessState
        description={t("accessDenied")}
        reason="permission-denied"
        title={t("accessDeniedTitle")}
      />
    );
  }
  if (!outlet) {
    return <ErrorState description={t("noOutlet")} title={t("accessDeniedTitle")} />;
  }
  const tenantId = workspace.tenant.id;
  return <OutletFloors key={`${tenantId}:${outlet.id}`} outletId={outlet.id} tenantId={tenantId} />;
}

function OutletFloors({ outletId, tenantId }: Readonly<{ outletId: string; tenantId: string }>) {
  const t = useTranslations("floor");
  const query = useFloors(tenantId, outletId, true);
  const mutation = useFloorMutation(tenantId, outletId);
  const [chosen, setChosen] = useState<string>();
  const [managing, setManaging] = useState(false);

  const floors = query.data?.floors ?? [];
  const active = floors.filter((floor) => floor.status === "ACTIVE");
  const current = active.find((floor) => floor.id === chosen) ?? active[0];

  return (
    <>
      <PageHeader
        secondaryActions={
          <Button
            disabled={!query.data}
            iconLeft={IconStack2}
            onClick={() => setManaging(true)}
            variant="secondary"
          >
            {t("structureTitle")}
          </Button>
        }
        title={t("title")}
      />
      {query.isPending ? (
        <div className="grid gap-2">
          <Skeleton variant="table-row" />
          <Skeleton variant="table-row" />
        </div>
      ) : query.isError ? (
        <RequestErrorState
          error={query.error}
          onRetry={() => void query.refetch()}
          title={t("loadFailed")}
        />
      ) : current ? (
        <div className="grid gap-4">
          <FloorSelector
            activeId={current.id}
            ariaLabel={t("chooseFloor")}
            emptyLabel={t("noFloor")}
            floors={active.map((floor) => ({ id: floor.id, label: floor.name }))}
            onValueChange={setChosen}
          />
          <Panel title={t("areas")}>
            <ul className="m-0 grid list-none px-4 py-0">
              {current.areas
                .filter((area) => area.status === "ACTIVE")
                .map((area) => (
                  <li
                    className="flex min-h-11 items-center border-b border-line-default last:border-b-0"
                    key={area.id}
                  >
                    {area.name}
                  </li>
                ))}
            </ul>
          </Panel>
        </div>
      ) : null}
      {managing && query.data ? (
        <StructureSheet
          floors={floors}
          mutation={mutation}
          onClose={() => setManaging(false)}
          outletId={outletId}
          tenantId={tenantId}
        />
      ) : null}
    </>
  );
}
