CREATE TYPE "PlatformRole" AS ENUM ('OWNER', 'ADMIN', 'SUPPORT');

CREATE TABLE "platform_users" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "email" VARCHAR(254) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "display_name" VARCHAR(160) NOT NULL,
    "role" "PlatformRole" NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "password_changed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_login_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "platform_users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "platform_login_sessions" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "user_id" UUID NOT NULL,
    "token_hash" CHAR(64) NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),
    "last_seen_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip_address" VARCHAR(45),
    "user_agent" VARCHAR(512),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "platform_login_sessions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "platform_users_email_key" ON "platform_users"("email");
CREATE INDEX "platform_users_role_status_idx" ON "platform_users"("role", "status");
CREATE UNIQUE INDEX "platform_login_sessions_token_hash_key" ON "platform_login_sessions"("token_hash");
CREATE INDEX "platform_login_sessions_user_id_expires_at_idx" ON "platform_login_sessions"("user_id", "expires_at");
CREATE INDEX "platform_login_sessions_expires_at_revoked_at_idx" ON "platform_login_sessions"("expires_at", "revoked_at");

ALTER TABLE "platform_login_sessions"
ADD CONSTRAINT "platform_login_sessions_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "platform_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
