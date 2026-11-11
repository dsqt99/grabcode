CREATE SEQUENCE "core"."order_number_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1001 CACHE 1;--> statement-breakpoint
CREATE TABLE "core"."orders" (
	"id" text PRIMARY KEY DEFAULT 'GC-' || nextval('core.order_number_seq') NOT NULL,
	"customer_user_id" uuid NOT NULL,
	"coder_user_id" uuid,
	"status" text DEFAULT 'DRAFT' NOT NULL,
	"tier" text NOT NULL,
	"title" text NOT NULL,
	"prompt" text NOT NULL,
	"template_id" text,
	"framework" text NOT NULL,
	"brief" jsonb NOT NULL,
	"price_vnd" integer NOT NULL,
	"eta_hours" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "core"."orders" ADD CONSTRAINT "orders_customer_user_id_users_id_fk" FOREIGN KEY ("customer_user_id") REFERENCES "core"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."orders" ADD CONSTRAINT "orders_coder_user_id_users_id_fk" FOREIGN KEY ("coder_user_id") REFERENCES "core"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "orders_customer_idx" ON "core"."orders" USING btree ("customer_user_id");--> statement-breakpoint
CREATE INDEX "orders_coder_idx" ON "core"."orders" USING btree ("coder_user_id");--> statement-breakpoint
CREATE INDEX "orders_status_idx" ON "core"."orders" USING btree ("status");