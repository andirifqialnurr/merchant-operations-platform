CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'DISABLED');

CREATE TABLE "users" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "email" VARCHAR(254) NOT NULL,
  "password_hash" VARCHAR(255) NOT NULL,
  "display_name" VARCHAR(160) NOT NULL,
  "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
  "password_changed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_login_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "login_sessions" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "user_id" UUID NOT NULL,
  "token_hash" CHAR(64) NOT NULL,
  "expires_at" TIMESTAMPTZ(6) NOT NULL,
  "revoked_at" TIMESTAMPTZ(6),
  "last_seen_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ip_address" VARCHAR(45),
  "user_agent" VARCHAR(512),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "login_sessions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "login_sessions_token_hash_key" ON "login_sessions"("token_hash");
CREATE INDEX "login_sessions_user_id_expires_at_idx" ON "login_sessions"("user_id", "expires_at");
CREATE INDEX "login_sessions_expires_at_revoked_at_idx" ON "login_sessions"("expires_at", "revoked_at");

ALTER TABLE "login_sessions"
  ADD CONSTRAINT "login_sessions_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
