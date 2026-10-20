package com.huaweicloud.blog.module.agent.vo;

import lombok.Data;

import java.io.Serializable;

/**
 * Agent 用户个人信息。
 */
@Data
public class AgentUserProfileVO implements Serializable {

    private String uid;

    private String memAlias;

    private String memName;

    private String memPhoto;
}