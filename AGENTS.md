# Repository agent instructions

## Checkpoint discipline

- Resume from `TODO.md` and recent Git history.
- Work on one independently pushable checkpoint at a time.
- Update `TODO.md` in the same checkpoint as the implementation.
- By default, do not start the next checkpoint before the active acceptance gate is complete and the user has pushed it.
- If the user explicitly asks to continue through several tasks, work through multiple independently verifiable checkpoints in sequence within the same run.
- When working through multiple checkpoints by explicit instruction, keep each checkpoint bounded, update `TODO.md` after each completed checkpoint, and do not merge unrelated route reslicing/redesign work into the batch.
- If commit and push permission has been explicitly granted, commit and push each completed checkpoint to the current branch before continuing to the next checkpoint.
- Stop before any route reslicing/redesign checkpoint unless the user has explicitly confirmed that reslicing scope.

## Documentation source of truth

- Read `docs/README.md` before planning product, architecture, or UI work.
- Follow the source order defined there: `docs/product/*` owns product scope, capability tiers, package/limit policy, and release direction; `docs/foundation/*` owns technical architecture, visual/interaction contracts, module-to-screen mapping, and the current implementation audit.
- Treat `docs/product/CAFE-COMPANION-PRD-V2-MODULAR-PLATFORM.md` as the highest product-scope authority. Package names never override module capability, delivery status, or technical boundaries.
- `docs/foundation/design-system.md` is the visual and interaction source of truth. Do not use older Operational Teal/Geist implementation choices as justification when they conflict with the current Warm Operational/DM Sans/Fraunces contract.
- `docs/foundation/DESIGN_SYSTEM_APP_AUDIT.md` and `TODO.md` describe implementation progress; they may identify gaps but must not weaken product requirements.
- `apps/web/src/app/foundation/page.tsx` is a development preview route, not the documentation foundation.
- Do not recreate the superseded `docs/packages/`, `docs/versions/`, `docs/00-GLOBAL-PRODUCT-SCOPE.md`, or `docs/FEATURE_INVENTORY.md` structure unless a future checkpoint explicitly requires a historical archive or a new versioned contract.

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
