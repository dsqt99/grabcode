-- HON-23: the customer has AUTO_ACCEPT_HOURS (72h) after delivery to accept, ask for changes or dispute; then the order is accepted by the system.
ALTER TABLE "core"."orders" ADD COLUMN "delivered_at" timestamp with time zone;--> statement-breakpoint
UPDATE "core"."orders" SET "delivered_at" = "updated_at" WHERE "status" = 'DELIVERED';
