package com.huaweicloud.blog.module.agent.dto;

import lombok.Data;

import java.io.Serializable;

/**
 * Agent 置顶入参（top 为 0/1）。
 */
@Data
public class AgentTopDTO implements Serializable {

    private Long id;

    /** 1 置顶 / 0 取消 */
    private Integer top;
}