package com.huaweicloud.blog.module.agent.vo;

import lombok.Data;

import java.io.Serializable;

/**
 * Agent 草稿项。
 */
@Data
public class AgentDraftVO implements Serializable {

    private String id;

    private String title;

    private String content;

    private Long updateTime;
}