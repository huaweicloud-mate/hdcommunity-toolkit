package com.huaweicloud.blog.module.agent.vo;

import lombok.Data;

import java.io.Serializable;
import java.util.List;

/**
 * Agent 评论项。status：1待审 2通过 3驳回（由库内 state 归一化）。
 */
@Data
public class AgentCommentItemVO implements Serializable {

    private String id;

    private String blogRef;

    private String content;

    private String authorName;

    private String authorPhoto;

    private Long createTime;

    private Integer status;

    private List<AgentCommentItemVO> children;
}