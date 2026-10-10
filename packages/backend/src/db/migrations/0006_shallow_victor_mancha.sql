CREATE TABLE "budget_month_snapshots" (
	"id" uuid PRIMARY KEY NOT NULL,
	"household_id" uuid NOT NULL,
	"month" smallint NOT NULL,
	"year" integer NOT NULL,
	"version" smallint DEFAULT 1 NOT NULL,
	"members" jsonb NOT NULL,
	"summary" jsonb NOT NULL,
	"transactions" jsonb NOT NULL,
	"closed_by" uuid,
	"superseded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bms_month_ck" CHECK ("budget_month_snapshots"."month" BETWEEN 1 AND 12)
);
--> statement-breakpoint
ALTER TABLE "budget_month_snapshots" ADD CONSTRAINT "budget_month_snapshots_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_month_snapshots" ADD CONSTRAINT "budget_month_snapshots_closed_by_users_id_fk" FOREIGN KEY ("closed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "bms_household_month_year_live_uq" ON "budget_month_snapshots" USING btree ("household_id","month","year") WHERE "budget_month_snapshots"."superseded_at" IS NULL;