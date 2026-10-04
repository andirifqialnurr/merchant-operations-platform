import { HttpException, HttpStatus } from "@nestjs/common";

export type OutgoingMail = { html: string; subject: string; text: string; to: string };

/** How an email leaves the API. */
export interface MailSender {
  /** Throws when mail cannot be sent at all, so callers can stop before storing anything. */
  assertReady(): void;
  send(mail: OutgoingMail): Promise<void>;
}

export const MAIL_SENDER = Symbol("MAIL_SENDER");

/**
 * For development: writes the email to the API's own output so a developer
 * can read it and open its link. It is never used in production.
 */
export class ConsoleMailSender implements MailSender {
  assertReady() {}

  async send(mail: OutgoingMail) {
    console.log(
      JSON.stringify({
        event: "mail_for_development",
        level: "info",
        subject: mail.subject,
        text: mail.text,
        to: mail.to,
      }),
    );
  }
}

/** Production without a mail service: sending is refused rather than pretended. */
export class UnconfiguredMailSender implements MailSender {
  assertReady(): never {
    throw new HttpException(
      {
        code: "MAIL_NOT_CONFIGURED",
        message: "Email cannot be sent because no mail service is configured.",
      },
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }

  async send(): Promise<never> {
    return this.assertReady();
  }
}

export function createMailSender(environment: { NODE_ENV?: string } = process.env): MailSender {
  return environment.NODE_ENV === "production"
    ? new UnconfiguredMailSender()
    : new ConsoleMailSender();
}
