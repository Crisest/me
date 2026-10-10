ALTER TABLE "accounts" ALTER COLUMN "plaid_account_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "uploads" ALTER COLUMN "card_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "uploads" ADD COLUMN "account_id" uuid;--> statement-breakpoint
ALTER TABLE "uploads" ADD CONSTRAINT "uploads_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "uploads_file_hash_account_id_idx" ON "uploads" USING btree ("file_hash","account_id");--> statement-breakpoint
CREATE INDEX "uploads_file_name_account_id_idx" ON "uploads" USING btree ("file_name","account_id");