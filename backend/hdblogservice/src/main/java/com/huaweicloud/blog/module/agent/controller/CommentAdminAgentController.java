package com.huaweicloud.blog.module.agent.controller;

import com.baomidou.mybatisplus.core.metadata.IPage;
import com.huaweicloud.blog.common.api.ApiResponse;
import com.huaweicloud.blog.module.agent.dto.AgentBatchReviewDTO;
import com.huaweicloud.blog.module.agent.dto.AgentOnlineDTO;
import com.huaweicloud.blog.module.agent.dto.AgentReviewDTO;
import com.huaweicloud.blog.module.manage.controller.CommentManageController;
import com.huaweicloud.blog.module.manage.dto.BatchReviewRequest;
import com.huaweicloud.blog.module.manage.dto.OnlineRequest;
import com.huaweicloud.blog.module.manage.dto.ReviewRequest;
import com.huaweicloud.blog.module.manage.vo.CommentVO;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Agent 管理面 - 评论审核/上下线（/agent/admin/comment/**）。复用管理台 Controller（含审计记录）。
 */
@Tag(name = "Agent-管理面-评论")
@RestController
@RequestMapping("/agent/admin/comment")
@RequiredArgsConstructor
public class CommentAdminAgentController {

    private final CommentManageController commentManageController;

    @Operation(summary = "评论分页")
    @GetMapping("/page")
    public ApiResponse<IPage<CommentVO>> page(
            @RequestParam(value = "page_no", defaultValue = "1") long pageNo,
            @RequestParam(value = "page_size", defaultValue = "10") long pageSize,
            @RequestParam(value = "status", required = false) Integer status,
            @RequestParam(value = "online", required = false) Integer online,
            @RequestParam(value = "keyword", required = false) String keyword) {
        return commentManageController.page(pageNo, pageSize, status, online, keyword);
    }

    @Operation(summary = "评论审核")
    @PostMapping("/review")
    public ApiResponse<Void> review(@RequestBody AgentReviewDTO dto) {
        ReviewRequest request = new ReviewRequest();
        request.setId(dto.getId());
        request.setAction(dto.getAction());
        request.setRemark(dto.getReason());
        return commentManageController.review(request);
    }

    @Operation(summary = "评论批量审核")
    @PostMapping("/review/batch")
    public ApiResponse<Integer> reviewBatch(@RequestBody AgentBatchReviewDTO dto) {
        BatchReviewRequest request = new BatchReviewRequest();
        request.setIds(dto.getIds());
        request.setAction(dto.getAction());
        request.setRemark(dto.getReason());
        return commentManageController.reviewBatch(request);
    }

    @Operation(summary = "评论上线/下线")
    @PostMapping("/online")
    public ApiResponse<Void> online(@RequestBody AgentOnlineDTO dto) {
        OnlineRequest request = new OnlineRequest();
        request.setId(dto.getId());
        request.setOnline(dto.getOnline() != null && dto.getOnline() == 1);
        return commentManageController.online(request);
    }
}