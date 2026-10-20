-- ============================================================
-- V5 DDL + DML：Agent 管理面权限（账号 → 角色 → 工具白名单）
-- flyway history 表：flyway_schema_history_blog
-- ============================================================

CREATE TABLE IF NOT EXISTS `hd_community_operator` (
    `id`             BIGINT      NOT NULL AUTO_INCREMENT COMMENT '主键',
    `admin_username` VARCHAR(64) NOT NULL COMMENT '关联 hd_blog_admin_user.username',
    `role`           VARCHAR(32) NOT NULL COMMENT '角色码',
    `status`         TINYINT     NOT NULL DEFAULT 1 COMMENT '1启用 0禁用',
    `create_time`    DATETIME    DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `update_time`    DATETIME    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_username` (`admin_username`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = 'Agent管理面操作员';

CREATE TABLE IF NOT EXISTS `hd_community_role_tool` (
    `id`        BIGINT      NOT NULL AUTO_INCREMENT COMMENT '主键',
    `role`      VARCHAR(32) NOT NULL COMMENT '角色码',
    `tool_name` VARCHAR(64) NOT NULL COMMENT 'MCP 工具名',
    `allow`     TINYINT     NOT NULL DEFAULT 1 COMMENT '1允许 0禁止',
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_role_tool` (`role`, `tool_name`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = 'Agent管理面角色工具白名单';

-- 内置管理员（admin）授予 super_admin（super_admin 后端内置直通全部 admin_*）
INSERT INTO `hd_community_operator` (`admin_username`, `role`, `status`)
VALUES ('admin', 'super_admin', 1)
ON DUPLICATE KEY UPDATE `role` = VALUES(`role`), `status` = VALUES(`status`);

-- 默认角色 → 工具白名单
INSERT INTO `hd_community_role_tool` (`role`, `tool_name`, `allow`) VALUES
    ('blog_reviewer',    'hdcommunity_admin_blog_page',            1),
    ('blog_reviewer',    'hdcommunity_admin_blog_review',          1),
    ('blog_reviewer',    'hdcommunity_admin_blog_review_batch',    1),
    ('blog_reviewer',    'hdcommunity_admin_blog_online',          1),
    ('blog_reviewer',    'hdcommunity_admin_blog_top',             1),
    ('blog_reviewer',    'hdcommunity_admin_blog_records',         1),
    ('blog_reviewer',    'hdcommunity_admin_stats',                1),
    ('comment_reviewer', 'hdcommunity_admin_comment_page',         1),
    ('comment_reviewer', 'hdcommunity_admin_comment_review',       1),
    ('comment_reviewer', 'hdcommunity_admin_comment_review_batch', 1),
    ('comment_reviewer', 'hdcommunity_admin_comment_online',       1),
    ('comment_reviewer', 'hdcommunity_admin_stats',                1),
    ('readonly_ops',     'hdcommunity_admin_blog_page',            1),
    ('readonly_ops',     'hdcommunity_admin_comment_page',         1),
    ('readonly_ops',     'hdcommunity_admin_stats',                1)
ON DUPLICATE KEY UPDATE `allow` = VALUES(`allow`);