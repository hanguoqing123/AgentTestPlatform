package com.example.testplatform.controller;

import com.example.testplatform.model.ApiDefinition;
import com.example.testplatform.service.ApiService;
import com.example.testplatform.service.LlmService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/generate")
public class GenerateController {

    private final LlmService llmService;
    private final ApiService apiService;

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
     * AI 生成测试数据
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

            Map<String, Object> response = new java.util.LinkedHashMap<>();
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
