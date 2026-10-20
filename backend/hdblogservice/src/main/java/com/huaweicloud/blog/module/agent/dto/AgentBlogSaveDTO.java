package com.huaweicloud.blog.module.agent.dto;

import lombok.Data;

import java.io.Serializable;

/**
 * Agent 博客发布/编辑入参。ref 为空表示新建。
 */
@Data
public class AgentBlogSaveDTO implements Serializable {

    private String ref;

    private String title;

    private String content;

    private String intro;

    private String coverUrl;
}