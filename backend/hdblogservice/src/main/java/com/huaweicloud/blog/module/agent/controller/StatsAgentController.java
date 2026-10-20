package com.huaweicloud.blog.module.agent.controller;

import com.huaweicloud.blog.common.api.ApiResponse;
import com.huaweicloud.blog.module.manage.controller.StatsController;
import com.huaweicloud.blog.module.manage.vo.StatsVO;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Agent 管理面 - 工作台统计（/agent/admin/stats）。
 */
@Tag(name = "Agent-管理面-统计")
@RestController
@RequestMapping("/agent/admin/stats")
@RequiredArgsConstructor
public class StatsAgentController {

    private final StatsController statsController;

    @Operation(summary = "工作台统计")
    @GetMapping
    public ApiResponse<StatsVO> stats() {
        return statsController.stats();
    }
}