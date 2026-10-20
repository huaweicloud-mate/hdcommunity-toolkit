package com.huaweicloud.blog.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * 服务配置（用户面 + 管理台合并后）—— 环境变量注入（带默认值）。
 */
@Component
public class BlogConfig {

    // CORS：用户面(3008) + 管理台(3007) + 华为云子域
    @Value("${CORS_ORIGINS:https://*.huaweicloud.com,https://localhost.huaweicloud.com:3007,http://localhost:3007,https://localhost.huaweicloud.com:3008,http://localhost:3008}")
    private String corsAllowedOrigins;

    // 管理台登录态校验
    @Value("${manage.auth.enabled:${AUTH_ENABLED:true}}")
    private boolean authEnabled;
    @Value("${manage.auth.token-ttl-minutes:${AUTH_TOKEN_TTL_MINUTES:120}}")
    private long tokenTtlMinutes;

    // 管理台登录流控
    @Value("${manage.login.rate-limit-count:${LOGIN_RATE_LIMIT_COUNT:20}}")
    private int loginRateLimitCount;
    @Value("${manage.login.rate-limit-window-seconds:${LOGIN_RATE_LIMIT_WINDOW:60}}")
    private long loginRateLimitWindow;

    // Agent 用户面认证（AK/SK -> IAM 换 domainId）
    @Value("${agent.auth.enabled:${AGENT_AUTH_ENABLED:true}}")
    private boolean agentAuthEnabled;
    @Value("${agent.iam-domains-endpoint:${IAM_DOMAINS_ENDPOINT:https://iam.myhuaweicloud.com}}")
    private String iamDomainsEndpoint;

    // Agent 用户面流控（按 domainId 维度）
    @Value("${agent.rate-limit-count:${AGENT_RATE_LIMIT_COUNT:600}}")
    private int agentRateLimitCount;
    @Value("${agent.rate-limit-window-seconds:${AGENT_RATE_LIMIT_WINDOW:60}}")
    private long agentRateLimitWindow;

    public String corsAllowedOrigins() {
        return corsAllowedOrigins;
    }

    public boolean authEnabled() {
        return authEnabled;
    }

    public long tokenTtlMinutes() {
        return tokenTtlMinutes;
    }

    public int loginRateLimitCount() {
        return loginRateLimitCount;
    }

    public long loginRateLimitWindow() {
        return loginRateLimitWindow;
    }

    public boolean agentAuthEnabled() {
        return agentAuthEnabled;
    }

    public String iamDomainsEndpoint() {
        return iamDomainsEndpoint;
    }

    public int agentRateLimitCount() {
        return agentRateLimitCount;
    }

    public long agentRateLimitWindow() {
        return agentRateLimitWindow;
    }
}
