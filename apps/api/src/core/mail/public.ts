// The only entry point other parts of the API may import from this folder.
// Enforced by scripts/check-boundaries.mjs.
export {
  ConsoleMailSender,
  createMailSender,
  MAIL_SENDER,
  UnconfiguredMailSender,
} from "./mail-sender.js";
export type { MailSender, OutgoingMail } from "./mail-sender.js";
export { renderInvitationMail, renderPasswordResetMail } from "./mail-templates.js";
export type { MailLocale, RenderedMail } from "./mail-templates.js";
