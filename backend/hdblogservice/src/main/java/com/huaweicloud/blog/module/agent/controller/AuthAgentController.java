package com.huaweicloud.blog.module.agent.controller;

import com.huaweicloud.blog.common.api.ApiResponse;
import com.huaweicloud.blog.module.manage.controller.AuthController;
import com.huaweicloud.blog.module.manage.dto.LoginRequest;
import com.huaweicloud.blog.module.manage.vo.LoginVO;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Agent 管理面 - 登录/注销（/agent/admin/**）。复用现有管理台登录逻辑（含流控与角色）。
 */
@Tag(name = "Agent-管理面-认证")
@RestController
@RequestMapping("/agent/admin")
@RequiredArgsConstructor
public class AuthAgentController {

    private final AuthController authController;

    @Operation(summary = "管理面登录")
    @PostMapping("/login")
    public ApiResponse<LoginVO> login(@RequestBody @Valid LoginRequest request, HttpServletRequest httpRequest) {
        return authController.login(request, httpRequest);
    }

    @Operation(summary = "管理面注销")
    @PostMapping("/logout")
    public ApiResponse<Void> logout(@RequestHeader(value = "Authorization", required = false) String authorization) {
        return authController.logout(authorization);
    }
}