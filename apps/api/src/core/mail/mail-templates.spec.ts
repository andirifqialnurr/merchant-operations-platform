import assert from "node:assert/strict";
import test from "node:test";

import { HttpException } from "@nestjs/common";

import { createMailSender } from "./mail-sender.js";
import { renderInvitationMail, renderPasswordResetMail } from "./mail-templates.js";

const LINK = `https://app.example.com/invite#token=${"t".repeat(43)}`;
const DEADLINE = new Date("2026-10-11T08:00:00.000Z");
const invitation = (locale: "en" | "id", workspaceName = "Kopi Lokal") =>
  renderInvitationMail({
    acceptUrl: LINK,
    expiresAt: DEADLINE,
    locale,
    webUrl: "https://app.example.com",
    workspaceName,
  });

test("the invitation says who invites, where to click, and until when, in both languages", () => {
  const id = invitation("id");
  assert.equal(id.subject, "Undangan bergabung dengan Kopi Lokal");
  assert.ok(id.text.includes("Anda diundang untuk bergabung dengan Kopi Lokal di Cafe Companion."));
  assert.ok(id.text.includes(LINK));
  assert.ok(id.text.includes("11 Oktober 2026"));
  assert.ok(id.text.includes("WIB"));
  assert.ok(id.html.includes('lang="id"'));

  const en = invitation("en");
  assert.equal(en.subject, "Invitation to join Kopi Lokal");
  assert.ok(en.text.includes("You are invited to join Kopi Lokal on Cafe Companion."));
  assert.ok(en.text.includes("11 October 2026"));
  assert.ok(en.html.includes('lang="en"'));
});

test("the plain text and the HTML say the same thing", () => {
  for (const locale of ["id", "en"] as const) {
    const mail = invitation(locale);
    const visible = mail.html
      .replace(/<title>[\s\S]*?<\/title>/, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/&#(\d+);/g, (_match, code: string) => String.fromCharCode(Number(code)))
      .replace(/\s+/g, " ");
    for (const line of mail.text.split("\n").filter((item) => item.trim() && !item.endsWith(":"))) {
      assert.ok(visible.includes(line.trim()), `${locale}: ${line}`);
    }
  }
});

test("the HTML is simple: tables and inline styles, no scripts, no outside stylesheets", () => {
  const { html } = invitation("id");
  assert.ok(html.startsWith("<!doctype html>"));
  assert.equal(/<script|<style|<link|javascript:|onclick=|<form/i.test(html), false);
  assert.ok(html.includes('role="presentation"'));
  // The link is there twice: on the button and written out for programs without buttons.
  assert.equal(html.split(`href="${LINK}"`).length - 1, 2);
});

test("the wordmark is the product icon and name, and the name alone when pictures are blocked", () => {
  const { html } = invitation("id");
  assert.ok(html.includes('src="https://app.example.com/icon-192.png"'));
  assert.ok(html.includes('alt=""'));
  assert.ok(html.includes(">Cafe Companion<"));

  const plain = renderInvitationMail({
    acceptUrl: LINK,
    expiresAt: DEADLINE,
    workspaceName: "Kopi Lokal",
  });
  assert.equal(plain.html.includes("<img"), false);
  assert.ok(plain.html.includes(">Cafe Companion<"));
});

test("a workspace name cannot inject markup or a second header line", () => {
  const mail = invitation("id", 'Kopi <img src=x onerror="alert(1)">\r\nBcc: orang@lain.test');
  assert.equal(mail.html.includes("<img src=x"), false);
  assert.equal(mail.html.includes('onerror="alert'), false);
  assert.equal(/[\r\n]/.test(mail.subject), false);
  assert.ok(mail.subject.includes("Bcc: orang@lain.test"), "kept as words, on the same line");
});

test("the password reset says how to proceed and what to do if it was not asked for", () => {
  const input = {
    expiresAt: DEADLINE,
    resetUrl: `https://app.example.com/reset#token=${"r".repeat(43)}`,
    webUrl: "https://app.example.com",
  };
  const id = renderPasswordResetMail({ ...input, locale: "id" });
  assert.equal(id.subject, "Ganti kata sandi Cafe Companion");
  assert.ok(id.text.includes(input.resetUrl));
  assert.ok(id.text.includes("Bila Anda tidak memintanya, abaikan email ini."));
  assert.ok(id.text.includes("hanya bisa dipakai sekali"));

  const en = renderPasswordResetMail({ ...input, locale: "en" });
  assert.equal(en.subject, "Reset your Cafe Companion password");
  assert.ok(en.text.includes("If you did not ask for this, ignore this email."));
  assert.equal(en.html.split(`href="${input.resetUrl}"`).length - 1, 2);
});

test("Indonesian is the default language", () => {
  const mail = renderInvitationMail({
    acceptUrl: LINK,
    expiresAt: DEADLINE,
    workspaceName: "Kopi Lokal",
  });
  assert.ok(mail.subject.startsWith("Undangan"));
});

test("in production without a mail service, sending is refused; in development it is written out", async () => {
  const production = createMailSender({ NODE_ENV: "production" });
  assert.throws(
    () => production.assertReady(),
    (error: unknown) =>
      error instanceof HttpException &&
      error.getStatus() === 503 &&
      (error.getResponse() as { code: string }).code === "MAIL_NOT_CONFIGURED",
  );
  await assert.rejects(production.send({ html: "", subject: "", text: "", to: "a@b.test" }));
  assert.doesNotThrow(() => createMailSender({ NODE_ENV: "development" }).assertReady());
});
