CREATE TABLE `sync_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`shop_id` text NOT NULL,
	`integration_type` text NOT NULL,
	`direction` text NOT NULL,
	`entity` text NOT NULL,
	`status` text NOT NULL,
	`message` text,
	`payload` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`shop_id`) REFERENCES `shops`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sync_logs_shop_idx` ON `sync_logs` (`shop_id`);--> statement-breakpoint
CREATE INDEX `sync_logs_type_idx` ON `sync_logs` (`integration_type`);