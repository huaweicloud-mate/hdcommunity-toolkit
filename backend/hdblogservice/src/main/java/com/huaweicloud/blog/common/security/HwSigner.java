package com.huaweicloud.blog.common.security;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

/**
 * 华为云 SDK-HMAC-SHA256 请求签名（用于以 AK/SK 调用 IAM 接口）。
 * 仅实现 GET/无 body 的简单场景所需的签名能力。
 */
public final class HwSigner {

    private static final String ALGORITHM = "SDK-HMAC-SHA256";
    private static final DateTimeFormatter SDK_DATE =
            DateTimeFormatter.ofPattern("yyyyMMdd'T'HHmmss'Z'").withZone(ZoneOffset.UTC);
    private static final char[] HEX = "0123456789abcdef".toCharArray();

    private HwSigner() {
    }

    /**
     * 生成签名后的请求头。
     *
     * @param method        HTTP 方法（GET）
     * @param url           完整 URL（含 query）
     * @param ak            访问密钥 ID
     * @param sk            访问密钥
     * @param securityToken 可选临时凭证
     * @return 需附加到请求的头部 map（含 X-Sdk-Date / Authorization，可能含 X-Security-Token）
     */
    public static Map<String, String> sign(String method, String url, String ak, String sk, String securityToken) {
        URI uri = URI.create(url);
        String host = uri.getHost();
        String canonicalUri = uri.getRawPath().isEmpty() ? "/" : uri.getRawPath();
        String canonicalQuery = canonicalQuery(uri.getRawQuery());
        String sdkDate = SDK_DATE.format(ZonedDateTime.now(ZoneOffset.UTC));

        String payloadHash = hex(sha256(new byte[0]));

        TreeMap<String, String> headers = new TreeMap<>();
        headers.put("host", host);
        headers.put("x-sdk-date", sdkDate);

        StringBuilder canonicalHeaders = new StringBuilder();
        StringBuilder signedHeaders = new StringBuilder();
        for (Map.Entry<String, String> e : headers.entrySet()) {
            canonicalHeaders.append(e.getKey()).append(':').append(e.getValue()).append('\n');
            if (signedHeaders.length() > 0) {
                signedHeaders.append(';');
            }
            signedHeaders.append(e.getKey());
        }

        String canonicalRequest = method + "\n"
                + canonicalUri + "\n"
                + canonicalQuery + "\n"
                + canonicalHeaders + "\n"
                + signedHeaders + "\n"
                + payloadHash;

        String stringToSign = ALGORITHM + "\n"
                + sdkDate + "\n"
                + hex(sha256(canonicalRequest.getBytes(StandardCharsets.UTF_8)));

        String signature = hex(hmacSha256(stringToSign.getBytes(StandardCharsets.UTF_8), sk.getBytes(StandardCharsets.UTF_8)));

        Map<String, String> result = new java.util.HashMap<>();
        result.put("X-Sdk-Date", sdkDate);
        if (securityToken != null && !securityToken.isBlank()) {
            result.put("X-Security-Token", securityToken);
        }
        result.put("Authorization", ALGORITHM + " Access=" + ak
                + ", SignedHeaders=" + signedHeaders
                + ", Signature=" + signature);
        return result;
    }

    private static String canonicalQuery(String rawQuery) {
        if (rawQuery == null || rawQuery.isEmpty()) {
            return "";
        }
        TreeMap<String, List<String>> params = new TreeMap<>();
        for (String pair : rawQuery.split("&")) {
            if (pair.isEmpty()) {
                continue;
            }
            int idx = pair.indexOf('=');
            String k = idx < 0 ? pair : pair.substring(0, idx);
            String v = idx < 0 ? "" : pair.substring(idx + 1);
            params.computeIfAbsent(k, x -> new ArrayList<>()).add(v);
        }
        StringBuilder sb = new StringBuilder();
        for (Map.Entry<String, List<String>> e : params.entrySet()) {
            for (String v : e.getValue()) {
                if (sb.length() > 0) {
                    sb.append('&');
                }
                sb.append(e.getKey()).append('=').append(v);
            }
        }
        return sb.toString();
    }

    private static byte[] sha256(byte[] data) {
        try {
            return MessageDigest.getInstance("SHA-256").digest(data);
        } catch (Exception e) {
            throw new IllegalStateException("SHA-256 unavailable", e);
        }
    }

    private static byte[] hmacSha256(byte[] data, byte[] key) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(key, "HmacSHA256"));
            return mac.doFinal(data);
        } catch (Exception e) {
            throw new IllegalStateException("HmacSHA256 unavailable", e);
        }
    }

    private static String hex(byte[] bytes) {
        char[] out = new char[bytes.length * 2];
        for (int i = 0; i < bytes.length; i++) {
            int v = bytes[i] & 0xFF;
            out[i * 2] = HEX[v >>> 4];
            out[i * 2 + 1] = HEX[v & 0x0F];
        }
        return new String(out);
    }
}