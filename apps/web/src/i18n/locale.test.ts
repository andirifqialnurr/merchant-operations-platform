import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

import { formatLocale, isLocale, localeFromAcceptLanguage } from "./locale";

type Dictionary = { [key: string]: string | Dictionary };

function keysOf(dictionary: Dictionary, prefix = ""): string[] {
  return Object.entries(dictionary).flatMap(([key, value]) =>
    typeof value === "string" ? [`${prefix}${key}`] : keysOf(value, `${prefix}${key}.`),
  );
}

async function load(locale: string) {
  const url = new URL(`../../messages/${locale}.json`, import.meta.url);
  return JSON.parse(await readFile(url, "utf8")) as Dictionary;
}

test("the default language follows the browser and falls back to Indonesian", () => {
  assert.equal(localeFromAcceptLanguage("en-US,en;q=0.9,id;q=0.8"), "en");
  assert.equal(localeFromAcceptLanguage("id-ID,id;q=0.9,en;q=0.8"), "id");
  assert.equal(localeFromAcceptLanguage("fr-FR,fr;q=0.9,en;q=0.5"), "en");
  assert.equal(localeFromAcceptLanguage("ja-JP"), "id");
  assert.equal(localeFromAcceptLanguage(null), "id");
  assert.equal(localeFromAcceptLanguage("en;q=0.2,id;q=0.9"), "id");
});

test("only supported languages are accepted from the cookie", () => {
  assert.equal(isLocale("id"), true);
  assert.equal(isLocale("en"), true);
  assert.equal(isLocale("fr"), false);
  assert.equal(isLocale(undefined), false);
  assert.equal(formatLocale("id"), "id-ID");
  assert.equal(formatLocale("en"), "en-US");
});

test("both dictionaries define exactly the same keys", async () => {
  const [indonesian, english] = await Promise.all([load("id"), load("en")]);
  assert.deepEqual(keysOf(english).sort(), keysOf(indonesian).sort());
});

test("no dictionary entry is empty and placeholders match across languages", async () => {
  const [indonesian, english] = await Promise.all([load("id"), load("en")]);
  const flatten = (dictionary: Dictionary, prefix = ""): [string, string][] =>
    Object.entries(dictionary).flatMap(([key, value]) =>
      typeof value === "string"
        ? [[`${prefix}${key}`, value] as [string, string]]
        : flatten(value, `${prefix}${key}.`),
    );
  const english_ = new Map(flatten(english));
  for (const [key, value] of flatten(indonesian)) {
    assert.ok(value.trim().length > 0, `${key} is empty in id`);
    const other = english_.get(key) ?? "";
    assert.ok(other.trim().length > 0, `${key} is empty in en`);
    const placeholders = (text: string) => (text.match(/\{[a-zA-Z]+\}/g) ?? []).sort();
    assert.deepEqual(placeholders(other), placeholders(value), `${key} placeholders differ`);
  }
});
