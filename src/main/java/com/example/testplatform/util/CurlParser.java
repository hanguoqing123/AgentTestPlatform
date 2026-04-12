package com.example.testplatform.util;

import com.example.testplatform.model.ApiDefinition;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 解析 cURL 命令字符串，自动提取 method、url、headers、body 等信息
 */
public class CurlParser {

    private static final ObjectMapper objectMapper = new ObjectMapper();

    /**
     * 解析 cURL 命令字符串，返回 ApiDefinition
     */
    public static ApiDefinition parse(String curl) {
        if (curl == null || curl.isBlank()) {
            throw new IllegalArgumentException("cURL 命令不能为空");
        }

        // 标准化：去掉换行续行符 (\ + newline)，合并为一行
        String normalized = curl.replaceAll("\\\\\\s*\\n", " ")
                                .replaceAll("\\\\\\s*\\r\\n", " ")
                                .replaceAll("\\s+", " ")
                                .trim();

        // 去掉 "curl" 前缀
        if (normalized.toLowerCase().startsWith("curl")) {
            normalized = normalized.substring(4).trim();
        }

        List<String> tokens = tokenize(normalized);

        String url = null;
        String method = null;
        Map<String, String> headers = new LinkedHashMap<>();
        String body = null;
        boolean compressed = false;

        for (int i = 0; i < tokens.size(); i++) {
            String token = tokens.get(i);

            switch (token) {
                case "-X":
                case "--request":
                    if (i + 1 < tokens.size()) {
                        method = tokens.get(++i).toUpperCase();
                    }
                    break;

                case "-H":
                case "--header":
                    if (i + 1 < tokens.size()) {
                        String header = tokens.get(++i);
                        int colonIdx = header.indexOf(':');
                        if (colonIdx > 0) {
                            String key = header.substring(0, colonIdx).trim();
                            String value = header.substring(colonIdx + 1).trim();
                            headers.put(key, value);
                        }
                    }
                    break;

                case "-d":
                case "--data":
                case "--data-raw":
                case "--data-binary":
                case "--data-urlencode":
                    if (i + 1 < tokens.size()) {
                        body = tokens.get(++i);
                        // 去掉可能的 $' 前缀
                        if (body.startsWith("$'") && body.endsWith("'")) {
                            body = body.substring(2, body.length() - 1);
                        }
                    }
                    break;

                case "--compressed":
                    compressed = true;
                    break;

                case "-k":
                case "--insecure":
                case "-s":
                case "--silent":
                case "-v":
                case "--verbose":
                case "-L":
                case "--location":
                    // 忽略这些无关参数
                    break;

                default:
                    // 没有前导标志的 token 当作 URL
                    if (!token.startsWith("-") && url == null) {
                        url = token;
                    }
                    break;
            }
        }

        if (url == null) {
            throw new IllegalArgumentException("无法从 cURL 命令中解析出 URL");
        }

        // 推断 method
        if (method == null) {
            method = (body != null) ? "POST" : "GET";
        }

        // 构建 ApiDefinition
        ApiDefinition api = new ApiDefinition();
        api.setUrl(url);
        api.setMethod(method);

        // 从 URL 提取 path 作为名称
        api.setName(extractNameFromUrl(url));

        // 过滤掉不需要保留的请求头（浏览器自带的）
        Map<String, String> cleanHeaders = new LinkedHashMap<>();
        Set<String> skipHeaders = new HashSet<>(Arrays.asList(
                "accept-encoding", "accept-language", "connection",
                "cache-control", "pragma", "sec-ch-ua", "sec-ch-ua-mobile",
                "sec-ch-ua-platform", "sec-fetch-dest", "sec-fetch-mode",
                "sec-fetch-site", "sec-gpc", "upgrade-insecure-requests",
                "user-agent", "cookie", "origin", "referer",
                "dnt", "te", ":authority", ":method", ":path", ":scheme"
        ));

        for (Map.Entry<String, String> entry : headers.entrySet()) {
            if (!skipHeaders.contains(entry.getKey().toLowerCase())) {
                cleanHeaders.put(entry.getKey(), entry.getValue());
            }
        }

        // 确保 Content-Type 存在
        if (!cleanHeaders.isEmpty()) {
            api.setHeaders(cleanHeaders);
        } else {
            api.setHeaders(Map.of("Content-Type", "application/json"));
        }

        // 解析 body 为 bodySchema
        if (body != null && !body.isBlank()) {
            try {
                Map<String, Object> bodyMap = objectMapper.readValue(body,
                        new TypeReference<Map<String, Object>>() {});
                api.setBodySchema(bodyMap);
            } catch (Exception e) {
                // body 不是 JSON，直接存为 raw
                api.setBodySchema(Map.of("_raw", body));
            }
        }

        // 推断响应类型
        String accept = headers.getOrDefault("Accept", headers.getOrDefault("accept", ""));
        if (accept.contains("text/event-stream")) {
            api.setResponseType("sse");
        } else {
            api.setResponseType("json");
        }

        api.setDescription("从 cURL 导入");
        return api;
    }

    /**
     * 将命令字符串分割为 token 列表，正确处理引号内的内容
     */
    private static List<String> tokenize(String input) {
        List<String> tokens = new ArrayList<>();
        StringBuilder current = new StringBuilder();
        char quoteChar = 0;
        boolean escaped = false;

        for (int i = 0; i < input.length(); i++) {
            char c = input.charAt(i);

            if (escaped) {
                current.append(c);
                escaped = false;
                continue;
            }

            if (c == '\\') {
                escaped = true;
                continue;
            }

            if (quoteChar != 0) {
                if (c == quoteChar) {
                    quoteChar = 0; // 引号结束
                } else {
                    current.append(c);
                }
            } else {
                if (c == '\'' || c == '"') {
                    quoteChar = c; // 引号开始
                } else if (c == ' ' || c == '\t') {
                    if (current.length() > 0) {
                        tokens.add(current.toString());
                        current.setLength(0);
                    }
                } else {
                    current.append(c);
                }
            }
        }

        if (current.length() > 0) {
            tokens.add(current.toString());
        }

        return tokens;
    }

    /**
     * 从 URL 中提取一个有意义的名称
     */
    private static String extractNameFromUrl(String url) {
        try {
            // 去掉协议和查询参数
            String path = url.replaceAll("^https?://", "")
                             .replaceAll("\\?.*$", "");
            // 去掉域名部分，只保留 path
            int slashIdx = path.indexOf('/');
            if (slashIdx > 0) {
                path = path.substring(slashIdx);
            }
            // 取最后两段 path
            String[] parts = path.split("/");
            List<String> meaningful = new ArrayList<>();
            for (String part : parts) {
                if (!part.isBlank() && !part.matches("^v\\d+$")) {
                    meaningful.add(part);
                }
            }
            if (meaningful.size() > 2) {
                meaningful = meaningful.subList(meaningful.size() - 2, meaningful.size());
            }
            return String.join("/", meaningful);
        } catch (Exception e) {
            return url;
        }
    }
}
