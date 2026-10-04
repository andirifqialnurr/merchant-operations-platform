import type { ReactNode } from "react";
import {
  IconCloudCheck,
  IconHistory,
  IconLoader2,
  IconRefresh,
  IconWifiOff,
} from "@tabler/icons-react";

import { AppIcon, type AppIconComponent } from "./app-icon";
import { Badge, type FeedbackTone } from "./feedback";

/**
 * A registered device: waiting for its activation code, in use, or revoked.
 * The badge takes the status and nothing else; the words come from the caller.
 */
export type DeviceStatus = "ACTIVE" | "PENDING" | "REVOKED";

const toneByDeviceStatus: Record<DeviceStatus, FeedbackTone> = {
  ACTIVE: "success",
  PENDING: "warning",
  REVOKED: "neutral",
};

export type DeviceStatusBadgeProps = {
  /** The status in words, e.g. "Aktif". */
  label: string;
  status: DeviceStatus;
};

export function DeviceStatusBadge({ label, status }: DeviceStatusBadgeProps) {
  return (
    <Badge data-status={status} tone={toneByDeviceStatus[status]}>
      {label}
    </Badge>
  );
}

/**
 * What the device knows about its link to the server.
 * - `online`: connected and up to date.
 * - `syncing`: connected, sending or fetching.
 * - `reconnecting`: the link dropped and is being restored.
 * - `offline`: no link; actions that need the server wait.
 */
export type NetworkSyncState = "offline" | "online" | "reconnecting" | "syncing";

const networkContent: Record<
  NetworkSyncState,
  { icon: AppIconComponent; spin?: boolean; tone: FeedbackTone }
> = {
  offline: { icon: IconWifiOff, tone: "offline" },
  online: { icon: IconCloudCheck, tone: "success" },
  reconnecting: { icon: IconLoader2, spin: true, tone: "warning" },
  syncing: { icon: IconRefresh, spin: true, tone: "info" },
};

export type NetworkSyncIndicatorProps = {
  /**
   * Icon only, for a narrow top bar. The words stay available to screen
   * readers and as a tooltip.
   */
  compact?: boolean;
  /** The state in words, e.g. "Offline". */
  label: string;
  state: NetworkSyncState;
};

/** A small, always-visible sign of the connection, for the top bar of POS and KDS. */
export function NetworkSyncIndicator({ compact = false, label, state }: NetworkSyncIndicatorProps) {
  const { icon, spin, tone } = networkContent[state];
  return (
    <span className="ui-network-sync" data-state={state} role="status">
      <Badge size="md" title={label} tone={tone}>
        <span
          className={
            spin ? "ui-network-sync__icon ui-network-sync__icon--spin" : "ui-network-sync__icon"
          }
        >
          <AppIcon icon={icon} size="sm" />
        </span>
        <span className={compact ? "ui-visually-hidden" : undefined}>{label}</span>
      </Badge>
    </span>
  );
}

export type StaleDataBannerProps = {
  /** At most one action, usually "refresh". */
  action?: ReactNode;
  /** Why the screen may be out of date, in one sentence. */
  children: ReactNode;
  /** When the data on screen was last fetched, e.g. "Terakhir diperbarui 10.42". */
  lastUpdatedLabel?: string;
};

/**
 * Says that what is on screen may be older than what the server has. It stays
 * for as long as that is true: there is nothing to dismiss.
 */
export function StaleDataBanner({ action, children, lastUpdatedLabel }: StaleDataBannerProps) {
  return (
    <div className="ui-stale-data" role="status">
      <AppIcon icon={IconHistory} size="sm" />
      <p>
        <span>{children}</span>
        {lastUpdatedLabel ? <span className="ui-stale-data__time">{lastUpdatedLabel}</span> : null}
      </p>
      {action}
    </div>
  );
}
