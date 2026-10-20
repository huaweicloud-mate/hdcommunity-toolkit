package com.huaweicloud.blog.module.agent.dto;

import lombok.Data;

import java.io.Serializable;
import java.util.List;

/**
 * Agent 批量审核入参（reason 映射到管理面 remark）。
 */
@Data
public class AgentBatchReviewDTO implements Serializable {

    private List<Long> ids;

    /** approve / reject */
    private String action;

    private String reason;
}