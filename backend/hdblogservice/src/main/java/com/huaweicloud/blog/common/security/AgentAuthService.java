package com.huaweicloud.blog.common.security;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.huaweicloud.blog.common.api.ErrorCode;
import com.huaweicloud.blog.common.exception.BusinessException;
import com.huaweicloud.blog.config.BlogConfig;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Map;

/**
 * 以 AK/SK 调用 IAM {@code GET /v3/auth/domains}，解析出 domainId/domainName。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AgentAuthService {

    private final BlogConfig config;
    private final ObjectMapper objectMapper;

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();

    /**
     * 校验 AK/SK 并换取账号身份。
     */
    public AgentPrincipal authenticate(String ak, String sk, String securityToken, String projectId, String region) {
        String url = config.iamDomainsEndpoint().replaceAll("/+$", "") + "/v3/auth/domains";
        Map<String, String> headers = HwSigner.sign("GET", url, ak, sk, securityToken);
        HttpRequest.Builder builder = HttpRequest.newBuilder(URI.create(url))
                .GET()
                .timeout(Duration.ofSeconds(15))
                .header("Accept", "application/json");
        headers.forEach(builder::header);

        HttpResponse<String> response;
        try {
            response = httpClient.send(builder.build(), HttpResponse.BodyHandlers.ofString());
        } catch (Exception e) {
            log.warn("IAM domains request failed: {}", e.getMessage());
            throw new BusinessException(ErrorCode.AGENT_AUTH_FAILED, "AK/SK 认证失败：无法连接 IAM");
        }
        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            log.warn("IAM domains returned status {}", response.statusCode());
            throw new BusinessException(ErrorCode.AGENT_AUTH_FAILED, "AK/SK 无效或认证失败");
        }
        try {
            JsonNode root = objectMapper.readTree(response.body());
            JsonNode domains = root.path("domains");
            if (domains.isArray() && !domains.isEmpty()) {
                JsonNode d = domains.get(0);
                return new AgentPrincipal(text(d, "id"), text(d, "name"), projectId, region);
            }
            JsonNode domain = root.path("domain");
            if (!domain.isMissingNode()) {
                return new AgentPrincipal(text(domain, "id"), text(domain, "name"), projectId, region);
            }
        } catch (Exception e) {
            log.warn("Parse IAM domains response failed: {}", e.getMessage());
        }
        throw new BusinessException(ErrorCode.AGENT_AUTH_FAILED, "未能解析账号信息");
    }

    private String text(JsonNode node, String field) {
        JsonNode v = node.path(field);
        return v.isMissingNode() || v.isNull() ? null : v.asText();
    }
}