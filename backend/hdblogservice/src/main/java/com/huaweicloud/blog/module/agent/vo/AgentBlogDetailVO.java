package com.huaweicloud.blog.module.agent.vo;

import lombok.Data;

import java.io.Serializable;

/**
 * Agent 博客详情。
 */
@Data
public class AgentBlogDetailVO implements Serializable {

    private String ref;

    private String title;

    private String content;

    private String intro;

    private String coverUrl;

    private String authorUid;

    private String authorName;

    private Long createTime;

    /** 0草稿 1待审 2通过 3驳回 */
    private Integer status;

    private Integer online;

    private Integer isTop;

    private String reviewRemark;

    private Integer viewNums;

    private Integer commNums;

    private Integer voteNums;
}