"use client";

import { useTranslations } from "next-intl";

import { Button } from "@merchant/ui/button";
import { ErrorState } from "@merchant/ui/feedback";
import { ModuleAccessState } from "@merchant/ui/module-access-state";

import { ApiClientError } from "@/lib/api-client";
import { useErrorMessage } from "@/lib/i18n";

import { accessReasonOf, canRetry } from "./access-reason";

/**
 * What a page shows when loading its data failed. A refusal by the API
 * (no permission, module not included, not set up, subscription suspended)
 * is shown as that specific access state; anything else is an error with a
 * way to try again.
 */
export function RequestErrorState({
  error,
  onRetry,
  title,
}: Readonly<{
  error: unknown;
  onRetry: () => void;
  /** Heading for an ordinary error, e.g. "The catalog could not be loaded". */
  title: string;
}>) {
  const t = useTranslations("access");
  const errorMessage = useErrorMessage();
  const reason = error instanceof ApiClientError ? accessReasonOf(error) : undefined;
  const retry = (
    <Button onClick={onRetry} variant="secondary">
      {t("retry")}
    </Button>
  );

  if (reason) {
    return (
      <ModuleAccessState
        {...(canRetry(reason) ? { action: retry } : {})}
        description={errorMessage(error)}
        reason={reason}
        title={t(`title.${reason}`)}
      />
    );
  }
  return <ErrorState action={retry} description={errorMessage(error)} title={title} />;
}
