import * as z from "zod";

import { uniqueIds } from "./internal.ts";
import { organizationNameSchema } from "./organization.ts";

/**
 * PENDING: sent, waiting for the person to accept.
 * ACCEPTED: the person joined the workspace.
 * REVOKED: withdrawn by someone in the workspace.
 * EXPIRED: not accepted in time; a new one has to be sent.
 */
export const invitationStatusSchema = z.enum(["ACCEPTED", "EXPIRED", "PENDING", "REVOKED"]);

export const invitationEmailSchema = z.string().trim().toLowerCase().pipe(z.email().max(254));

/** The secret in the link of an invitation. Never stored or listed by the server. */
export const invitationTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);

export const createInvitationSchema = z
  .object({
    allOutlets: z.boolean().default(false),
    email: invitationEmailSchema,
    outletIds: z.array(z.uuid()).default([]).refine(uniqueIds, {
      message: "Outlet must not repeat.",
    }),
    roleIds: z.array(z.uuid()).min(1).refine(uniqueIds, { message: "Role must not repeat." }),
  })
  .refine((value) => !value.allOutlets || value.outletIds.length === 0, {
    message: "outletIds must be empty when allOutlets is set.",
    path: ["outletIds"],
  })
  .refine((value) => value.allOutlets || value.outletIds.length > 0, {
    message: "Choose at least one outlet, or all outlets.",
    path: ["outletIds"],
  });

export const invitationSchema = z.object({
  acceptedAt: z.iso.datetime().nullable(),
  allOutlets: z.boolean(),
  createdAt: z.iso.datetime(),
  email: invitationEmailSchema,
  expiresAt: z.iso.datetime(),
  id: z.uuid(),
  outletIds: z.array(z.uuid()),
  revokedAt: z.iso.datetime().nullable(),
  roleIds: z.array(z.uuid()),
  status: invitationStatusSchema,
  workspaceId: z.uuid(),
});

export const invitationListSchema = z.object({ invitations: z.array(invitationSchema) });

export const invitationTokenRequestSchema = z.object({ token: invitationTokenSchema });

/** What the invited person sees before accepting. */
export const invitationPreviewSchema = z.object({
  /** True when the email already has an account; then no name or password is asked. */
  accountExists: z.boolean(),
  email: invitationEmailSchema,
  expiresAt: z.iso.datetime(),
  workspaceName: organizationNameSchema,
});

export const acceptInvitationSchema = z.object({
  /** Only for a person without an account yet. */
  displayName: z.string().trim().min(2).max(160).optional(),
  /** Only for a person without an account yet. */
  password: z.string().min(8).max(128).optional(),
  token: invitationTokenSchema,
});

export const invitationAcceptedSchema = z.object({
  email: invitationEmailSchema,
  workspaceName: organizationNameSchema,
});

export type AcceptInvitation = z.infer<typeof acceptInvitationSchema>;

export type CreateInvitation = z.infer<typeof createInvitationSchema>;

export type Invitation = z.infer<typeof invitationSchema>;

export type InvitationAccepted = z.infer<typeof invitationAcceptedSchema>;

export type InvitationList = z.infer<typeof invitationListSchema>;

export type InvitationPreview = z.infer<typeof invitationPreviewSchema>;

export type InvitationStatus = z.infer<typeof invitationStatusSchema>;

export type InvitationTokenRequest = z.infer<typeof invitationTokenRequestSchema>;
