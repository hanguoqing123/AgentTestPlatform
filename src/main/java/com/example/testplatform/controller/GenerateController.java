package com.example.testplatform.controller;

import com.example.testplatform.model.ApiDefinition;
import com.example.testplatform.service.ApiService;
import com.example.testplatform.service.LlmService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/generate")
public class GenerateController {

    private static final Logger log = LoggerFactory.getLogger(GenerateController.class);

    private final LlmService llmService;
    private final ApiService apiService;
    // SSE 专用：必须紧凑输出（单行 JSON），不能用全局 ObjectMapper（indent-output: true 会多行）
    private final ObjectMapper sseMapper = new ObjectMapper();

    public GenerateController(LlmService llmService, ApiService apiService) {
        this.llmService = llmService;
        this.apiService = apiService;
    }

    /**
     * 检查大模型是否已配置
     */
    @GetMapping("/status")
    public Map<String, Object> status() {
        return Map.of("configured", llmService.isConfigured());
    }

    /**
     * AI 生成测试数据（保留旧接口兼容）
     */
    @PostMapping
    public ResponseEntity<?> generate(@RequestBody GenerateRequest request) {
        try {
            ApiDefinition api = apiService.getById(request.apiId);
            if (api == null) {
                return ResponseEntity.badRequest().body(Map.of("error", "接口不存在: " + request.apiId));
            }

            int count = request.count > 0 ? Math.min(request.count, 100) : 10;
            List<Map<String, Object>> data = llmService.generateTestData(api, request.scenario, count);

            return ResponseEntity.ok(Map.of(
                    "data", data,
                    "count", data.size()
            ));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * AI 流式生成测试数据（SSE），实时推送生成进度
     * 事件类型：
     *   - progress: 每批进度 {currentBatch, totalBatches, generatedCount, targetCount, message}
     *   - complete: 全部完成 {data, count}
     *   - error: 出错 {message}
     */
    @PostMapping(value = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter generateStream(@RequestBody GenerateRequest request) {
        SseEmitter emitter = new SseEmitter(300_000L); // 5 分钟超时

        new Thread(() -> {
            try {
                ApiDefinition api = apiService.getById(request.apiId);
                if (api == null) {
                    sendSseEvent(emitter, "error", Map.of("message", "接口不存在: " + request.apiId));
                    emitter.complete();
                    return;
                }

                int count = request.count > 0 ? Math.min(request.count, 100) : 10;

                // 发送开始事件
                int batchSize = 20;
                int totalBatches = count <= batchSize ? 1 : (int) Math.ceil((double) count / batchSize);
                sendSseEvent(emitter, "start", Map.of(
                        "targetCount", count,
                        "totalBatches", totalBatches,
                        "message", count <= batchSize
                                ? "开始生成 " + count + " 条数据..."
                                : "数据量较大，将分 " + totalBatches + " 批生成（每批 " + batchSize + " 条）..."
                ));

                // 调用分批生成，通过回调推送进度（含 phase 和 receivedChars）
                List<Map<String, Object>> data = llmService.generateTestDataBatched(
                        api, request.scenario, count,
                        progress -> {
                            try {
                                Map<String, Object> event = new LinkedHashMap<>();
                                event.put("currentBatch", progress.getCurrentBatch());
                                event.put("totalBatches", progress.getTotalBatches());
                                event.put("generatedCount", progress.getGeneratedCount());
                                event.put("targetCount", progress.getTargetCount());
                                event.put("message", progress.getMessage());
                                if (progress.getPhase() != null) {
                                    event.put("phase", progress.getPhase());
                                }
                                event.put("receivedChars", progress.getReceivedChars());
                                sendSseEvent(emitter, "progress", event);
                            } catch (Exception e) {
                                log.warn("推送进度事件失败: {}", e.getMessage());
                            }
                        }
                );

                // 发送完成事件，携带全量数据
                Map<String, Object> completeEvent = new LinkedHashMap<>();
                completeEvent.put("data", data);
                completeEvent.put("count", data.size());
                sendSseEvent(emitter, "complete", completeEvent);
                emitter.complete();

            } catch (Exception e) {
                log.error("流式生成失败", e);
                try {
                    sendSseEvent(emitter, "error", Map.of(
                            "message", e.getMessage() != null ? e.getMessage() : "生成失败，请重试"
                    ));
                    emitter.complete();
                } catch (Exception ex) {
                    emitter.completeWithError(ex);
                }
            }
        }).start();

        return emitter;
    }

    private void sendSseEvent(SseEmitter emitter, String eventName, Map<String, Object> data) {
        try {
            // 用 sseMapper（紧凑模式）而非全局 objectMapper（indent-output: true 会多行输出）
            // SSE data 必须单行 JSON，多行会被 Spring 拆成多条 data: 行导致前端解析异常
            String json = sseMapper.writeValueAsString(data);
            emitter.send(SseEmitter.event().name(eventName).data(json, MediaType.TEXT_PLAIN));
        } catch (Exception e) {
            log.warn("发送 SSE 事件 [{}] 失败: {}", eventName, e.getMessage());
        }
    }

    /**
     * AI 对话式修改数据集（大数据集自动分批处理）
     */
    @PostMapping("/refine")
    public ResponseEntity<?> refine(@RequestBody RefineRequest request) {
        try {
            if (request.data == null || request.data.isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("error", "当前数据不能为空"));
            }
            if (request.instruction == null || request.instruction.isBlank()) {
                return ResponseEntity.badRequest().body(Map.of("error", "请输入修改指令"));
            }

            LlmService.RefineResult result = llmService.refineData(request.data, request.instruction);

            Map<String, Object> response = new LinkedHashMap<>();
            response.put("data", result.getData());
            response.put("count", result.getData().size());
            response.put("batched", result.isBatched());
            response.put("totalBatches", result.getTotalBatches());

            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        }
    }

    public static class GenerateRequest {
        public String apiId;
        public String scenario;
        public int count = 10;
    }

    public static class RefineRequest {
        public List<Map<String, Object>> data;
        public String instruction;
    }
}
