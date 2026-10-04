-- Invitations (flowchart.md 12): someone in a workspace invites an email
-- address with roles and outlets. The link carries a secret; only its hash is
-- stored. Accepting creates the membership, and the account when the email
-- has none yet.

CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED');

CREATE TABLE "core_invitations" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "tenant_id" UUID NOT NULL,
  "email" VARCHAR(254) NOT NULL,
  -- What the person gets when accepting; checked again at that moment.
  "role_ids" UUID[] NOT NULL,
  "all_outlets" BOOLEAN NOT NULL DEFAULT FALSE,
  "outlet_ids" UUID[] NOT NULL DEFAULT '{}',
  "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
  -- SHA-256 of the secret in the link. Cleared as soon as it can no longer be used.
  "token_hash" CHAR(64),
  "expires_at" TIMESTAMPTZ(6) NOT NULL,
  "invited_by" UUID,
  "accepted_at" TIMESTAMPTZ(6),
  "accepted_user_id" UUID,
  "revoked_at" TIMESTAMPTZ(6),
  "revoked_by" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "core_invitations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "core_invitations_email_check" CHECK ("email" = lower(btrim("email"))),
  CONSTRAINT "core_invitations_roles_check" CHECK (cardinality("role_ids") >= 1),
  CONSTRAINT "core_invitations_outlets_check"
    CHECK (("all_outlets" AND cardinality("outlet_ids") = 0)
        OR (NOT "all_outlets" AND cardinality("outlet_ids") >= 1)),
  -- Only a pending invitation keeps a usable secret.
  CONSTRAINT "core_invitations_token_check"
    CHECK (("status" = 'PENDING') = ("token_hash" IS NOT NULL)),
  CONSTRAINT "core_invitations_accepted_check"
    CHECK ("status" <> 'ACCEPTED' OR "accepted_at" IS NOT NULL),
  CONSTRAINT "core_invitations_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "core_invitations_accepted_user_id_fkey"
    FOREIGN KEY ("accepted_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "core_invitations_token_hash_key" ON "core_invitations"("token_hash");
-- One open invitation per email in a workspace.
CREATE UNIQUE INDEX "core_invitations_pending_email_key"
  ON "core_invitations"("tenant_id", "email") WHERE "status" = 'PENDING';
CREATE INDEX "core_invitations_tenant_id_status_idx" ON "core_invitations"("tenant_id", "status");
