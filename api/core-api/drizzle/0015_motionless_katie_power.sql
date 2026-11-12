CREATE TABLE "core"."rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"n" integer NOT NULL,
	"until" timestamp with time zone NOT NULL
);
