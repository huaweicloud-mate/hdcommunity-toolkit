package com.huaweicloud.blog.module.agent.vo;

import lombok.Data;

import java.io.Serializable;

/**
 * Agent 用户统计。
 */
@Data
public class AgentUserStatVO implements Serializable {

    private long blogCount;

    private long viewTotal;

    private long voteTotal;
}