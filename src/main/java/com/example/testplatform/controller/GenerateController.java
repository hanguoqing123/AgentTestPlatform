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

    public static class GenerateRequest {
        public String apiId;
        public String scenario;
        public int count = 10;
    }
}
