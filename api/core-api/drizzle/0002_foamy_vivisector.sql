ALTER TABLE "core"."users" ALTER COLUMN "github_login" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "core"."users" ADD COLUMN "email" text;--> statement-breakpoint
ALTER TABLE "core"."users" ADD COLUMN "password_hash" text;