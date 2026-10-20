package com.huaweicloud.blog.config;

import com.huaweicloud.blog.common.context.UserContextInterceptor;
import com.huaweicloud.blog.common.security.AgentAdminInterceptor;
import com.huaweicloud.blog.common.security.AuthInterceptor;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.util.Arrays;

/**
 * Web 配置：CORS（读配置）+ 登录用户上下文拦截器。
 */
@Configuration
@RequiredArgsConstructor
public class WebConfig implements WebMvcConfigurer {

    private final UserContextInterceptor userContextInterceptor;
    private final AuthInterceptor authInterceptor;
    private final AgentAdminInterceptor agentAdminInterceptor;
    private final BlogConfig config;

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        String[] origins = Arrays.stream(config.corsAllowedOrigins().split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .toArray(String[]::new);
        // 使用 allowedOriginPatterns 以支持 https://*.huaweicloud.com 这类通配子域，且可配合 allowCredentials
        registry.addMapping("/**")
                .allowedOriginPatterns(origins)
                .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
                .allowedHeaders("*")
                .exposedHeaders("X-Request-Id")
                .allowCredentials(true)
                .maxAge(3600);
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        // 管理台：/manage/** 走 Bearer Token 鉴权（登录接口放行）
        registry.addInterceptor(authInterceptor)
                .addPathPatterns("/manage/**")
                .excludePathPatterns("/manage/auth/login");
        // Agent 管理面：/agent/admin/** 走 Bearer Token 鉴权 + 角色工具白名单（登录接口放行）
        registry.addInterceptor(agentAdminInterceptor)
                .addPathPatterns("/agent/admin/**")
                .excludePathPatterns("/agent/admin/login");
        // 用户面：其余路径解析登录用户上下文（/agent/** 由 AgentAuthFilter 设置身份，避免覆盖）
        registry.addInterceptor(userContextInterceptor)
                .addPathPatterns("/**")
                .excludePathPatterns("/manage/**", "/health", "/agent/**");
    }
}