import type { ReactNode } from "react";

export type TableSessionFact = { label: string; value: ReactNode };

export type TableSessionPanelProps = {
  /** The actions that fit the table right now, the main one first. */
  actions?: ReactNode;
  /** What else belongs to the visit, such as its orders. */
  children?: ReactNode;
  className?: string;
  /** Short facts about the visit, each shown once. */
  facts: readonly TableSessionFact[];
  /** The status in words. */
  status: string;
  title: string;
  /** Keeps the title for assistive technology only, e.g. when a sheet already shows it. */
  titleHidden?: boolean;
};

function classes(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

/**
 * One table's visit: who is there, since when, and what can be done. It has
 * no words of its own and no frame: the page puts it in a side column or a
 * sheet.
 */
export function TableSessionPanel({
  actions,
  children,
  className,
  facts,
  status,
  title,
  titleHidden = false,
}: TableSessionPanelProps) {
  return (
    <section aria-label={title} className={classes("ui-table-session-panel", className)}>
      <header className="ui-table-session-panel__header">
        <h2
          className={classes(
            "ui-table-session-panel__title",
            titleHidden && "ui-table-session-panel__title--hidden",
          )}
        >
          {title}
        </h2>
        <span className="ui-table-session-panel__status">{status}</span>
      </header>
      {facts.length > 0 ? (
        <dl className="ui-table-session-panel__facts">
          {facts.map((fact) => (
            <div key={fact.label}>
              <dt>{fact.label}</dt>
              <dd>{fact.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {children}
      {actions ? <div className="ui-table-session-panel__actions">{actions}</div> : null}
    </section>
  );
}
