ALTER TABLE `completions` ADD `cloud` text;--> statement-breakpoint
CREATE INDEX `completions_cloud` ON `completions` (`cloud`,`observed_at`);