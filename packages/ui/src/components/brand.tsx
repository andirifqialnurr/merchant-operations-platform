export type BrandMarkTone = "solid" | "mono";
export type BrandSize = "sm" | "md" | "lg";

export type BrandMarkProps = {
  className?: string;
  /** Accessible name. Leave empty when the product name is written next to the mark. */
  label?: string;
  size?: BrandSize;
  /** `solid` is the ink tile; `mono` draws an outline with currentColor, for print. */
  tone?: BrandMarkTone;
};

export type BrandProps = Omit<BrandMarkProps, "label"> & {
  name: string;
};

function classes(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function BrandMark({ className, label, size = "md", tone = "solid" }: BrandMarkProps) {
  return (
    <svg
      {...(label ? { "aria-label": label, role: "img" } : { "aria-hidden": true })}
      className={classes(
        "ui-brand-mark",
        `ui-brand-mark--${size}`,
        `ui-brand-mark--${tone}`,
        className,
      )}
      viewBox="0 0 24 24"
    >
      <rect
        className="ui-brand-mark__tile"
        height="22.5"
        rx="5.25"
        width="22.5"
        x="0.75"
        y="0.75"
      />
      <g className="ui-brand-mark__glyph">
        <path d="M6.5 7h8v4.25a4 4 0 0 1-8 0V7Z" />
        <path d="M14.5 8.25h1.25a1.75 1.75 0 0 1 0 3.5H14.5" />
        <path d="M6.5 17h8" />
      </g>
    </svg>
  );
}

export function Brand({ className, name, size = "md", tone = "solid" }: BrandProps) {
  return (
    <span className={classes("ui-brand", `ui-brand--${size}`, className)}>
      <BrandMark size={size} tone={tone} />
      <span className="ui-brand__name">{name}</span>
    </span>
  );
}
