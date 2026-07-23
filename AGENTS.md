# Repository agent instructions

## Checkpoint discipline

- Resume from `TODO.md` and recent Git history.
- Work on one independently pushable checkpoint at a time.
- Update `TODO.md` in the same checkpoint as the implementation.
- Do not start the next checkpoint before the active acceptance gate is complete and the user has pushed it.

## UI slicing data guard (mandatory)

Before writing JSX, make a field inventory and classify every datum as:

1. **User input** — a value the current user is allowed and expected to change in this action.
2. **Read-only display** — authoritative context or result supplied by the system.
3. **Derived display** — calculated information that is never submitted as user input.
4. **Hidden/out of scope** — unavailable, inapplicable, permission-restricted, sensitive, or not required by the product contract.

Apply these rules to every page and component:

- Render only data with a documented purpose and a clear semantic location.
- Give each fact one primary location. Do not repeat it unless the product contract explicitly requires repeated context.
- Never turn identifiers, timestamps, actors, status, audit metadata, totals, or calculated values into editable fields unless the workflow explicitly owns that mutation.
- Derived values are read-only and must not be included as user-entered payload fields.
- Omit inapplicable or unavailable rows. Do not invent fields, placeholder facts, or fake zero values.
- Treat an explicit field list as a hard contract; do not add “helpful” fields outside it.
- Apply role and permission rules before rendering sensitive operational or financial data.
- Place information in the nearest semantic area: shell, header/context, tabs, section, then form/table. Avoid nested cards when a divider or grouped rows is sufficient.
- Before completion, verify the field inventory, scan for duplicate labels/values, test conditional visibility, and review desktop/mobile plus light/dark rendering.
