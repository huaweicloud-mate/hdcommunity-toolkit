package com.huaweicloud.blog.module.manage.controller;

import com.huaweicloud.blog.common.api.ApiResponse;
import com.huaweicloud.blog.common.api.ErrorCode;
import com.huaweicloud.blog.common.exception.BusinessException;
import com.huaweicloud.blog.common.security.AdminContext;
import com.huaweicloud.blog.common.security.TokenService;
import com.huaweicloud.blog.common.util.RateLimitUtil;
import com.huaweicloud.blog.config.BlogConfig;
import com.huaweicloud.blog.module.manage.dto.LoginRequest;
import com.huaweicloud.blog.module.manage.entity.AdminUser;
import com.huaweicloud.blog.module.manage.service.AdminUserService;
import com.huaweicloud.blog.module.manage.service.RolePermissionService;
import com.huaweicloud.blog.module.manage.vo.LoginVO;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.*;

/**
 * 管理台登录（合并后路径 /manage/auth/**）。
 */
@RestController
@RequestMapping("/manage/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AdminUserService adminUserService;
    private final TokenService tokenService;
    private final RateLimitUtil rateLimitUtil;
    private final RolePermissionService rolePermissionService;
    private final BlogConfig config;

    @PostMapping("/login")
    public ApiResponse<LoginVO> login(@RequestBody @Valid LoginRequest request, HttpServletRequest httpRequest) {
        String ip = clientIp(httpRequest);
        if (!rateLimitUtil.allow("blog:manage:login:" + ip, config.loginRateLimitCount(), config.loginRateLimitWindow())) {
            throw new BusinessException(ErrorCode.RATE_LIMITED);
        }
        AdminUser user = adminUserService.login(request.getUsername(), request.getPassword());
        String role = rolePermissionService.roleOf(user.getUsername());
        AdminContext context = new AdminContext(user.getId(), user.getUsername(), user.getNickName(), role);
        String token = tokenService.issue(context);

        LoginVO vo = new LoginVO();
        vo.setToken(token);
        vo.setUser(new LoginVO.UserInfo(user.getId(), user.getUsername(), user.getNickName(), role));
        return ApiResponse.success(vo);
    }

    @PostMapping("/logout")
    public ApiResponse<Void> logout(@RequestHeader(value = "Authorization", required = false) String authorization) {
        if (StringUtils.hasText(authorization)) {
            tokenService.revoke(authorization.startsWith("Bearer ") ? authorization.substring(7) : authorization);
        }
        return ApiResponse.success();
    }

    private String clientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (StringUtils.hasText(forwarded)) {
            return forwarded.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }
}
