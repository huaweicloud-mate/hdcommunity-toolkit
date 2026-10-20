package com.huaweicloud.blog.module.agent.dto;

import lombok.Data;

import java.io.Serializable;

/**
 * Agent 点赞/收藏入参。
 */
@Data
public class AgentOperateDTO implements Serializable {

    private String ref;

    /** 1 操作 / 0 取消 */
    private Integer operationType;
}