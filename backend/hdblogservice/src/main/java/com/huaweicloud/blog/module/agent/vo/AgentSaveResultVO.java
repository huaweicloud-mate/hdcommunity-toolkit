package com.huaweicloud.blog.module.agent.vo;

import lombok.Data;

import java.io.Serializable;

/**
 * Agent 发布/保存结果。
 */
@Data
public class AgentSaveResultVO implements Serializable {

    private String ref;

    private String id;

    public AgentSaveResultVO() {
    }

    public AgentSaveResultVO(String ref, String id) {
        this.ref = ref;
        this.id = id;
    }
}