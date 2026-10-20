package com.huaweicloud.blog.module.agent.vo;

import lombok.Data;

import java.io.Serializable;
import java.util.List;

/**
 * Agent 评论列表响应。
 */
@Data
public class AgentCommentListVO implements Serializable {

    private long total;

    private List<AgentCommentItemVO> list;
}