package com.huaweicloud.blog.common.security;

/**
 * 管理台登录管理员上下文，由 AuthInterceptor / AgentAdminInterceptor 写入 request attribute。
 *
 * @param role 角色码（见 hd_community_operator），为空表示无 Agent 管理面权限
 */
public record AdminContext(Long adminId, String username, String nickName, String role) {

    public static final String ATTR = "adminContext";

    public String displayName() {
        return nickName == null || nickName.isBlank() ? username : nickName;
    }
}