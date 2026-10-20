package com.huaweicloud.blog.module.agent.controller;

import com.huaweicloud.blog.common.api.ApiResponse;
import com.huaweicloud.blog.common.context.UserContext;
import com.huaweicloud.blog.module.agent.dto.AgentBlogSaveDTO;
import com.huaweicloud.blog.module.agent.dto.AgentFollowDTO;
import com.huaweicloud.blog.module.agent.dto.AgentOperateDTO;
import com.huaweicloud.blog.module.agent.service.AgentBlogFacade;
import com.huaweicloud.blog.module.agent.vo.AgentBlogDetailVO;
import com.huaweicloud.blog.module.agent.vo.AgentBlogItemVO;
import com.huaweicloud.blog.module.agent.vo.AgentPageVO;
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
 * Agent 用户面 - 博客（/agent/blog/**）。身份由 AgentAuthFilter 注入 UserContext。
 */
@Tag(name = "Agent-博客")
@RestController
@RequestMapping("/agent/blog")
@RequiredArgsConstructor
public class BlogAgentController {

    private final AgentBlogFacade facade;

    @Operation(summary = "博客列表")
    @GetMapping("/list")
    public ApiResponse<AgentPageVO<AgentBlogItemVO>> list(
            @RequestParam(required = false) Integer type,
            @RequestParam(name = "page_no", defaultValue = "1") long pageNo,
            @RequestParam(name = "page_size", defaultValue = "20") long pageSize,
            @RequestParam(name = "key_word", required = false) String keyWord) {
        return ApiResponse.success(facade.listBlogs(type, pageNo, pageSize, keyWord));
    }

    @Operation(summary = "我的博客")
    @GetMapping("/mine")
    public ApiResponse<AgentPageVO<AgentBlogItemVO>> mine(
            @RequestParam(required = false) Integer status,
            @RequestParam(name = "page_no", defaultValue = "1") long pageNo,
            @RequestParam(name = "page_size", defaultValue = "20") long pageSize) {
        return ApiResponse.success(facade.myBlogs(status, pageNo, pageSize, UserContext.current()));
    }

    @Operation(summary = "我的收藏")
    @GetMapping("/favorites")
    public ApiResponse<AgentPageVO<AgentBlogItemVO>> favorites(
            @RequestParam(name = "page_no", defaultValue = "1") long pageNo,
            @RequestParam(name = "page_size", defaultValue = "20") long pageSize) {
        return ApiResponse.success(facade.favorites(pageNo, pageSize, UserContext.current()));
    }

    @Operation(summary = "博客详情")
    @GetMapping("/detail")
    public ApiResponse<AgentBlogDetailVO> detail(
            @RequestParam String ref,
            @RequestParam(name = "log_view", defaultValue = "false") boolean logView) {
        return ApiResponse.success(facade.detail(ref, logView, UserContext.current()));
    }

    @Operation(summary = "发布/编辑博客")
    @PostMapping("/save")
    public ApiResponse<AgentSaveResultVO> save(@RequestBody AgentBlogSaveDTO dto) {
        return ApiResponse.success(facade.save(dto, UserContext.current()));
    }

    @Operation(summary = "删除博客")
    @DeleteMapping("/{ref}")
    public ApiResponse<Void> delete(@PathVariable String ref) {
        facade.deleteBlog(ref, UserContext.current());
        return ApiResponse.success();
    }

    @Operation(summary = "点赞/取消点赞")
    @PostMapping("/vote")
    public ApiResponse<Void> vote(@RequestBody AgentOperateDTO dto) {
        facade.vote(dto.getRef(), dto.getOperationType(), UserContext.current());
        return ApiResponse.success();
    }

    @Operation(summary = "收藏/取消收藏")
    @PostMapping("/favorite")
    public ApiResponse<Void> favorite(@RequestBody AgentOperateDTO dto) {
        facade.favorite(dto.getRef(), dto.getOperationType(), UserContext.current());
        return ApiResponse.success();
    }

    @Operation(summary = "关注/取消关注作者")
    @PostMapping("/follow")
    public ApiResponse<Void> follow(@RequestBody AgentFollowDTO dto) {
        facade.follow(dto.getAuthorUid(), dto.getOperationType(), UserContext.current());
        return ApiResponse.success();
    }
}