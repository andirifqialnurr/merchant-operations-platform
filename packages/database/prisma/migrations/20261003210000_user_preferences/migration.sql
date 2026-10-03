-- Language and theme a user chose. Null means "not chosen": the browser
-- language and the system theme apply.

ALTER TABLE "users"
  ADD COLUMN "locale" VARCHAR(2),
  ADD COLUMN "theme" VARCHAR(6);

ALTER TABLE "users" ADD CONSTRAINT "users_locale_check"
  CHECK ("locale" IS NULL OR "locale" IN ('id', 'en'));
ALTER TABLE "users" ADD CONSTRAINT "users_theme_check"
  CHECK ("theme" IS NULL OR "theme" IN ('light', 'dark', 'system'));
