-- ============================================================
-- V4 DDL：Agent 用户面身份（华为云账号级）
-- flyway history 表：flyway_schema_history_blog
-- 说明：Agent 身份主键 = hcloud_domain_id；Web 端存量用户保持 hcloud_domain_id 为 NULL。
--       MySQL 唯一索引允许多个 NULL，不影响存量 Web 用户。
-- ============================================================

ALTER TABLE `hd_blog_user`
    ADD COLUMN `hcloud_domain_id`   VARCHAR(64)  DEFAULT NULL COMMENT '华为云账号ID（Agent 身份）',
    ADD COLUMN `hcloud_domain_name` VARCHAR(255) DEFAULT NULL COMMENT '华为云账号名';

CREATE UNIQUE INDEX `uk_blog_user_domain` ON `hd_blog_user` (`hcloud_domain_id`);