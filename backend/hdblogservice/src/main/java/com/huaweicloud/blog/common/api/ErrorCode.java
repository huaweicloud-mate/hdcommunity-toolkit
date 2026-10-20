package com.huaweicloud.blog.common.api;

import lombok.Getter;

/**
 * 错误码枚举：业务 code + HTTP 状态码 + 文案。
 * （合并用户面 + 管理台后的并集）
 */
@Getter
public enum ErrorCode {

    UNAUTHORIZED(10001, 401, "未登录或登录已过期"),
    FORBIDDEN(10002, 403, "无权限访问"),
    AUTH_FAILED(10003, 401, "账号或密码错误"),
    NOT_FOUND(10004, 404, "资源不存在"),

    // Agent 用户面认证（11xxx 段，避免与现有管理台错误码冲突）
    AUTH_AK_MISSING(11001, 400, "缺少 X-HW-AK"),
    AUTH_SK_MISSING(11002, 400, "缺少 X-HW-SK"),
    AGENT_AUTH_FAILED(11003, 401, "AK/SK 无效或认证失败"),
    DOMAIN_NOT_WHITELISTED(11004, 403, "账号不在白名单"),
    ADMIN_ROLE_DENIED(11005, 403, "角色无该工具权限"),

    PARAM_ERROR(20000, 400, "参数错误"),
    BLOG_NOT_FOUND(20001, 400, "博客不存在"),
    BLOG_STATE_INVALID(20002, 400, "博客当前状态不支持该操作"),
    COMMENT_NOT_FOUND(20003, 400, "评论不存在"),
    COMMENT_STATE_INVALID(20004, 400, "评论当前状态不支持该操作"),
    ACTION_INVALID(20005, 400, "action 仅支持 approve / reject"),
    DRAFT_NOT_FOUND(20006, 400, "草稿不存在"),
    FILE_UPLOAD_FAILED(20007, 400, "文件上传失败"),

    RATE_LIMITED(30001, 429, "请求过于频繁"),

    SYSTEM_ERROR(90000, 500, "系统繁忙，请稍后重试");

    private final int code;
    private final int httpStatus;
    private final String message;

    ErrorCode(int code, int httpStatus, String message) {
        this.code = code;
        this.httpStatus = httpStatus;
        this.message = message;
    }
}
