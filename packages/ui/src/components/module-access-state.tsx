import type { ReactNode } from "react";
import {
  IconCircleArrowUp,
  IconCircleCheck,
  IconCircleDashed,
  IconCreditCardOff,
  IconListCheck,
  IconLoader2,
  IconLock,
  IconPlayerPause,
  IconShieldLock,
} from "@tabler/icons-react";

import { AppIcon, type AppIconComponent } from "./app-icon";

/**
 * Why a module or feature cannot be used right now (design-system.md 16.1).
 * Each reason keeps its own look and wording; they are never merged into one
 * "feature unavailable" message.
 */
export type ModuleAccessReason =
  /** The subscription does not include it. */
  | "not-entitled"
  /** It needs a higher tier of the module. */
  | "tier-required"
  /** It is being installed. */
  | "provisioning"
  /** It is installed but setup is not finished. */
  | "setup-required"
  /** It was suspended or its installation failed. */
  | "paused"
  /** The role, the location, or the membership does not allow it. Never an upsell. */
  | "permission-denied"
  /** The subscription cannot be used. */
  | "subscription-suspended";

export type ModuleAccessStep = { done: boolean; label: string };

export type ModuleAccessStateProps = {
  /** At most one action, the one that resolves this reason. */
  action?: ReactNode;
  description: ReactNode;
  reason: ModuleAccessReason;
  /** Setup checklist, for `setup-required`. */
  steps?: readonly ModuleAccessStep[];
  /** Accessible name of the checklist; required when `steps` is given. */
  stepsLabel?: string;
  title: string;
};

const iconByReason: Record<ModuleAccessReason, AppIconComponent> = {
  "not-entitled": IconLock,
  paused: IconPlayerPause,
  "permission-denied": IconShieldLock,
  provisioning: IconLoader2,
  "setup-required": IconListCheck,
  "subscription-suspended": IconCreditCardOff,
  "tier-required": IconCircleArrowUp,
};

export function ModuleAccessState({
  action,
  description,
  reason,
  steps,
  stepsLabel,
  title,
}: ModuleAccessStateProps) {
  return (
    <section
      aria-busy={reason === "provisioning" ? true : undefined}
      className={`ui-state ui-module-access ui-module-access--${reason}`}
      role="status"
    >
      <AppIcon icon={iconByReason[reason]} size="xl" />
      <h2>{title}</h2>
      <p>{description}</p>
      {steps && steps.length > 0 ? (
        <ul aria-label={stepsLabel} className="ui-module-access__steps">
          {steps.map((step) => (
            <li data-done={step.done ? "true" : "false"} key={step.label}>
              <AppIcon icon={step.done ? IconCircleCheck : IconCircleDashed} size="sm" />
              <span>{step.label}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {action}
    </section>
  );
}
