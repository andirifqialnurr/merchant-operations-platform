import type { Icon, IconProps } from "@tabler/icons-react";

export type AppIconSize = "xs" | "sm" | "md" | "lg" | "xl";

/** An icon from the design system's icon family (Tabler Icons). */
export type AppIconComponent = Icon;

export type AppIconProps = Omit<IconProps, "color" | "size" | "stroke"> & {
  icon: AppIconComponent;
  /** Names the icon for assistive technology. Omit for decorative icons. */
  label?: string;
  size?: AppIconSize;
};

const iconSizes: Record<AppIconSize, number> = {
  xs: 14,
  sm: 16,
  md: 20,
  lg: 24,
  xl: 32,
};

/**
 * The only place icons are rendered, so size, stroke, and color stay
 * consistent and the icon family can change without touching feature code.
 */
export function AppIcon({ className, icon: Icon, label, size = "md", ...props }: AppIconProps) {
  const accessibilityProps = label
    ? { "aria-label": label, role: "img" as const }
    : { "aria-hidden": true as const };

  return (
    <Icon
      {...props}
      {...accessibilityProps}
      className={className}
      color="currentColor"
      focusable="false"
      size={iconSizes[size]}
      stroke={1.75}
    />
  );
}
