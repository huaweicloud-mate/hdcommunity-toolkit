package com.huaweicloud.blog.common.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.huaweicloud.blog.common.api.ApiResponse;
import com.huaweicloud.blog.common.api.ErrorCode;
import com.huaweicloud.blog.config.BlogConfig;
import com.huaweicloud.blog.module.manage.service.RolePermissionService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.servlet.HandlerInterceptor;

import java.nio.charset.StandardCharsets;

/**
 * Agent 管理面鉴权：校验 {@code Authorization: Bearer <token>}，写入 {@link AdminContext}，
 * 并按「路径 → MCP 工具名 → 角色白名单」判定权限。仅注册到 {@code /agent/admin/**}（login 除外）。
 */
@Component
@RequiredArgsConstructor
public class AgentAdminInterceptor implements HandlerInterceptor {

    private final TokenService tokenService;
    private final RolePermissionService rolePermissionService;
    private final ObjectMapper objectMapper;
    private final BlogConfig config;

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler)
            throws Exception {
        if (!config.authEnabled() || HttpMethod.OPTIONS.matches(request.getMethod())) {
            return true;
        }
        AdminContext adminContext = tokenService.get(resolveToken(request));
        if (adminContext == null) {
            writeError(response, ErrorCode.UNAUTHORIZED);
            return false;
        }
        request.setAttribute(AdminContext.ATTR, adminContext);

        String tool = toolNameFor(request);
        if (tool != null && !rolePermissionService.isAllowed(adminContext.role(), tool)) {
            writeError(response, ErrorCode.ADMIN_ROLE_DENIED);
            return false;
        }
        return true;
    }

    /**
     * 请求路径 → MCP 工具名；无需鉴权的接口（如 logout）返回 null。
     */
    static String toolNameFor(HttpServletRequest request) {
        String path = request.getServletPath();
        if (!StringUtils.hasText(path)) {
            path = request.getRequestURI().substring(request.getContextPath().length());
        }
        return switch (path) {
            case "/agent/admin/blog/page" -> "hdcommunity_admin_blog_page";
            case "/agent/admin/blog/review" -> "hdcommunity_admin_blog_review";
            case "/agent/admin/blog/review/batch" -> "hdcommunity_admin_blog_review_batch";
            case "/agent/admin/blog/online" -> "hdcommunity_admin_blog_online";
            case "/agent/admin/blog/top" -> "hdcommunity_admin_blog_top";
            case "/agent/admin/comment/page" -> "hdcommunity_admin_comment_page";
            case "/agent/admin/comment/review" -> "hdcommunity_admin_comment_review";
            case "/agent/admin/comment/review/batch" -> "hdcommunity_admin_comment_review_batch";
            case "/agent/admin/comment/online" -> "hdcommunity_admin_comment_online";
            case "/agent/admin/stats" -> "hdcommunity_admin_stats";
            default -> path.startsWith("/agent/admin/blog/") && path.endsWith("/records")
                    ? "hdcommunity_admin_blog_records"
                    : null;
        };
    }

    private String resolveToken(HttpServletRequest request) {
        String header = request.getHeader("Authorization");
        if (!StringUtils.hasText(header)) {
            return null;
        }
        return header.startsWith("Bearer ") ? header.substring(7) : header;
    }

    private void writeError(HttpServletResponse response, ErrorCode errorCode) throws Exception {
        response.setStatus(errorCode.getHttpStatus());
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.getWriter().write(objectMapper.writeValueAsString(ApiResponse.error(errorCode)));
    }
}