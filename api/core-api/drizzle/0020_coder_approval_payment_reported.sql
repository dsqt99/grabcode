-- P0-8: coders wait for an admin before they see jobs or offers. Coders that exist before this migration are approved
-- (default agreed in HON-20); every later CODER role starts PENDING (set by core-api when the role is added).
ALTER TABLE "core"."users" ADD COLUMN "coder_approval" text;--> statement-breakpoint
UPDATE "core"."users" SET "coder_approval" = 'APPROVED' WHERE 'CODER' = ANY("roles");--> statement-breakpoint
-- P0-4: the customer pressed "Tôi đã chuyển khoản" on the payment page (admin still confirms the transfer).
ALTER TABLE "core"."orders" ADD COLUMN "payment_reported_at" timestamp with time zone;
