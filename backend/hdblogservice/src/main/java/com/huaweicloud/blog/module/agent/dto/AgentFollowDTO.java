package com.huaweicloud.blog.module.agent.dto;

import lombok.Data;

import java.io.Serializable;

/**
 * Agent 关注入参。
 */
@Data
public class AgentFollowDTO implements Serializable {

    private String authorUid;

    /** 1 关注 / 0 取消 */
    private Integer operationType;
}