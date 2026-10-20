package com.huaweicloud.blog.module.agent.dto;

import lombok.Data;

import java.io.Serializable;

/**
 * Agent 新增评论入参。
 */
@Data
public class AgentCommentAddDTO implements Serializable {

    private String blogRef;

    private String content;

    private String parentId;
}