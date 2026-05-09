CREATE TABLE `shop_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`shop_id` text NOT NULL,
	`key` text NOT NULL,
	`value` text,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`shop_id`) REFERENCES `shops`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `shop_settings_shop_key_unique` ON `shop_settings` (`shop_id`,`key`);