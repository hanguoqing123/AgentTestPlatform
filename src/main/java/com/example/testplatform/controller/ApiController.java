package com.example.testplatform.controller;

import com.example.testplatform.model.ApiDefinition;
import com.example.testplatform.service.ApiService;
import com.example.testplatform.util.CurlParser;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.util.*;

@RestController
@RequestMapping("/api/apis")
public class ApiController {

    private final ApiService apiService;

    public ApiController(ApiService apiService) {
        this.apiService = apiService;
    }

    @GetMapping
    public List<ApiDefinition> listAll() throws IOException {
        return apiService.listAll();
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiDefinition> getById(@PathVariable String id) throws IOException {
        ApiDefinition api = apiService.getById(id);
        return api != null ? ResponseEntity.ok(api) : ResponseEntity.notFound().build();
    }

    @PostMapping
    public ApiDefinition create(@RequestBody ApiDefinition api) throws IOException {
        return apiService.save(api);
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiDefinition> update(@PathVariable String id,
                                                 @RequestBody ApiDefinition api) throws IOException {
        ApiDefinition updated = apiService.update(id, api);
        return updated != null ? ResponseEntity.ok(updated) : ResponseEntity.notFound().build();
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable String id) throws IOException {
        return apiService.delete(id) ? ResponseEntity.ok().build() : ResponseEntity.notFound().build();
    }

    // ========== 导入接口 ==========

    /**
     * 从 cURL 命令导入接口（解析 cURL → 预览，不直接保存）
     */
    @PostMapping("/parse-curl")
    public ResponseEntity<?> parseCurl(@RequestBody Map<String, String> request) {
        String curl = request.get("curl");
        if (curl == null || curl.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("message", "cURL 命令不能为空"));
        }
        try {
            ApiDefinition api = CurlParser.parse(curl);
            return ResponseEntity.ok(api);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("message", "cURL 解析失败: " + e.getMessage()));
        }
    }

    /**
     * 从 cURL 命令导入并直接保存接口
     */
    @PostMapping("/import-curl")
    public ResponseEntity<?> importCurl(@RequestBody Map<String, String> request) throws IOException {
        String curl = request.get("curl");
        String name = request.get("name");
        if (curl == null || curl.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("message", "cURL 命令不能为空"));
        }
        try {
            ApiDefinition api = CurlParser.parse(curl);
            if (name != null && !name.isBlank()) {
                api.setName(name);
            }
            ApiDefinition saved = apiService.save(api);
            return ResponseEntity.ok(saved);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("message", "导入失败: " + e.getMessage()));
        }
    }

}
