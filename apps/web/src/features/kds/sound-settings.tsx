"use client";

import { useTranslations } from "next-intl";
import { IconVolume, IconVolumeOff } from "@tabler/icons-react";

import { AppIcon } from "@merchant/ui/app-icon";
import { Button } from "@merchant/ui/button";
import { Popover } from "@merchant/ui/overlay";
import { SegmentedControl, Switch } from "@merchant/ui/selection-control";

import type { SoundSettings as Settings, SoundVolume } from "./alerts";

/** Mute and volume of this kitchen screen, behind one button in its toolbar. */
export function SoundSettings({
  onChange,
  onTest,
  settings,
}: Readonly<{
  onChange: (change: Partial<Settings>) => void;
  onTest: () => void;
  settings: Settings;
}>) {
  const t = useTranslations("kds.sound");
  return (
    <Popover
      align="end"
      content={
        <div className="grid w-64 gap-4">
          <Switch
            checked={!settings.muted}
            label={t("enabled")}
            onChange={(event) => onChange({ muted: !event.target.checked })}
          />
          <SegmentedControl
            disabled={settings.muted}
            items={[
              { label: t("volumeLow"), value: "low" },
              { label: t("volumeMedium"), value: "medium" },
              { label: t("volumeHigh"), value: "high" },
            ]}
            label={t("volume")}
            onValueChange={(value) => onChange({ volume: value as SoundVolume })}
            value={settings.volume}
          />
          <Button disabled={settings.muted} onClick={onTest} variant="secondary">
            {t("test")}
          </Button>
        </div>
      }
      label={t("settings")}
    >
      <span
        className="ui-button ui-icon-button ui-button--lg ui-button--outline"
        title={t("settings")}
      >
        <AppIcon icon={settings.muted ? IconVolumeOff : IconVolume} />
      </span>
    </Popover>
  );
}
