import { HttpException, HttpStatus } from "@nestjs/common";

export type InvitationMessage = {
  /** The link the person opens; it carries the secret. */
  acceptUrl: string;
  email: string;
  expiresAt: Date;
  workspaceName: string;
};

/**
 * How an invitation reaches the invited person. The link is the proof that
 * they own the email address, so it goes to that address and nowhere else:
 * never into an API response, and never to the person who sent the invitation.
 */
export interface InvitationDelivery {
  /** Throws when invitations cannot be delivered at all, before anything is stored. */
  assertReady(): void;
  send(message: InvitationMessage): Promise<void>;
}

export const INVITATION_DELIVERY = Symbol("INVITATION_DELIVERY");

/**
 * For development: writes the link to the API's own output so a developer
 * can open it. It is never used in production.
 */
export class ConsoleInvitationDelivery implements InvitationDelivery {
  assertReady() {}

  async send(message: InvitationMessage) {
    console.log(
      JSON.stringify({
        acceptUrl: message.acceptUrl,
        email: message.email,
        event: "invitation_link_for_development",
        expiresAt: message.expiresAt.toISOString(),
        level: "info",
      }),
    );
  }
}

/** Production without a mail service: inviting is refused rather than pretending to send. */
export class UnconfiguredInvitationDelivery implements InvitationDelivery {
  assertReady(): never {
    throw new HttpException(
      {
        code: "MAIL_NOT_CONFIGURED",
        message: "Invitations cannot be sent because no mail service is configured.",
      },
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }

  async send(): Promise<never> {
    return this.assertReady();
  }
}

export function createInvitationDelivery(
  environment: { NODE_ENV?: string } = process.env,
): InvitationDelivery {
  return environment.NODE_ENV === "production"
    ? new UnconfiguredInvitationDelivery()
    : new ConsoleInvitationDelivery();
}

/** The address of the page where an invitation is accepted. The secret stays out of server logs. */
export function invitationAcceptUrl(webUrl: string | undefined, token: string) {
  const base = (webUrl ?? "http://localhost:4000").split(",")[0]?.trim() ?? "";
  // A fragment is not sent to any server, so the secret does not end up in access logs.
  return `${new URL(base).origin}/invite#token=${token}`;
}
