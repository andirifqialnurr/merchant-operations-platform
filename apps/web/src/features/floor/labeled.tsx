import type { ReactNode } from "react";

/**
 * A visible name over a control that already carries the same name for
 * assistive technology (steppers, segmented choices), so it is not read twice.
 */
export function Labeled({ children, label }: Readonly<{ children: ReactNode; label: string }>) {
  return (
    <div className="grid gap-1.5">
      <span aria-hidden="true" className="text-label font-medium text-foreground">
        {label}
      </span>
      {children}
    </div>
  );
}
