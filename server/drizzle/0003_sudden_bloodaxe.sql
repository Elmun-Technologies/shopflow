CREATE TABLE `leads` (
	`id` text PRIMARY KEY NOT NULL,
	`shop_id` text NOT NULL,
	`source` text NOT NULL,
	`status` text DEFAULT 'new' NOT NULL,
	`priority` text DEFAULT 'medium' NOT NULL,
	`name` text NOT NULL,
	`phone` text,
	`email` text,
	`company` text,
	`value` real DEFAULT 0 NOT NULL,
	`assigned_to` text,
	`notes` text,
	`tg_user_id` text,
	`order_id` text,
	`metadata` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`shop_id`) REFERENCES `shops`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`assigned_to`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`tg_user_id`) REFERENCES `tg_users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `leads_shop_idx` ON `leads` (`shop_id`);--> statement-breakpoint
CREATE INDEX `leads_source_idx` ON `leads` (`source`);--> statement-breakpoint
CREATE INDEX `leads_status_idx` ON `leads` (`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `leads_shop_tg_user_unique` ON `leads` (`shop_id`,`tg_user_id`);