package com.example.testplatform.service;

import com.example.testplatform.config.LlmConfig;
import com.example.testplatform.model.ApiDefinition;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.*;

@Service
public class LlmService {

    private static final Logger log = LoggerFactory.getLogger(LlmService.class);

    private final LlmConfig llmConfig;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;

    public LlmService(LlmConfig llmConfig, ObjectMapper objectMapper) {
        this.llmConfig = llmConfig;
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(15))
                .build();
    }

    /**
     * 基于接口定义和场景描述，调用大模型生成测试数据
     */
    public List<Map<String, Object>> generateTestData(ApiDefinition api, String scenario,
                                                       int count) throws Exception {
        if (!llmConfig.isConfigured()) {
            throw new IllegalStateException("大模型 API 未配置，请在 application.yml 中设置 app.llm.api-key");
        }

        String prompt = buildPrompt(api, scenario, count);
        String response = callLlm(prompt);
        return parseJsonArray(response);
    }

    /**
     * 检查 LLM 是否已配置
     */
    public boolean isConfigured() {
        return llmConfig.isConfigured();
    }

    private String buildPrompt(ApiDefinition api, String scenario, int count) {
        StringBuilder sb = new StringBuilder();
        sb.append("你是一个测试数据生成专家。请根据以下接口信息和场景描述，生成测试数据。\n\n");

        sb.append("## 接口信息\n");
        sb.append("- 名称: ").append(api.getName()).append("\n");
        sb.append("- URL: ").append(api.getMethod()).append(" ").append(api.getUrl()).append("\n");
        if (api.getDescription() != null) {
            sb.append("- 描述: ").append(api.getDescription()).append("\n");
        }

        // 请求体结构 — 直接将用户填写的 JSON 作为示例模板
        if (api.getBodySchema() != null && !api.getBodySchema().isEmpty()) {
            sb.append("\n## 请求体结构（示例模板）\n");
            sb.append("以下是该接口的请求体 JSON 结构，请严格按照此结构生成每条测试数据：\n");
            sb.append("```json\n");
            try {
                sb.append(objectMapper.writerWithDefaultPrettyPrinter()
                        .writeValueAsString(api.getBodySchema()));
            } catch (Exception e) {
                sb.append(api.getBodySchema().toString());
            }
            sb.append("\n```\n");
        }

        sb.append("\n## 生成要求\n");
        sb.append("- 场景描述: ").append(scenario != null && !scenario.isBlank() ? scenario : "通用测试场景").append("\n");
        sb.append("- 生成数量: ").append(count).append(" 条\n");
        sb.append("- 每条数据必须保持与上面模板完全一致的 JSON 结构（包括嵌套对象）\n");
        sb.append("- 每条数据的字段值需要有多样性，不要重复\n");
        sb.append("- 文本类字段要生成贴合真实业务场景的自然语言内容\n");
        sb.append("- 适当穿插边界值（如特殊字符、emoji、较长文本）\n");

        sb.append("\n## 输出格式\n");
        sb.append("只输出一个 JSON 数组，不要包含任何其他文字、解释或 markdown 标记。\n");
        sb.append("示例格式:\n");
        sb.append("[{\"field1\": \"value1\"}, {\"field2\": \"value2\"}]\n");

        return sb.toString();
    }

    private String callLlm(String prompt) throws Exception {
        Map<String, Object> requestBody = new LinkedHashMap<>();
        requestBody.put("model", llmConfig.getModel());
        requestBody.put("max_tokens", llmConfig.getMaxTokens());
        requestBody.put("temperature", llmConfig.getTemperature());

        List<Map<String, String>> messages = new ArrayList<>();
        messages.add(Map.of("role", "system", "content",
                "你是一个专业的测试数据生成器。你只输出合法的 JSON 数组，不输出任何其他内容。"));
        messages.add(Map.of("role", "user", "content", prompt));
        requestBody.put("messages", messages);

        String bodyJson = objectMapper.writeValueAsString(requestBody);

        // 自动拼接 /chat/completions，兼容配置了完整路径或只配了 base URL 的情况
        String apiUrl = llmConfig.getApiUrl().replaceAll("/+$", "");
        if (!apiUrl.endsWith("/chat/completions")) {
            apiUrl = apiUrl + "/chat/completions";
        }

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(apiUrl))
                .header("Content-Type", "application/json")
                .header("Authorization", "Bearer " + llmConfig.getApiKey())
                .timeout(Duration.ofSeconds(120))
                .POST(HttpRequest.BodyPublishers.ofString(bodyJson))
                .build();

        log.info("Calling LLM API: {} with model: {}", apiUrl, llmConfig.getModel());

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

        if (response.statusCode() != 200) {
            log.error("LLM API error: {} - {}", response.statusCode(), response.body());
            throw new RuntimeException("大模型 API 调用失败: HTTP " + response.statusCode()
                    + " - " + truncate(response.body(), 200));
        }

        // 解析 OpenAI 兼容格式的响应
        JsonNode root = objectMapper.readTree(response.body());
        JsonNode choices = root.get("choices");
        if (choices == null || choices.isEmpty()) {
            throw new RuntimeException("大模型返回为空");
        }

        String content = choices.get(0).get("message").get("content").asText();
        log.info("LLM response length: {} chars", content.length());
        return content;
    }

    private List<Map<String, Object>> parseJsonArray(String raw) throws Exception {
        String cleaned = raw.strip();

        // 移除 Qwen3 等模型的 <think>...</think> 思考标签
        cleaned = cleaned.replaceAll("(?s)<think>.*?</think>", "").strip();

        // 清理可能的 markdown 代码块标记
        if (cleaned.startsWith("```json")) {
            cleaned = cleaned.substring(7);
        } else if (cleaned.startsWith("```")) {
            cleaned = cleaned.substring(3);
        }
        if (cleaned.endsWith("```")) {
            cleaned = cleaned.substring(0, cleaned.length() - 3);
        }
        cleaned = cleaned.strip();

        // 尝试找到 JSON 数组的起始位置和结束位置
        int start = cleaned.indexOf('[');
        int end = cleaned.lastIndexOf(']');
        if (start >= 0 && end > start) {
            cleaned = cleaned.substring(start, end + 1);
        }

        try {
            return objectMapper.readValue(cleaned, new TypeReference<List<Map<String, Object>>>() {});
        } catch (Exception e) {
            log.error("Failed to parse LLM response as JSON array: {}", truncate(cleaned, 500));
            throw new RuntimeException("大模型生成的数据格式解析失败，请重试。原始内容: " + truncate(cleaned, 300));
        }
    }

    private String truncate(String s, int maxLen) {
        if (s == null) return "";
        return s.length() <= maxLen ? s : s.substring(0, maxLen) + "...";
    }
}
