-- S6 realtime hints. Centrifugo's PostgreSQL consumer reads (and deletes) rows of public.centrifugo_outbox.
-- Triggers write the hint in the same transaction as the business row, so every writer (API, worker result
-- consumers, webhooks) is covered and nothing is pushed for a rolled-back change. Hints carry no state.
CREATE TABLE IF NOT EXISTS "public"."centrifugo_outbox" (
	"id" bigserial PRIMARY KEY,
	"method" text NOT NULL,
	"payload" jsonb NOT NULL,
	"partition" integer NOT NULL DEFAULT 0,
	"created_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "core"."realtime_hint"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
	r jsonb := to_jsonb(NEW);
	oid text := COALESCE(r->>'order_id', r->>'id');
	recipients text[];
BEGIN
	IF TG_ARGV[0] = 'offer' THEN
		recipients := ARRAY[r->>'coder_user_id'];
	ELSE
		SELECT array_remove(ARRAY[o.customer_user_id::text, o.coder_user_id::text], NULL) INTO recipients FROM core.orders o WHERE o.id = oid;
	END IF;
	IF cardinality(recipients) > 0 THEN
		INSERT INTO public.centrifugo_outbox (method, payload) VALUES ('broadcast', jsonb_build_object(
			'channels', (SELECT jsonb_agg('user.' || u) FROM unnest(recipients) u),
			'data', jsonb_build_object('type', TG_ARGV[0], 'orderId', oid)));
	END IF;
	RETURN NULL;
END $$;
--> statement-breakpoint
CREATE TRIGGER "realtime_hint" AFTER INSERT OR UPDATE ON "core"."orders" FOR EACH ROW EXECUTE FUNCTION "core"."realtime_hint"('order');
--> statement-breakpoint
CREATE TRIGGER "realtime_hint" AFTER INSERT ON "core"."repo_commits" FOR EACH ROW EXECUTE FUNCTION "core"."realtime_hint"('order');
--> statement-breakpoint
CREATE TRIGGER "realtime_hint" AFTER INSERT ON "core"."ledger_txs" FOR EACH ROW EXECUTE FUNCTION "core"."realtime_hint"('order');
--> statement-breakpoint
CREATE TRIGGER "realtime_hint" AFTER INSERT OR UPDATE ON "core"."order_repos" FOR EACH ROW EXECUTE FUNCTION "core"."realtime_hint"('repo');
--> statement-breakpoint
CREATE TRIGGER "realtime_hint" AFTER INSERT ON "core"."order_messages" FOR EACH ROW EXECUTE FUNCTION "core"."realtime_hint"('chat');
--> statement-breakpoint
CREATE TRIGGER "realtime_hint" AFTER INSERT OR UPDATE ON "core"."dispatch_offers" FOR EACH ROW EXECUTE FUNCTION "core"."realtime_hint"('offer');
