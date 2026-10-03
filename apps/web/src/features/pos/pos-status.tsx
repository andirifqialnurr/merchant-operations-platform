"use client";

import { useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { IconClock, IconWifiOff } from "@tabler/icons-react";

import { PERMISSIONS } from "@merchant/contracts";
import { AppIcon } from "@merchant/ui/app-icon";
import { Badge } from "@merchant/ui/badge";

import { useWorkspace } from "@/features/workspace";

import { useCurrentShift } from "./api";

function subscribeToConnection(notify: () => void) {
  window.addEventListener("online", notify);
  window.addEventListener("offline", notify);
  return () => {
    window.removeEventListener("online", notify);
    window.removeEventListener("offline", notify);
  };
}

function useOnline() {
  return useSyncExternalStore(
    subscribeToConnection,
    () => navigator.onLine,
    () => true,
  );
}

/**
 * Top bar status for the cashier: whether a shift is open at this outlet and
 * whether the device is offline. Shift details stay on the shift page. Phones
 * keep the width for the outlet: the shift badge is dropped there (the sell
 * page already asks for a shift) and the offline badge shrinks to its icon.
 */
export function PosStatus() {
  const t = useTranslations("shell");
  const { can, outlet, workspace } = useWorkspace();
  const online = useOnline();
  const canSeeShift = can(PERMISSIONS.orderCreate) || can(PERMISSIONS.shiftOpen);
  const shift = useCurrentShift(workspace.tenant.id, outlet?.id, canSeeShift);
  const open = shift.data ? Boolean(shift.data.session) : undefined;

  return (
    <div className="flex shrink-0 items-center gap-2" role="status">
      {online ? null : (
        <Badge size="md" title={t("offline")} tone="offline">
          <AppIcon icon={IconWifiOff} size="sm" />
          <span className="max-md:sr-only">{t("offline")}</span>
        </Badge>
      )}
      {open === undefined ? null : (
        <span className="max-sm:hidden">
          <Badge
            size="md"
            title={open ? t("shiftOpen") : t("shiftClosed")}
            tone={open ? "success" : "warning"}
          >
            <AppIcon icon={IconClock} size="sm" />
            <span className="max-md:sr-only">{open ? t("shiftOpen") : t("shiftClosed")}</span>
          </Badge>
        </span>
      )}
    </div>
  );
}
