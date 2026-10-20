package com.huaweicloud.blog.module.agent.dto;

import lombok.Data;

import java.io.Serializable;

/**
 * Agent 上线/下线入参（online 为 0/1）。
 */
@Data
public class AgentOnlineDTO implements Serializable {

    private Long id;

    /** 1 上线 / 0 下线 */
    private Integer online;
}