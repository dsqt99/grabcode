CREATE TABLE "core"."coder_profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"headline" text NOT NULL,
	"bio" text NOT NULL,
	"hourly_rate_vnd" integer NOT NULL,
	"experience_level" text NOT NULL,
	"skills" text[] NOT NULL,
	"hours_per_week" text NOT NULL,
	"languages" jsonb NOT NULL,
	"github_url" text,
	"portfolio_urls" text[] NOT NULL,
	"is_public" boolean NOT NULL,
	"available_for_work" boolean NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "core"."customer_profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"company_name" text NOT NULL,
	"company_size" text NOT NULL,
	"website" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "core"."users" ADD COLUMN "phone" text;--> statement-breakpoint
ALTER TABLE "core"."users" ADD COLUMN "country" text DEFAULT 'VN' NOT NULL;--> statement-breakpoint
ALTER TABLE "core"."users" ADD COLUMN "timezone" text DEFAULT 'Asia/Ho_Chi_Minh' NOT NULL;--> statement-breakpoint
ALTER TABLE "core"."users" ADD COLUMN "notifications" jsonb DEFAULT '{"email":true,"zalo":true,"push":true}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "core"."coder_profiles" ADD CONSTRAINT "coder_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "core"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."customer_profiles" ADD CONSTRAINT "customer_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "core"."users"("id") ON DELETE cascade ON UPDATE no action;