CREATE SCHEMA "core";
--> statement-breakpoint
CREATE TABLE "core"."brief_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"prompt" text NOT NULL,
	"tier" text NOT NULL,
	"template_id" text,
	"framework" text NOT NULL,
	"brief" jsonb,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "core"."outbox" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"event_id" uuid NOT NULL,
	"subject" text NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_at" timestamp with time zone,
	CONSTRAINT "outbox_event_id_unique" UNIQUE("event_id")
);
