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

    /** 单批最大条数阈值，超过则自动分批处理 */
    private static final int BATCH_THRESHOLD = 30;
    private static final int BATCH_SIZE = 20;
    /** 追加型样本条数：发给 AI 作为结构参考 */
    private static final int APPEND_SAMPLE_COUNT = 3;

    /** 用于识别追加类指令的关键词 */
    private static final List<String> APPEND_KEYWORDS = List.of(
            "增加", "追加", "新增", "添加", "再加", "补充", "再生成", "多生成",
            "再来", "再补", "加几条", "加一些", "生成几条", "生成一些",
            "append", "add", "insert", "generate more"
    );

    /**
     * AI 对话式修改数据集：用户给出修改指令，AI 基于当前数据返回修改后的完整数据集。
     * 处理策略：
     *   1. 追加类指令（不管数据量多大）：只发结构样本 + 指令，AI 生成新数据，拼接到原数据后
     *   2. 小数据集（≤ 阈值）：全量发给 AI 处理
     *   3. 大数据集（> 阈值）：自动分批处理
     *
     * @return RefineResult 包含修改后的数据和处理信息
     */
    public RefineResult refineData(List<Map<String, Object>> currentData,
                                   String userInstruction) throws Exception {
        if (!llmConfig.isConfigured()) {
            throw new IllegalStateException("大模型 API 未配置");
        }

        // 策略 1：追加类指令 — 无需发送全量数据，只需结构样本
        if (isAppendInstruction(userInstruction)) {
            log.info("识别为追加类指令，采用样本模式（数据集 {} 条）", currentData.size());
            return refineDataAppend(currentData, userInstruction);
        }

        // 策略 2：小数据集 — 全量处理
        if (currentData.size() <= BATCH_THRESHOLD) {
            List<Map<String, Object>> result = refineDataDirect(currentData, userInstruction);
            return new RefineResult(result, 1, 1, false);
        }

        // 策略 3：大数据集修改类指令 — 分批处理
        log.info("数据集共 {} 条，超过阈值 {}，启用分批处理（每批 {} 条）",
                currentData.size(), BATCH_THRESHOLD, BATCH_SIZE);
        return refineDataBatched(currentData, userInstruction);
    }

    /**
     * 判断用户指令是否为追加类（新增数据，不修改现有数据）
     */
    private boolean isAppendInstruction(String instruction) {
        String lower = instruction.toLowerCase();
        return APPEND_KEYWORDS.stream().anyMatch(lower::contains);
    }

    /**
     * 追加模式：只发送少量样本数据让 AI 了解结构，生成新数据后拼接到原数据末尾。
     * 不管原数据集有多大，发给 AI 的 token 量都是固定的。
     */
    private RefineResult refineDataAppend(List<Map<String, Object>> currentData,
                                           String userInstruction) throws Exception {
        // 取前几条作为结构样本
        int sampleSize = Math.min(APPEND_SAMPLE_COUNT, currentData.size());
        List<Map<String, Object>> samples = currentData.subList(0, sampleSize);
        String sampleJson = toJsonString(samples);

        String prompt = buildAppendPrompt(sampleJson, userInstruction,
                currentData.size(), sampleSize);
        String response = callLlm(prompt);
        List<Map<String, Object>> newItems = parseJsonArray(response);

        // 将新数据拼接到原数据末尾
        List<Map<String, Object>> result = new ArrayList<>(currentData);
        result.addAll(newItems);

        log.info("追加模式完成：原 {} 条 + 新增 {} 条 = {} 条",
                currentData.size(), newItems.size(), result.size());
        return new RefineResult(result, 1, 1, false);
    }

    /**
     * 全量模式：直接发送全部数据给 AI
     */
    private List<Map<String, Object>> refineDataDirect(List<Map<String, Object>> currentData,
                                                        String userInstruction) throws Exception {
        String currentJson = toJsonString(currentData);
        String prompt = buildRefinePrompt(currentJson, userInstruction, -1, -1, currentData.size());
        String response = callLlm(prompt);
        return parseJsonArray(response);
    }

    /**
     * 分批模式：将数据拆分为多批分别处理，最后合并结果。
     * 仅用于修改/删除类指令，追加类指令走 refineDataAppend。
     */
    private RefineResult refineDataBatched(List<Map<String, Object>> currentData,
                                            String userInstruction) throws Exception {
        int totalSize = currentData.size();
        int totalBatches = (int) Math.ceil((double) totalSize / BATCH_SIZE);
        List<Map<String, Object>> allResults = new ArrayList<>();

        // 提取数据结构模板（用第一条数据），让每批 AI 都了解整体结构
        String schemaSample = toJsonString(List.of(currentData.get(0)));

        for (int batchIdx = 0; batchIdx < totalBatches; batchIdx++) {
            int from = batchIdx * BATCH_SIZE;
            int to = Math.min(from + BATCH_SIZE, totalSize);
            List<Map<String, Object>> batch = currentData.subList(from, to);

            log.info("处理第 {}/{} 批（第 {}-{} 条，共 {} 条）",
                    batchIdx + 1, totalBatches, from + 1, to, batch.size());

            String batchJson = toJsonString(batch);
            String prompt = buildBatchRefinePrompt(batchJson, userInstruction,
                    batchIdx + 1, totalBatches, from + 1, to, totalSize, schemaSample);
            String response = callLlm(prompt);
            List<Map<String, Object>> batchResult = parseJsonArray(response);
            allResults.addAll(batchResult);
        }

        log.info("分批处理完成，共 {} 批，合并后 {} 条数据", totalBatches, allResults.size());
        return new RefineResult(allResults, totalBatches, totalBatches, true);
    }

    /** 将数据序列化为 JSON 字符串 */
    private String toJsonString(List<Map<String, Object>> data) {
        try {
            return objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(data);
        } catch (Exception e) {
            return data.toString();
        }
    }

    private String buildRefinePrompt(String currentJson, String userInstruction,
                                      int batchNo, int totalBatches, int totalCount) {
        StringBuilder sb = new StringBuilder();
        sb.append("你是一个测试数据修改专家。用户会给你一份当前的测试数据（JSON 数组），并告诉你需要做什么修改。\n");
        sb.append("请根据用户的指令修改数据，并返回修改后的完整 JSON 数组。\n\n");

        sb.append("## 当前数据（共 ").append(totalCount).append(" 条）\n");
        sb.append("```json\n");
        sb.append(currentJson);
        sb.append("\n```\n\n");

        sb.append("## 用户的修改指令\n");
        sb.append(userInstruction).append("\n\n");

        sb.append("## 输出要求\n");
        sb.append("- 只输出修改后的完整 JSON 数组，不要包含任何解释文字或 markdown 标记\n");
        sb.append("- 保持原有数据的 JSON 结构不变（除非用户明确要求修改结构）\n");
        sb.append("- 仅针对用户指令涉及的部分进行修改，不要随意改动用户未提及的数据\n");
        sb.append("- 如果用户要求增加数据，在数组末尾追加新条目\n");
        sb.append("- 如果用户要求删除数据，移除对应条目\n");

        return sb.toString();
    }

    /**
     * 构建分批处理的 prompt，让 AI 知道当前只是全量数据的一部分
     */
    private String buildBatchRefinePrompt(String batchJson, String userInstruction,
                                           int batchNo, int totalBatches,
                                           int fromIndex, int toIndex, int totalCount,
                                           String schemaSample) {
        StringBuilder sb = new StringBuilder();
        sb.append("你是一个测试数据修改专家。\n");
        sb.append("用户有一个包含 ").append(totalCount).append(" 条数据的大型数据集，");
        sb.append("由于数据量较大，我们正在分批处理。\n");
        sb.append("当前是第 ").append(batchNo).append("/").append(totalBatches).append(" 批，");
        sb.append("包含第 ").append(fromIndex).append("-").append(toIndex).append(" 条数据。\n");
        sb.append("请对这批数据执行用户的修改指令，返回修改后的 JSON 数组。\n\n");

        sb.append("## 数据结构示例（第 1 条数据）\n");
        sb.append("```json\n").append(schemaSample).append("\n```\n\n");

        sb.append("## 当前批次数据（第 ").append(fromIndex).append("-").append(toIndex).append(" 条）\n");
        sb.append("```json\n");
        sb.append(batchJson);
        sb.append("\n```\n\n");

        sb.append("## 用户的修改指令\n");
        sb.append(userInstruction).append("\n\n");

        sb.append("## 输出要求\n");
        sb.append("- 只输出这一批数据修改后的 JSON 数组，不要包含任何解释文字或 markdown 标记\n");
        sb.append("- 保持原有数据的 JSON 结构不变（除非用户明确要求修改结构）\n");
        sb.append("- 仅针对用户指令涉及的部分进行修改，不要随意改动用户未提及的数据\n");
        sb.append("- 不要新增任何数据条目，只修改或删除现有数据\n");
        sb.append("- 如果用户要求删除符合条件的数据，直接从本批中移除对应条目\n");

        return sb.toString();
    }

    /**
     * 构建追加模式的 prompt：只发送少量样本，让 AI 生成新数据
     */
    private String buildAppendPrompt(String sampleJson, String userInstruction,
                                      int totalCount, int sampleCount) {
        StringBuilder sb = new StringBuilder();
        sb.append("你是一个测试数据生成专家。\n");
        sb.append("用户有一个已有 ").append(totalCount).append(" 条数据的数据集，");
        sb.append("现在想要追加新的数据条目。\n");
        sb.append("以下是现有数据中的 ").append(sampleCount).append(" 条样本，供你了解数据结构和风格：\n\n");

        sb.append("## 现有数据样本\n");
        sb.append("```json\n");
        sb.append(sampleJson);
        sb.append("\n```\n\n");

        sb.append("## 用户的指令\n");
        sb.append(userInstruction).append("\n\n");

        sb.append("## 输出要求\n");
        sb.append("- 只输出新增的数据条目组成的 JSON 数组，不要包含已有的数据\n");
        sb.append("- 不要包含任何解释文字或 markdown 标记\n");
        sb.append("- 新数据的 JSON 结构必须与样本中的结构完全一致\n");
        sb.append("- 新数据的字段值要有多样性，不要与样本重复\n");
        sb.append("- 如果用户指令中指定了数量，按指定数量生成；如果没指定，默认生成 3 条\n");

        return sb.toString();
    }

    /**
     * AI 修改数据集的返回结果，包含处理信息
     */
    public static class RefineResult {
        private final List<Map<String, Object>> data;
        private final int processedBatches;
        private final int totalBatches;
        private final boolean batched;

        public RefineResult(List<Map<String, Object>> data, int processedBatches,
                            int totalBatches, boolean batched) {
            this.data = data;
            this.processedBatches = processedBatches;
            this.totalBatches = totalBatches;
            this.batched = batched;
        }

        public List<Map<String, Object>> getData() { return data; }
        public int getProcessedBatches() { return processedBatches; }
        public int getTotalBatches() { return totalBatches; }
        public boolean isBatched() { return batched; }
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
