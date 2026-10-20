package com.huaweicloud.blog.module.manage.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.io.Serializable;

/**
 * Agent 管理面角色 → MCP 工具白名单。
 */
@Data
@TableName("hd_community_role_tool")
public class CommunityRoleTool implements Serializable {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String role;

    /** MCP 工具名，如 hdcommunity_admin_blog_review */
    private String toolName;

    /** 1 允许 / 0 禁止 */
    private Integer allow;
}