package com.huaweicloud.blog.module.agent.vo;

import lombok.Data;

import java.io.Serializable;
import java.util.List;

/**
 * Agent 通用分页响应。
 */
@Data
public class AgentPageVO<T> implements Serializable {

    private long total;

    private long pageNo;

    private long pageSize;

    private List<T> list;

    public static <T> AgentPageVO<T> of(long total, long pageNo, long pageSize, List<T> list) {
        AgentPageVO<T> vo = new AgentPageVO<>();
        vo.setTotal(total);
        vo.setPageNo(pageNo);
        vo.setPageSize(pageSize);
        vo.setList(list);
        return vo;
    }
}