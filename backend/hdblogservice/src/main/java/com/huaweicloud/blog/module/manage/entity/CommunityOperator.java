package com.huaweicloud.blog.module.manage.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.io.Serializable;
import java.time.LocalDateTime;

/**
 * Agent 管理面操作员 → 角色。
 */
@Data
@TableName("hd_community_operator")
public class CommunityOperator implements Serializable {

    @TableId(type = IdType.AUTO)
    private Long id;

    /** 关联 hd_blog_admin_user.username */
    private String adminUsername;

    private String role;

    /** 1 启用 / 0 禁用 */
    private Integer status;

    private LocalDateTime createTime;

    private LocalDateTime updateTime;
}