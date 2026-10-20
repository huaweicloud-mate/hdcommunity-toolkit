package com.huaweicloud.blog.module.agent.controller;

import com.huaweicloud.blog.common.api.ApiResponse;
import com.huaweicloud.blog.common.context.UserContext;
import com.huaweicloud.blog.module.agent.dto.AgentCommentAddDTO;
import com.huaweicloud.blog.module.agent.dto.AgentCommentEditDTO;
import com.huaweicloud.blog.module.agent.service.AgentBlogFacade;
import com.huaweicloud.blog.module.agent.vo.AgentCommentListVO;
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
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Agent 用户面 - 评论（/agent/blog/comment/**）。
 */
@Tag(name = "Agent-评论")
@RestController
@RequestMapping("/agent/blog/comment")
@RequiredArgsConstructor
public class CommentAgentController {

    private final AgentBlogFacade facade;

    @Operation(summary = "评论列表")
    @GetMapping("/list")
    public ApiResponse<AgentCommentListVO> list(
            @RequestParam String id,
            @RequestParam(defaultValue = "1") Integer level,
            @RequestParam(name = "page_no", defaultValue = "1") long pageNo,
            @RequestParam(name = "page_size", defaultValue = "20") long pageSize) {
        return ApiResponse.success(facade.listComments(id, level, pageNo, pageSize));
    }

    @Operation(summary = "新增评论")
    @PostMapping("/add")
    public ApiResponse<AgentSaveResultVO> add(@RequestBody AgentCommentAddDTO dto) {
        String id = facade.addComment(dto.getBlogRef(), dto.getContent(), dto.getParentId(), UserContext.current());
        return ApiResponse.success(new AgentSaveResultVO(null, id));
    }

    @Operation(summary = "编辑评论")
    @PostMapping("/edit")
    public ApiResponse<Void> edit(@RequestBody AgentCommentEditDTO dto) {
        facade.editComment(dto.getCommentId(), dto.getContent(), UserContext.current());
        return ApiResponse.success();
    }

    @Operation(summary = "删除评论")
    @DeleteMapping("/{commentId}")
    public ApiResponse<Void> delete(@PathVariable String commentId) {
        facade.deleteComment(commentId, UserContext.current());
        return ApiResponse.success();
    }
}