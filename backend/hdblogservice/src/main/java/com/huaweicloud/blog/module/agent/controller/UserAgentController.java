package com.huaweicloud.blog.module.agent.controller;

import com.huaweicloud.blog.common.api.ApiResponse;
import com.huaweicloud.blog.common.context.UserContext;
import com.huaweicloud.blog.module.agent.service.AgentBlogFacade;
import com.huaweicloud.blog.module.agent.vo.AgentUserProfileVO;
import com.huaweicloud.blog.module.agent.vo.AgentUserStatVO;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Agent 用户面 - 用户（/agent/blog/user/**）。
 */
@Tag(name = "Agent-用户")
@RestController
@RequestMapping("/agent/blog/user")
@RequiredArgsConstructor
public class UserAgentController {

    private final AgentBlogFacade facade;

    @Operation(summary = "个人信息")
    @GetMapping("/profile")
    public ApiResponse<AgentUserProfileVO> profile() {
        return ApiResponse.success(facade.profile(UserContext.current()));
    }

    @Operation(summary = "个人统计")
    @GetMapping("/stat")
    public ApiResponse<AgentUserStatVO> stat() {
        return ApiResponse.success(facade.stat(UserContext.current()));
    }
}