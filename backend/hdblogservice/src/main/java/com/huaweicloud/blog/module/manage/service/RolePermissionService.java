package com.huaweicloud.blog.module.manage.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.huaweicloud.blog.module.manage.entity.CommunityOperator;
import com.huaweicloud.blog.module.manage.entity.CommunityRoleTool;
import com.huaweicloud.blog.module.manage.mapper.CommunityOperatorMapper;
import com.huaweicloud.blog.module.manage.mapper.CommunityRoleToolMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

/**
 * Agent 管理面权限：账号 → 角色 → MCP 工具白名单。
 * <p>super_admin 拥有全部 admin_* 权限；未配置操作员的账号无任何权限。
 */
@Service
@RequiredArgsConstructor
public class RolePermissionService {

    public static final String SUPER_ADMIN = "super_admin";

    private final CommunityOperatorMapper operatorMapper;
    private final CommunityRoleToolMapper roleToolMapper;

    /** 查询账号角色码，无则返回 null。 */
    public String roleOf(String username) {
        if (!StringUtils.hasText(username)) {
            return null;
        }
        CommunityOperator op = operatorMapper.selectOne(new LambdaQueryWrapper<CommunityOperator>()
                .eq(CommunityOperator::getAdminUsername, username)
                .eq(CommunityOperator::getStatus, 1)
                .last("limit 1"));
        return op == null ? null : op.getRole();
    }

    /** 判定角色是否允许调用指定 MCP 工具。 */
    public boolean isAllowed(String role, String toolName) {
        if (!StringUtils.hasText(role) || !StringUtils.hasText(toolName)) {
            return false;
        }
        if (SUPER_ADMIN.equals(role)) {
            return true;
        }
        Long count = roleToolMapper.selectCount(new LambdaQueryWrapper<CommunityRoleTool>()
                .eq(CommunityRoleTool::getRole, role)
                .eq(CommunityRoleTool::getToolName, toolName)
                .eq(CommunityRoleTool::getAllow, 1));
        return count != null && count > 0;
    }
}