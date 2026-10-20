package com.huaweicloud.blog.common.security;

/**
 * Agent 请求身份（由 AgentAuthFilter 解析 AK/SK 后写入 request attribute）。
 *
 * @param domainId   华为云账号 ID（身份主键）
 * @param domainName 华为云账号名
 * @param projectId  项目 ID（可选）
 * @param region     区域
 */
public record AgentPrincipal(String domainId, String domainName, String projectId, String region) {

    public static final String ATTR = "AGENT_PRINCIPAL";
}