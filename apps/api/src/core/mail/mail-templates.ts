/**
 * The emails the product sends, in Indonesian and English. Each one comes as
 * plain text and as simple HTML with the same words; the HTML uses tables and
 * inline styles only, because mail programs ignore almost everything else.
 */

export type MailLocale = "en" | "id";

export type RenderedMail = { html: string; subject: string; text: string };

type Brand = {
  /** Address of the web app; the product icon is loaded from it. Leave out for no icon. */
  webUrl?: string | undefined;
};

const PRODUCT = "Cafe Companion";
/** Calm Neutral: ink and neutrals only, as in the app. */
const INK = "#16181c";
const TEXT_SECONDARY = "#4f5358";
const BORDER = "#d7d9dc";
const CANVAS = "#f9fafb";
const SURFACE = "#ffffff";
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => `&#${character.charCodeAt(0)};`);
}

/** A name that goes into a subject line must stay on one line. */
function oneLine(value: string) {
  // eslint-disable-next-line no-control-regex
  return value.replace(/[\u0000-\u001f\u007f]+/g, " ").trim();
}

function formatDeadline(date: Date, locale: MailLocale, timeZone: string) {
  return new Intl.DateTimeFormat(locale === "id" ? "id-ID" : "en-GB", {
    day: "numeric",
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    month: "long",
    timeZone,
    // The zone is written out: the reader may be somewhere else.
    timeZoneName: "short",
    year: "numeric",
  }).format(date);
}

type Copy = {
  action: string;
  /** Sentences before the button. */
  body: string[];
  /** Sentences after the link. */
  footer: string[];
  heading: string;
  linkHint: string;
  subject: string;
};

function wordmark(brand: Brand) {
  // The M1 mark as the app icon; mail programs that block pictures still show the name.
  const icon = brand.webUrl
    ? `<td style="padding:0 10px 0 0;vertical-align:middle"><img src="${escapeHtml(new URL("/icon-192.png", brand.webUrl).href)}" width="28" height="28" alt="" style="display:block;border:0;border-radius:7px"></td>`
    : "";
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>${icon}<td style="vertical-align:middle;font:600 16px/1.3 ${FONT};color:${INK}">${PRODUCT}</td></tr></table>`;
}

function layout(copy: Copy, url: string, locale: MailLocale, brand: Brand): RenderedMail {
  const paragraph = (text: string, color = INK) =>
    `<p style="margin:0 0 16px;font:400 15px/1.55 ${FONT};color:${color}">${escapeHtml(text)}</p>`;
  const safeUrl = escapeHtml(url);

  const html = [
    "<!doctype html>",
    `<html lang="${locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(copy.subject)}</title></head>`,
    `<body style="margin:0;padding:0;background:${CANVAS}">`,
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${CANVAS}"><tr><td align="center" style="padding:32px 16px">`,
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px">`,
    `<tr><td style="padding:0 4px 20px">${wordmark(brand)}</td></tr>`,
    `<tr><td style="background:${SURFACE};border:1px solid ${BORDER};border-radius:12px;padding:28px">`,
    `<h1 style="margin:0 0 16px;font:600 20px/1.3 ${FONT};color:${INK}">${escapeHtml(copy.heading)}</h1>`,
    ...copy.body.map((text) => paragraph(text)),
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px"><tr><td style="background:${INK};border-radius:8px">`,
    `<a href="${safeUrl}" style="display:inline-block;padding:12px 20px;font:600 15px/1 ${FONT};color:${SURFACE};text-decoration:none">${escapeHtml(copy.action)}</a>`,
    "</td></tr></table>",
    paragraph(copy.linkHint, TEXT_SECONDARY),
    `<p style="margin:0 0 20px;font:400 13px/1.5 ${FONT};color:${TEXT_SECONDARY};word-break:break-all"><a href="${safeUrl}" style="color:${TEXT_SECONDARY}">${safeUrl}</a></p>`,
    ...copy.footer.map(
      (text) =>
        `<p style="margin:0 0 8px;font:400 13px/1.5 ${FONT};color:${TEXT_SECONDARY}">${escapeHtml(text)}</p>`,
    ),
    "</td></tr></table></td></tr></table></body></html>",
  ].join("");

  const text = [
    PRODUCT,
    "",
    copy.heading,
    "",
    ...copy.body,
    "",
    `${copy.action}:`,
    url,
    "",
    ...copy.footer,
    "",
  ].join("\n");

  return { html, subject: oneLine(copy.subject), text };
}

