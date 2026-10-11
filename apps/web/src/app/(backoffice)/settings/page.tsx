"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { Skeleton } from "@merchant/ui/feedback";
import { ModuleAccessState } from "@merchant/ui/module-access-state";

import { useWorkspace } from "@/features/workspace";
import { arrangeNavigation, isSettingsPath, useModuleNavigation } from "@/shell/module-navigation";
import { RequestErrorState } from "@/shell/request-error-state";

/** "/settings" has no page of its own: it opens the first settings page this person may see. */
export default function SettingsRoute() {
  const t = useTranslations("shell");
  const router = useRouter();
  const { workspace } = useWorkspace();
  const entries = useModuleNavigation(workspace.tenant.id);
  const first = arrangeNavigation(entries.data?.entries ?? [], workspace.allOutlets).find((entry) =>
    isSettingsPath(entry.path),
  )?.path;

  useEffect(() => {
    if (first) router.replace(first);
  }, [first, router]);

  if (entries.isError) {
    return (
      <RequestErrorState
        error={entries.error}
        onRetry={() => void entries.refetch()}
        title={t("settingsLoadFailed")}
      />
    );
  }
  if (entries.isPending || first) return <Skeleton variant="table-row" />;
  return (
    <ModuleAccessState
      description={t("settingsNoAccess")}
      reason="permission-denied"
      title={t("settingsNoAccessTitle")}
    />
  );
}
