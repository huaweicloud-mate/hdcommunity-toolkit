package com.huaweicloud.blog.module.agent.dto;

import lombok.Data;

import java.io.Serializable;

/**
 * Agent 图片上传入参（base64）。
 */
@Data
public class AgentFileUploadDTO implements Serializable {

    /** 文件名（含扩展名） */
    private String name;

    /** 图片内容 base64（可含 data URI 前缀） */
    private String contentBase64;
}