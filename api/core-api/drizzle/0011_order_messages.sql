CREATE TABLE "core"."order_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" text NOT NULL,
	"sender_user_id" uuid NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "core"."order_messages" ADD CONSTRAINT "order_messages_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "core"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."order_messages" ADD CONSTRAINT "order_messages_sender_user_id_users_id_fk" FOREIGN KEY ("sender_user_id") REFERENCES "core"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "order_messages_order_idx" ON "core"."order_messages" USING btree ("order_id","created_at");