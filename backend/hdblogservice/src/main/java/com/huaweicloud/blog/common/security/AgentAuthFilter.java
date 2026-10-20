package com.huaweicloud.blog.common.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.huaweicloud.blog.common.api.ApiResponse;
import com.huaweicloud.blog.common.api.ErrorCode;
import com.huaweicloud.blog.common.context.UserContext;
import com.huaweicloud.blog.common.exception.BusinessException;
import com.huaweicloud.blog.common.util.RateLimitUtil;
import com.huaweicloud.blog.config.BlogConfig;
import com.huaweicloud.blog.module.blog.entity.BlogUser;
import com.huaweicloud.blog.module.blog.service.BlogUserService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Agent 用户面认证过滤器：拦截 {@code /agent/blog/**}。
 * <p>
 * 校验 {@code X-HW-AK}(必) / {@code X-HW-SK}(必) / {@code X-HW-Security-Token}(可选)，
 * 经 IAM 换取 domainId，写入 {@link AgentPrincipal} 与 {@link UserContext}。
 * 展示面 {@code /agent/show/**} 与管理面 {@code /agent/admin/**} 不在本过滤器范围内。
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class AgentAuthFilter extends OncePerRequestFilter {

    private static final String AK_HEADER = "X-HW-AK";
    private static final String SK_HEADER = "X-HW-SK";
    private static final String SECURITY_TOKEN_HEADER = "X-HW-Security-Token";
    private static final String PROJECT_ID_HEADER = "X-HW-PROJECT-ID";
    private static final String REGION_HEADER = "X-HW-REGION";
    private static final long CACHE_TTL_MS = 5 * 60 * 1000L;

    private final BlogConfig config;
    private final ObjectMapper objectMapper;
    private final AgentAuthService agentAuthService;
    private final BlogUserService blogUserService;
    private final RateLimitUtil rateLimitUtil;

    /** AK -> 认证结果缓存，避免每次工具调用都请求 IAM。 */
    private final ConcurrentHashMap<String, CachedPrincipal> cache = new ConcurrentHashMap<>();

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !request.getRequestURI().contains("/agent/blog/");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        if (HttpMethod.OPTIONS.matches(request.getMethod())) {
            chain.doFilter(request, response);
            return;
        }
        if (!config.agentAuthEnabled()) {
            resolveDefaultUser();
            try {
                chain.doFilter(request, response);
            } finally {
                UserContext.clear();
            }
            return;
        }

        String ak = header(request, AK_HEADER);
        String sk = header(request, SK_HEADER);
        if (!StringUtils.hasText(ak)) {
            writeError(response, ErrorCode.AUTH_AK_MISSING);
            return;
        }
        if (!StringUtils.hasText(sk)) {
            writeError(response, ErrorCode.AUTH_SK_MISSING);
            return;
        }

        AgentPrincipal principal;
        BlogUser user;
        try {
            principal = resolvePrincipal(ak, sk, header(request, SECURITY_TOKEN_HEADER),
                    header(request, PROJECT_ID_HEADER), header(request, REGION_HEADER));
            if (!rateLimitUtil.allow("agent:user:" + principal.domainId(),
                    config.agentRateLimitCount(), config.agentRateLimitWindow())) {
                writeError(response, ErrorCode.RATE_LIMITED);
                return;
            }
            user = blogUserService.getOrCreateByDomain(principal.domainId(), principal.domainName());
        } catch (BusinessException e) {
            // 过滤器先于 GlobalExceptionHandler 执行，需在此直接写响应
            writeError(response, e.getErrorCode());
            return;
        }

        UserContext.set(user.getId());
        request.setAttribute(AgentPrincipal.ATTR, principal);
        try {
            chain.doFilter(request, response);
        } finally {
            UserContext.clear();
        }
    }

    private AgentPrincipal resolvePrincipal(String ak, String sk, String securityToken, String projectId, String region) {
        CachedPrincipal cached = cache.get(ak);
        if (cached != null && !cached.expired()) {
            return new AgentPrincipal(cached.principal().domainId(), cached.principal().domainName(), projectId, region);
        }
        AgentPrincipal principal = agentAuthService.authenticate(ak, sk, securityToken, projectId, region);
        cache.put(ak, new CachedPrincipal(principal, System.currentTimeMillis() + CACHE_TTL_MS));
        return principal;
    }

    private void resolveDefaultUser() {
        // 认证关闭（本地联调）：回落种子用户
        UserContext.set(UserContext.DEFAULT_USER_ID);
    }

    private String header(HttpServletRequest request, String name) {
        return request.getHeader(name);
    }

    private void writeError(HttpServletResponse response, ErrorCode errorCode) throws IOException {
        response.setStatus(errorCode.getHttpStatus());
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.getWriter().write(objectMapper.writeValueAsString(ApiResponse.error(errorCode)));
    }

    private record CachedPrincipal(AgentPrincipal principal, long expiresAt) {
        boolean expired() {
            return System.currentTimeMillis() > expiresAt;
        }
    }
}