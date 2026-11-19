CREATE TABLE "core"."payout_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"coder_user_id" uuid NOT NULL,
	"amount_vnd" bigint NOT NULL,
	"bank_account" text NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"note" text,
	"decided_by" uuid,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "core"."users" ADD COLUMN "tier_override" text;--> statement-breakpoint
ALTER TABLE "core"."users" ADD COLUMN "suspended" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "core"."payout_requests" ADD CONSTRAINT "payout_requests_coder_user_id_users_id_fk" FOREIGN KEY ("coder_user_id") REFERENCES "core"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."payout_requests" ADD CONSTRAINT "payout_requests_decided_by_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "core"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "payout_requests_coder_idx" ON "core"."payout_requests" USING btree ("coder_user_id","status");