export type InvitationMailInput = Brand & {
  acceptUrl: string;
  expiresAt: Date;
  locale?: MailLocale;
  /** Where the deadline is shown, e.g. "Asia/Jakarta". */
  timeZone?: string;
  workspaceName: string;
};

/** "You are invited to join …": the link, and until when it works. */
export function renderInvitationMail(input: InvitationMailInput): RenderedMail {
  const locale = input.locale ?? "id";
  const workspace = oneLine(input.workspaceName);
  const deadline = formatDeadline(input.expiresAt, locale, input.timeZone ?? "Asia/Jakarta");
  const copy: Copy =
    locale === "id"
      ? {
          action: "Terima undangan",
          body: [
            `Anda diundang untuk bergabung dengan ${workspace} di ${PRODUCT}.`,
            "Buka tautan di bawah untuk menerima. Bila Anda belum punya akun, Anda akan diminta membuat nama dan kata sandi.",
          ],
          footer: [
            `Tautan ini berlaku sampai ${deadline} dan hanya bisa dipakai sekali.`,
            "Bila Anda tidak mengenal pengundangnya, abaikan email ini. Tidak ada yang terjadi sampai tautan dibuka.",
          ],
          heading: `Undangan ke ${workspace}`,
          linkHint: "Bila tombol tidak bisa ditekan, salin alamat ini ke browser:",
          subject: `Undangan bergabung dengan ${workspace}`,
        }
      : {
          action: "Accept the invitation",
          body: [
            `You are invited to join ${workspace} on ${PRODUCT}.`,
            "Open the link below to accept. If you do not have an account yet, you will be asked for a name and a password.",
          ],
          footer: [
            `This link works until ${deadline} and can be used once.`,
            "If you do not know who invited you, ignore this email. Nothing happens until the link is opened.",
          ],
          heading: `Invitation to ${workspace}`,
          linkHint: "If the button does not work, copy this address into your browser:",
          subject: `Invitation to join ${workspace}`,
        };
  return layout(copy, input.acceptUrl, locale, input);
}

export type PasswordResetMailInput = Brand & {
  expiresAt: Date;
  locale?: MailLocale;
  resetUrl: string;
  timeZone?: string;
};

/** "Reset your password": the link, until when it works, and what to do if it was not you. */
export function renderPasswordResetMail(input: PasswordResetMailInput): RenderedMail {
  const locale = input.locale ?? "id";
  const deadline = formatDeadline(input.expiresAt, locale, input.timeZone ?? "Asia/Jakarta");
  const copy: Copy =
    locale === "id"
      ? {
          action: "Buat kata sandi baru",
          body: [
            `Kami menerima permintaan untuk mengganti kata sandi akun ${PRODUCT} Anda.`,
            "Buka tautan di bawah untuk membuat kata sandi baru.",
          ],
          footer: [
            `Tautan ini berlaku sampai ${deadline} dan hanya bisa dipakai sekali.`,
            "Bila Anda tidak memintanya, abaikan email ini. Kata sandi Anda tidak berubah.",
          ],
          heading: "Ganti kata sandi",
          linkHint: "Bila tombol tidak bisa ditekan, salin alamat ini ke browser:",
          subject: `Ganti kata sandi ${PRODUCT}`,
        }
      : {
          action: "Create a new password",
          body: [
            `We received a request to change the password of your ${PRODUCT} account.`,
            "Open the link below to create a new password.",
          ],
          footer: [
            `This link works until ${deadline} and can be used once.`,
            "If you did not ask for this, ignore this email. Your password stays as it is.",
          ],
          heading: "Reset your password",
          linkHint: "If the button does not work, copy this address into your browser:",
          subject: `Reset your ${PRODUCT} password`,
        };
  return layout(copy, input.resetUrl, locale, input);
}
