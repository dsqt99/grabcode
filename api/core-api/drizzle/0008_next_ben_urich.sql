CREATE TABLE "core"."dispatch_offers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" text NOT NULL,
	"coder_user_id" uuid NOT NULL,
	"wave" integer NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "core"."users" ADD COLUMN "online" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "core"."users" ADD COLUMN "last_seen_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "core"."dispatch_offers" ADD CONSTRAINT "dispatch_offers_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "core"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."dispatch_offers" ADD CONSTRAINT "dispatch_offers_coder_user_id_users_id_fk" FOREIGN KEY ("coder_user_id") REFERENCES "core"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "dispatch_offers_order_idx" ON "core"."dispatch_offers" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "dispatch_offers_coder_status_idx" ON "core"."dispatch_offers" USING btree ("coder_user_id","status");