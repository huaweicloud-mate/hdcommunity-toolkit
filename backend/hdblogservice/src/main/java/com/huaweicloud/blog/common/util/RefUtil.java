package com.huaweicloud.blog.common.util;

/**
 * 资源 ref 与数值 id 互转工具。
 * 博客 ref 形如 {@code blog-123}；草稿/评论 id 为纯数字或带前缀。
 */
public final class RefUtil {

    private RefUtil() {
    }

    /** 解析 ref 中的数值 id，无法解析返回 null。 */
    public static Long parseId(String ref) {
        if (ref == null || ref.isBlank()) {
            return null;
        }
        String idPart = ref.startsWith("blog-") ? ref.substring(5)
                : ref.startsWith("d-") ? ref.substring(2)
                : ref;
        try {
            return Long.parseLong(idPart.trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    /** 生成博客 ref。 */
    public static String blogRef(Long id) {
        return id == null ? null : "blog-" + id;
    }
}