CREATE TABLE `favorites` (
	`id` text PRIMARY KEY NOT NULL,
	`shop_id` text NOT NULL,
	`tg_user_id` text NOT NULL,
	`product_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`shop_id`) REFERENCES `shops`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tg_user_id`) REFERENCES `tg_users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `favorites_user_product_unique` ON `favorites` (`tg_user_id`,`product_id`);--> statement-breakpoint
CREATE INDEX `favorites_user_idx` ON `favorites` (`tg_user_id`);--> statement-breakpoint
CREATE TABLE `product_reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`shop_id` text NOT NULL,
	`product_id` text NOT NULL,
	`tg_user_id` text,
	`rating` integer NOT NULL,
	`comment` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`shop_id`) REFERENCES `shops`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tg_user_id`) REFERENCES `tg_users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `reviews_product_idx` ON `product_reviews` (`product_id`);--> statement-breakpoint
ALTER TABLE `categories` ADD `image_url` text;--> statement-breakpoint
ALTER TABLE `categories` ADD `emoji` text;--> statement-breakpoint
ALTER TABLE `products` ADD `compare_at_price` real;--> statement-breakpoint
ALTER TABLE `products` ADD `rating` real DEFAULT 5 NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `review_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `featured` integer DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX `products_featured_idx` ON `products` (`featured`);