package com.huaweicloud.blog.module.agent.controller;

import com.huaweicloud.blog.common.api.ApiResponse;
import com.huaweicloud.blog.module.agent.dto.AgentFileUploadDTO;
import com.huaweicloud.blog.module.agent.service.AgentBlogFacade;
import com.huaweicloud.blog.module.agent.vo.AgentFileVO;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Agent 用户面 - 文件（/agent/blog/file/**）。
 */
@Tag(name = "Agent-文件")
@RestController
@RequestMapping("/agent/blog/file")
@RequiredArgsConstructor
public class FileAgentController {

    private final AgentBlogFacade facade;

    @Operation(summary = "上传图片（base64）")
    @PostMapping("/upload")
    public ApiResponse<AgentFileVO> upload(@RequestBody AgentFileUploadDTO dto) {
        return ApiResponse.success(facade.uploadFile(dto.getName(), dto.getContentBase64()));
    }
}