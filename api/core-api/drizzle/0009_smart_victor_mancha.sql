ALTER TABLE "core"."order_repos" ADD COLUMN "handed_over_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "core"."order_repos" ADD COLUMN "handed_over_to" text;--> statement-breakpoint
ALTER TABLE "core"."orders" ADD COLUMN "dispute_reason" text;