ALTER TABLE "budget_category_overrides" DROP CONSTRAINT "bco_user_category_month_year_uq";--> statement-breakpoint
ALTER TABLE "budget_categories" ALTER COLUMN "household_id" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "household_members_active_user_uq" ON "household_members" USING btree ("user_id") WHERE "household_members"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "transaction_categories_active_uq" ON "transaction_categories" USING btree ("transaction_id","household_id") WHERE "transaction_categories"."deleted_at" IS NULL;--> statement-breakpoint
ALTER TABLE "budget_category_overrides" ADD CONSTRAINT "bco_category_month_year_uq" UNIQUE("category_id","month","year");