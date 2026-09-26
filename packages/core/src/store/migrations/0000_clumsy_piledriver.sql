CREATE TABLE `api_keys` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`key_hash` text NOT NULL,
	`status` integer DEFAULT 0 NOT NULL,
	`role` text DEFAULT 'free' NOT NULL,
	`request_count` integer DEFAULT 0 NOT NULL,
	`request_limit` integer DEFAULT 1000 NOT NULL,
	`period_start` text DEFAULT (datetime('now')) NOT NULL,
	`created` text DEFAULT (datetime('now')) NOT NULL,
	`last_accessed` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `api_keys_email_unique` ON `api_keys` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `api_keys_key_hash_unique` ON `api_keys` (`key_hash`);--> statement-breakpoint
CREATE INDEX `api_keys_key_hash` ON `api_keys` (`key_hash`);--> statement-breakpoint
CREATE TABLE `audit_findings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`audit_run_id` integer NOT NULL,
	`severity` text NOT NULL,
	`code` text,
	`message` text NOT NULL,
	`detail` text,
	FOREIGN KEY (`audit_run_id`) REFERENCES `audit_runs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `audit_findings_run` ON `audit_findings` (`audit_run_id`,`severity`);--> statement-breakpoint
CREATE TABLE `audit_runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`run_id` integer NOT NULL,
	`site_id` integer,
	`url` text NOT NULL,
	`audit_type` text NOT NULL,
	`score` real,
	`data` text,
	`screenshot_path` text,
	`observed_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `runs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`site_id`) REFERENCES `sites`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `audit_runs_url_type_time` ON `audit_runs` (`url`,`audit_type`,`observed_at`);--> statement-breakpoint
CREATE TABLE `completions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`run_id` integer NOT NULL,
	`seed` text NOT NULL,
	`query` text NOT NULL,
	`phrase` text NOT NULL,
	`position` integer NOT NULL,
	`quality` text DEFAULT 'proxy' NOT NULL,
	`observed_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `runs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `completions_seed_time` ON `completions` (`seed`,`observed_at`);--> statement-breakpoint
CREATE TABLE `coverage_observations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`run_id` integer NOT NULL,
	`site_id` integer,
	`phrase` text NOT NULL,
	`url` text NOT NULL,
	`present` integer NOT NULL,
	`occurrences` integer DEFAULT 0 NOT NULL,
	`quality` text DEFAULT 'measured' NOT NULL,
	`observed_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `runs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`site_id`) REFERENCES `sites`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `coverage_phrase_time` ON `coverage_observations` (`phrase`,`observed_at`);--> statement-breakpoint
CREATE TABLE `jobs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`kind` text NOT NULL,
	`payload` text NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`priority` integer DEFAULT 0 NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`max_attempts` integer DEFAULT 1 NOT NULL,
	`run_after` text DEFAULT (datetime('now')) NOT NULL,
	`started_at` text,
	`finished_at` text,
	`progress` text,
	`error` text,
	`result` text,
	`created` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `jobs_claim` ON `jobs` (`status`,`priority`,`run_after`);--> statement-breakpoint
CREATE TABLE `page_terms` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`run_id` integer NOT NULL,
	`site_id` integer,
	`url` text NOT NULL,
	`term` text NOT NULL,
	`n` integer NOT NULL,
	`count` integer NOT NULL,
	`observed_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `runs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`site_id`) REFERENCES `sites`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `page_terms_url_time` ON `page_terms` (`url`,`observed_at`);--> statement-breakpoint
CREATE TABLE `pages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`run_id` integer NOT NULL,
	`site_id` integer,
	`url` text NOT NULL,
	`depth` integer,
	`title` text,
	`observed_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `runs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`site_id`) REFERENCES `sites`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pages_run_url` ON `pages` (`run_id`,`url`);--> statement-breakpoint
CREATE TABLE `rank_observations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`run_id` integer NOT NULL,
	`site_id` integer,
	`phrase` text NOT NULL,
	`position` integer,
	`status` text NOT NULL,
	`quality` text NOT NULL,
	`reason` text,
	`total_results` integer,
	`observed_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `runs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`site_id`) REFERENCES `sites`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `rank_obs_phrase_time` ON `rank_observations` (`phrase`,`observed_at`);--> statement-breakpoint
CREATE TABLE `runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tool` text NOT NULL,
	`target` text,
	`site_id` integer,
	`params` text,
	`status` text DEFAULT 'running' NOT NULL,
	`error` text,
	`job_id` integer,
	`started_at` text DEFAULT (datetime('now')) NOT NULL,
	`finished_at` text,
	FOREIGN KEY (`site_id`) REFERENCES `sites`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `runs_tool_started` ON `runs` (`tool`,`started_at`);--> statement-breakpoint
CREATE TABLE `serp_results` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`run_id` integer NOT NULL,
	`phrase` text NOT NULL,
	`rank` integer NOT NULL,
	`url` text NOT NULL,
	`host` text,
	`title` text,
	FOREIGN KEY (`run_id`) REFERENCES `runs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `serp_run_rank` ON `serp_results` (`run_id`,`rank`);--> statement-breakpoint
CREATE TABLE `sites` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`host` text NOT NULL,
	`label` text,
	`created` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sites_host_unique` ON `sites` (`host`);