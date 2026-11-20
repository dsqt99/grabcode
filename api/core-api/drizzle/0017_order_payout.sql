-- Coder share fixed per order. Existing orders keep the 70% they were created with (round to 1,000 VND, as payoutOf did).
ALTER TABLE "core"."orders" ADD COLUMN "payout_vnd" integer;--> statement-breakpoint
UPDATE "core"."orders" SET "payout_vnd" = round("price_vnd" * 0.7 / 1000) * 1000;--> statement-breakpoint
ALTER TABLE "core"."orders" ALTER COLUMN "payout_vnd" SET NOT NULL;
