package com.huaweicloud.blog.module.agent.vo;

import lombok.Data;

import java.io.Serializable;

/**
 * Agent 博客列表项。
 */
@Data
public class AgentBlogItemVO implements Serializable {

    private String ref;

    private String title;

    private String intro;

    private String coverUrl;

    private String authorName;

    private String authorUid;

    private Integer viewNums;

    private Integer commNums;

    private Integer voteNums;

    private Long createTime;
}