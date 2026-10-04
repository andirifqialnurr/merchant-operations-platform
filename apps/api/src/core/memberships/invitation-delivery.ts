import { createMailSender, renderInvitationMail, type MailSender } from "../mail/public.js";

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

/** Sends the invitation as an email, written from the invitation template. */
export class MailInvitationDelivery implements InvitationDelivery {
  constructor(
    private readonly mail: MailSender,
    private readonly webUrl: string | undefined = process.env.WEB_URL,
  ) {}

  assertReady() {
    this.mail.assertReady();
  }

  async send(message: InvitationMessage) {
    // The language of the invited person is not known yet; Indonesian is the product's default.
    const rendered = renderInvitationMail({
      acceptUrl: message.acceptUrl,
      expiresAt: message.expiresAt,
      webUrl: this.webUrl?.split(",")[0]?.trim(),
      workspaceName: message.workspaceName,
    });
    await this.mail.send({ ...rendered, to: message.email });
  }
}

export function createInvitationDelivery(
  environment: { NODE_ENV?: string; WEB_URL?: string } = process.env,
): InvitationDelivery {
  return new MailInvitationDelivery(createMailSender(environment), environment.WEB_URL);
}

/** The address of the page where an invitation is accepted. The secret stays out of server logs. */
export function invitationAcceptUrl(webUrl: string | undefined, token: string) {
  const base = (webUrl ?? "http://localhost:4000").split(",")[0]?.trim() ?? "";
  // A fragment is not sent to any server, so the secret does not end up in access logs.
  return `${new URL(base).origin}/invite#token=${token}`;
}
