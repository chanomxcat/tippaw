CREATE TABLE `alert_variant` (
	`id` text PRIMARY KEY NOT NULL,
	`streamer_id` text NOT NULL,
	`name` text NOT NULL,
	`min_amount_satang` integer NOT NULL,
	`weight` integer DEFAULT 1 NOT NULL,
	`message_template` text NOT NULL,
	`text_color` text,
	`font_family` text,
	`font_size` integer,
	`image_url` text,
	`sound_url` text,
	`animation_in` text,
	`animation_out` text,
	`duration_ms` integer,
	`tts_enabled` integer DEFAULT false NOT NULL,
	`tts_voice` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`streamer_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `donation` (
	`id` text PRIMARY KEY NOT NULL,
	`streamer_id` text NOT NULL,
	`kind` text NOT NULL,
	`gift_type_id` text,
	`donor_name` text NOT NULL,
	`message_raw` text,
	`amount_satang` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`provider` text NOT NULL,
	`provider_session_id` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`paid_at` integer,
	FOREIGN KEY (`streamer_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `donation_provider_session_id_unique` ON `donation` (`provider_session_id`);--> statement-breakpoint
CREATE INDEX `donation_streamer_status_paidAt_idx` ON `donation` (`streamer_id`,`status`,`paid_at`);--> statement-breakpoint
CREATE TABLE `invite_code` (
	`code` text PRIMARY KEY NOT NULL,
	`note` text,
	`max_uses` integer,
	`used_count` integer DEFAULT 0 NOT NULL,
	`expires_at` integer,
	`disabled_at` integer,
	`created_by` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `invite_redemption` (
	`user_id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`redeemed_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`code`) REFERENCES `invite_code`(`code`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `overlay` (
	`id` text PRIMARY KEY NOT NULL,
	`streamer_id` text NOT NULL,
	`type` text NOT NULL,
	`token` text NOT NULL,
	`settings` text,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`streamer_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `overlay_token_unique` ON `overlay` (`token`);--> statement-breakpoint
CREATE UNIQUE INDEX `overlay_streamer_type_idx` ON `overlay` (`streamer_id`,`type`);--> statement-breakpoint
CREATE TABLE `payout_account` (
	`user_id` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`external_account_id` text,
	`status` text DEFAULT 'pending' NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `streamer_profile` (
	`user_id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `streamer_profile_slug_unique` ON `streamer_profile` (`slug`);--> statement-breakpoint
CREATE TABLE `tip_page` (
	`user_id` text PRIMARY KEY NOT NULL,
	`channel_name` text NOT NULL,
	`links` text DEFAULT '[]' NOT NULL,
	`theme` text,
	`banner_url` text,
	`background_url` text,
	`body_json` text,
	`success_message` text,
	`failure_message` text,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `webhook_event` (
	`provider_event_id` text PRIMARY KEY NOT NULL,
	`received_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `account_userId_idx` ON `account` (`user_id`);--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL,
	`token` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` text NOT NULL,
	`impersonated_by` text,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE INDEX `session_userId_idx` ON `session` (`user_id`);--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`username` text,
	`display_username` text,
	`role` text,
	`banned` integer DEFAULT false,
	`ban_reason` text,
	`ban_expires` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `user_username_unique` ON `user` (`username`);--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `verification_identifier_idx` ON `verification` (`identifier`);