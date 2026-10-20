package com.huaweicloud.blog.module.agent.controller;

import com.baomidou.mybatisplus.core.metadata.IPage;
import com.huaweicloud.blog.common.api.ApiResponse;
import com.huaweicloud.blog.module.agent.dto.AgentBatchReviewDTO;
import com.huaweicloud.blog.module.agent.dto.AgentOnlineDTO;
import com.huaweicloud.blog.module.agent.dto.AgentReviewDTO;
import com.huaweicloud.blog.module.agent.dto.AgentTopDTO;
import com.huaweicloud.blog.module.manage.controller.BlogManageController;
import com.huaweicloud.blog.module.manage.dto.BatchReviewRequest;
import com.huaweicloud.blog.module.manage.dto.OnlineRequest;
import com.huaweicloud.blog.module.manage.dto.ReviewRequest;
import com.huaweicloud.blog.module.manage.dto.TopRequest;
import com.huaweicloud.blog.module.manage.entity.BlogReviewRecord;
import com.huaweicloud.blog.module.manage.vo.BlogVO;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Agent 管理面 - 博客审核/上下线/置顶（/agent/admin/blog/**）。复用管理台 Controller（含审计记录）。
 */
@Tag(name = "Agent-管理面-博客")
@RestController
@RequestMapping("/agent/admin/blog")
@RequiredArgsConstructor
public class BlogAdminAgentController {

    private final BlogManageController blogManageController;

    @Operation(summary = "博客分页")
    @GetMapping("/page")
    public ApiResponse<IPage<BlogVO>> page(
            @RequestParam(value = "page_no", defaultValue = "1") long pageNo,
            @RequestParam(value = "page_size", defaultValue = "10") long pageSize,
            @RequestParam(value = "status", required = false) Integer status,
            @RequestParam(value = "online", required = false) Integer online,
            @RequestParam(value = "keyword", required = false) String keyword) {
        return blogManageController.page(pageNo, pageSize, status, online, keyword);
    }

    @Operation(summary = "博客审核")
    @PostMapping("/review")
    public ApiResponse<Void> review(@RequestBody AgentReviewDTO dto) {
        ReviewRequest request = new ReviewRequest();
        request.setId(dto.getId());
        request.setAction(dto.getAction());
        request.setRemark(dto.getReason());
        return blogManageController.review(request);
    }

    @Operation(summary = "博客批量审核")
    @PostMapping("/review/batch")
    public ApiResponse<Integer> reviewBatch(@RequestBody AgentBatchReviewDTO dto) {
        BatchReviewRequest request = new BatchReviewRequest();
        request.setIds(dto.getIds());
        request.setAction(dto.getAction());
        request.setRemark(dto.getReason());
        return blogManageController.reviewBatch(request);
    }

    @Operation(summary = "博客上线/下线")
    @PostMapping("/online")
    public ApiResponse<Void> online(@RequestBody AgentOnlineDTO dto) {
        OnlineRequest request = new OnlineRequest();
        request.setId(dto.getId());
        request.setOnline(dto.getOnline() != null && dto.getOnline() == 1);
        return blogManageController.online(request);
    }

    @Operation(summary = "博客置顶")
    @PostMapping("/top")
    public ApiResponse<Void> top(@RequestBody AgentTopDTO dto) {
        TopRequest request = new TopRequest();
        request.setId(dto.getId());
        request.setTop(dto.getTop() != null && dto.getTop() == 1);
        return blogManageController.top(request);
    }

    @Operation(summary = "博客审核记录")
    @GetMapping("/{id}/records")
    public ApiResponse<IPage<BlogReviewRecord>> records(
            @PathVariable Long id,
            @RequestParam(value = "page_no", defaultValue = "1") long pageNo,
            @RequestParam(value = "page_size", defaultValue = "10") long pageSize) {
        return blogManageController.records(id, pageNo, pageSize);
    }
}