package com.huaweicloud.blog.module.agent.dto;

import lombok.Data;

import java.io.Serializable;

/**
 * Agent 编辑评论入参。
 */
@Data
public class AgentCommentEditDTO implements Serializable {

    private String commentId;

    private String content;
}