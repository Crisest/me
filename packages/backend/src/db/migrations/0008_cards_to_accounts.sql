-- Every card becomes a manual account under the SAME id, so card_id can be
-- copied into account_id verbatim. Idempotent: safe to re-run.
INSERT INTO "accounts" ("id", "bank_id", "plaid_account_id", "name", "type", "created_by", "created_at", "updated_at")
SELECT "id", "bank_id", NULL, "name", 'other', "created_by", "created_at", "updated_at" FROM "cards"
ON CONFLICT ("id") DO NOTHING;
--> statement-breakpoint
UPDATE "transactions" SET "account_id" = "card_id"
WHERE "card_id" IS NOT NULL AND "account_id" IS NULL;
--> statement-breakpoint
UPDATE "uploads" SET "account_id" = "card_id"
WHERE "card_id" IS NOT NULL AND "account_id" IS NULL;
