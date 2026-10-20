package com.huaweicloud.blog.module.agent.controller;

import com.huaweicloud.blog.common.api.ApiResponse;
import com.huaweicloud.blog.module.agent.service.AgentBlogFacade;
import com.huaweicloud.blog.module.agent.vo.AgentBlogDetailVO;
import com.huaweicloud.blog.module.agent.vo.AgentBlogItemVO;
import com.huaweicloud.blog.module.agent.vo.AgentPageVO;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Agent 数据展示面（/agent/show/**）：公开只读，无鉴权。
 */
@Tag(name = "Agent-展示")
@RestController
@RequestMapping("/agent/show/blog")
@RequiredArgsConstructor
public class ShowAgentController {

    private final AgentBlogFacade facade;

    @Operation(summary = "公开博客列表")
    @GetMapping("/list")
    public ApiResponse<AgentPageVO<AgentBlogItemVO>> list(
            @RequestParam(name = "page_no", defaultValue = "1") long pageNo,
            @RequestParam(name = "page_size", defaultValue = "20") long pageSize,
            @RequestParam(name = "key_word", required = false) String keyWord) {
        return ApiResponse.success(facade.listBlogs(null, pageNo, pageSize, keyWord));
    }

    @Operation(summary = "公开博客详情")
    @GetMapping("/detail")
    public ApiResponse<AgentBlogDetailVO> detail(@RequestParam String ref) {
        return ApiResponse.success(facade.detail(ref, false, null));
    }
}