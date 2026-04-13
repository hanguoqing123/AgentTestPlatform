package com.example.testplatform.controller;

import com.example.testplatform.model.SharePackage;
import com.example.testplatform.service.ShareService;
import com.example.testplatform.service.ShareService.ImportResult;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

@RestController
@RequestMapping("/api/share")
public class ShareController {

    private final ShareService shareService;
    private final ObjectMapper objectMapper;

    public ShareController(ShareService shareService, ObjectMapper objectMapper) {
        this.shareService = shareService;
        this.objectMapper = objectMapper;
    }

    /**
     * 导出接口为分享文件（直接下载 JSON）
     * POST /api/share/export
     * Body: { "apiId": "xxx" }
     */
    @PostMapping("/export")
    public ResponseEntity<byte[]> exportShare(@RequestBody java.util.Map<String, String> body) throws IOException {
        String apiId = body.get("apiId");
        if (apiId == null || apiId.isBlank()) {
            return ResponseEntity.badRequest().build();
        }

        SharePackage pkg = shareService.buildSharePackage(apiId);
        byte[] json = objectMapper.writerWithDefaultPrettyPrinter().writeValueAsBytes(pkg);

        // 文件名: 接口名称.agenttest.json
        String fileName = (pkg.getApi().getName() != null ? pkg.getApi().getName() : "share")
                + ".agenttest.json";
        String encodedFileName = URLEncoder.encode(fileName, StandardCharsets.UTF_8).replace("+", "%20");

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"" + encodedFileName + "\"; filename*=UTF-8''" + encodedFileName)
                .contentType(MediaType.APPLICATION_JSON)
                .body(json);
    }

    /**
     * 预览上传的分享文件（不执行导入，仅返回内容摘要）
     * POST /api/share/preview
     * Body: multipart file
     */
    @PostMapping("/preview")
    public ResponseEntity<?> previewShare(@RequestParam("file") MultipartFile file) throws IOException {
        if (file.isEmpty()) {
            return ResponseEntity.badRequest().body(java.util.Map.of("message", "文件为空"));
        }
        SharePackage pkg = objectMapper.readValue(file.getInputStream(), SharePackage.class);
        return ResponseEntity.ok(pkg);
    }

    /**
     * 导入分享文件
     * POST /api/share/import
     * Body: multipart file + apiStrategy + datasetStrategy
     */
    @PostMapping("/import")
    public ResponseEntity<?> importShare(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "apiStrategy", defaultValue = "skip") String apiStrategy,
            @RequestParam(value = "datasetStrategy", defaultValue = "skip") String datasetStrategy
    ) throws IOException {
        if (file.isEmpty()) {
            return ResponseEntity.badRequest().body(java.util.Map.of("message", "文件为空"));
        }
        SharePackage pkg = objectMapper.readValue(file.getInputStream(), SharePackage.class);
        ImportResult result = shareService.importFromPackage(pkg, apiStrategy, datasetStrategy);
        return ResponseEntity.ok(result);
    }
}
