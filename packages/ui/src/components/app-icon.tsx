import type { LucideIcon, LucideProps } from "lucide-react";

export type AppIconSize = "xs" | "sm" | "md" | "lg" | "xl";

export type AppIconProps = Omit<LucideProps, "color" | "size" | "strokeWidth"> & {
  icon: LucideIcon;
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
      strokeWidth={1.875}
    />
  );
}
