CREATE TABLE "core"."order_repos" (
	"order_id" text PRIMARY KEY NOT NULL,
	"coder_user_id" uuid NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"repo_full_name" text,
	"html_url" text,
	"clone_url" text,
	"collaborator" text,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "order_repos_repo_full_name_unique" UNIQUE("repo_full_name")
);
--> statement-breakpoint
CREATE TABLE "core"."repo_commits" (
	"sha" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"message" text NOT NULL,
	"author" text NOT NULL,
	"url" text NOT NULL,
	"pushed_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "core"."order_repos" ADD CONSTRAINT "order_repos_coder_user_id_users_id_fk" FOREIGN KEY ("coder_user_id") REFERENCES "core"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."repo_commits" ADD CONSTRAINT "repo_commits_order_id_order_repos_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "core"."order_repos"("order_id") ON DELETE cascade ON UPDATE no action;