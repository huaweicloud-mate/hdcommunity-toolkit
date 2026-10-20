package com.huaweicloud.blog.module.agent.controller;

import com.huaweicloud.blog.common.api.ApiResponse;
import com.huaweicloud.blog.common.context.UserContext;
import com.huaweicloud.blog.module.agent.dto.AgentDraftSaveDTO;
import com.huaweicloud.blog.module.agent.service.AgentBlogFacade;
import com.huaweicloud.blog.module.agent.vo.AgentDraftVO;
import com.huaweicloud.blog.module.agent.vo.AgentSaveResultVO;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Agent 用户面 - 草稿（/agent/blog/draft/**）。
 */
@Tag(name = "Agent-草稿")
@RestController
@RequestMapping("/agent/blog/draft")
@RequiredArgsConstructor
public class DraftAgentController {

    private final AgentBlogFacade facade;

    @Operation(summary = "草稿列表")
    @GetMapping("/list")
    public ApiResponse<List<AgentDraftVO>> list() {
        return ApiResponse.success(facade.listDrafts(UserContext.current()));
    }

    @Operation(summary = "保存草稿")
    @PostMapping("/save")
    public ApiResponse<AgentSaveResultVO> save(@RequestBody AgentDraftSaveDTO dto) {
        String id = facade.saveDraft(dto.getDraftId(), dto.getTitle(), dto.getContent(), UserContext.current());
        return ApiResponse.success(new AgentSaveResultVO(null, id));
    }

    @Operation(summary = "删除草稿")
    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable String id) {
        facade.deleteDraft(id, UserContext.current());
        return ApiResponse.success();
    }
}