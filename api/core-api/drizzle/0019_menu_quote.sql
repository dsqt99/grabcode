-- P0-7 (HON-10 Q3): orders pick a menu item and start at its "giá từ"; an admin quotes the final price before the customer pays.
ALTER TABLE "core"."orders" ADD COLUMN "menu_item" text;--> statement-breakpoint
ALTER TABLE "core"."orders" ADD COLUMN "price_quoted_at" timestamp with time zone;--> statement-breakpoint
-- Orders created before the menu were priced at creation (package price): treat them as quoted, they keep price_vnd / payout_vnd.
UPDATE "core"."orders" SET "price_quoted_at" = "created_at";
