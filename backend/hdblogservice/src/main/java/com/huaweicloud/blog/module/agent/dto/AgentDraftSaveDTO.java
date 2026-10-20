package com.huaweicloud.blog.module.agent.dto;

import lombok.Data;

import java.io.Serializable;

/**
 * Agent 草稿保存入参。
 */
@Data
public class AgentDraftSaveDTO implements Serializable {

    private String draftId;

    private String title;

    private String content;
}