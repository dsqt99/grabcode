-- B1: the "waiting for a coder" (30 min) and auto refund (AUTO_REFUND_HOURS) clocks start when the order is funded.
ALTER TABLE "core"."orders" ADD COLUMN "funded_at" timestamp with time zone;--> statement-breakpoint
-- Orders past FUNDED: funded by their last deposit (or suspense move); created_at when the ledger has none.
UPDATE "core"."orders" o SET "funded_at" = coalesce(
  (SELECT max(t."created_at") FROM "core"."ledger_txs" t WHERE t."order_id" = o."id" AND t."kind" IN ('DEPOSIT', 'ADJUST')),
  o."created_at"
) WHERE o."status" IN ('FUNDED', 'DISPATCHED', 'IN_PROGRESS', 'DELIVERED', 'ACCEPTED', 'DISPUTED', 'RESOLVED');--> statement-breakpoint
-- B2: where the customer wants refunds of this order transferred ({bankName, accountNumber, accountName}).
ALTER TABLE "core"."orders" ADD COLUMN "refund_account" jsonb;--> statement-breakpoint
-- B2: one row per ledger tx that books money back to a customer; an admin transfers it and closes it with the bank reference.
CREATE TABLE "core"."refunds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tx_id" text NOT NULL,
	"order_id" text,
	"amount_vnd" bigint NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"reference" text,
	"paid_by" uuid,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "refunds_tx_id_unique" UNIQUE("tx_id"),
	CONSTRAINT "refunds_reference_unique" UNIQUE("reference")
);
--> statement-breakpoint
ALTER TABLE "core"."refunds" ADD CONSTRAINT "refunds_tx_id_ledger_txs_id_fk" FOREIGN KEY ("tx_id") REFERENCES "core"."ledger_txs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."refunds" ADD CONSTRAINT "refunds_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "core"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."refunds" ADD CONSTRAINT "refunds_paid_by_users_id_fk" FOREIGN KEY ("paid_by") REFERENCES "core"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "refunds_status_idx" ON "core"."refunds" USING btree ("status","created_at");--> statement-breakpoint
-- Refunds booked before this table existed were never tracked: list them as PENDING so ops check each one.
INSERT INTO "core"."refunds" ("tx_id", "order_id", "amount_vnd", "created_at")
SELECT t."id", t."order_id", e."amount_vnd", t."created_at"
FROM "core"."ledger_txs" t JOIN "core"."ledger_entries" e ON e."tx_id" = t."id" AND e."account" = 'bank:sepay' AND e."amount_vnd" > 0
WHERE t."kind" IN ('REFUND', 'RELEASE');
