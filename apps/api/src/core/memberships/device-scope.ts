import type { Device, WorkspaceContext } from "@merchant/contracts";

/**
 * A session opened on a device works for that device's workspace and outlet
 * only (security.md 12). The workspace list shrinks to that one outlet, so
 * the cashier screen opens there and offers nothing else. A person who is not
 * assigned to the device's outlet gets no workspace at all.
 */
export function scopeWorkspacesToDevice(
  contexts: readonly WorkspaceContext[],
  device: Pick<Device, "outletId" | "workspaceId">,
): WorkspaceContext[] {
  return contexts
    .filter((context) => context.tenant.id === device.workspaceId)
    .map((context) => ({
      ...context,
      // On a device nobody acts for every outlet, whatever their role says elsewhere.
      allOutlets: false,
      outlets: context.outlets.filter((outlet) => outlet.id === device.outletId),
    }))
    .filter((context) => context.outlets.length > 0);
}
