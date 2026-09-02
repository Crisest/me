CREATE TYPE "public"."suggestion_status" AS ENUM('pending', 'accepted', 'rejected');--> statement-breakpoint
CREATE TABLE "category_suggestions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"transaction_id" uuid NOT NULL,
	"household_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"confidence" numeric(4, 3) NOT NULL,
	"reason" text NOT NULL,
	"source" text NOT NULL,
	"status" "suggestion_status" DEFAULT 'pending' NOT NULL,
	"created_by" uuid NOT NULL,
	"resolved_by" uuid,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "category_suggestions" ADD CONSTRAINT "category_suggestions_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "category_suggestions" ADD CONSTRAINT "category_suggestions_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "category_suggestions" ADD CONSTRAINT "category_suggestions_category_id_budget_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."budget_categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "category_suggestions" ADD CONSTRAINT "category_suggestions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "category_suggestions" ADD CONSTRAINT "category_suggestions_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "category_suggestions_live_uq" ON "category_suggestions" USING btree ("transaction_id","household_id") WHERE "category_suggestions"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "category_suggestions_household_status_idx" ON "category_suggestions" USING btree ("household_id","status");--> statement-breakpoint
CREATE INDEX "category_suggestions_transaction_id_idx" ON "category_suggestions" USING btree ("transaction_id");