CREATE TABLE "core"."ledger_entries" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"tx_id" text NOT NULL,
	"account" text NOT NULL,
	"amount_vnd" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "core"."ledger_txs" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"order_id" text,
	"meta" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "core"."ledger_entries" ADD CONSTRAINT "ledger_entries_tx_id_ledger_txs_id_fk" FOREIGN KEY ("tx_id") REFERENCES "core"."ledger_txs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."ledger_txs" ADD CONSTRAINT "ledger_txs_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "core"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ledger_entries_account_idx" ON "core"."ledger_entries" USING btree ("account");