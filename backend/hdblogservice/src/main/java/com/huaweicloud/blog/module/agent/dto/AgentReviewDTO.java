package com.huaweicloud.blog.module.agent.dto;

import lombok.Data;

import java.io.Serializable;

/**
 * Agent 单条审核入参（reason 映射到管理面 remark）。
 */
@Data
public class AgentReviewDTO implements Serializable {

    private Long id;

    /** approve / reject */
    private String action;

    private String reason;
}