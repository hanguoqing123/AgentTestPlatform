package com.example.testplatform.service;

import com.example.testplatform.model.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.*;

@Service
public class TestExecutionService {

    private static final Logger log = LoggerFactory.getLogger(TestExecutionService.class);

    private final ApiService apiService;
    private final DatasetService datasetService;
    private final ReportService reportService;
    private final ObjectMapper objectMapper;

    public TestExecutionService(ApiService apiService, DatasetService datasetService,
                                ReportService reportService, ObjectMapper objectMapper) {
        this.apiService = apiService;
        this.datasetService = datasetService;
        this.reportService = reportService;
        this.objectMapper = objectMapper;
    }

    @Async
    public void execute(TestExecutionRequest request, SseEmitter emitter) {
        try {
            doExecute(request, emitter);
        } catch (Exception e) {
            log.error("Test execution failed", e);
            try {
                Map<String, Object> errorEvent = Map.of(
                        "type", "error",
                        "message", e.getMessage() != null ? e.getMessage() : "Unknown error"
                );
                emitter.send(SseEmitter.event()
                        .name("error")
                        .data(objectMapper.writeValueAsString(errorEvent)));
                emitter.complete();
            } catch (Exception ex) {
                emitter.completeWithError(ex);
            }
        }
    }

    private void doExecute(TestExecutionRequest request, SseEmitter emitter) throws Exception {
        // 1. 加载 API 定义
        ApiDefinition api = apiService.getById(request.getApiId());
        if (api == null) {
            throw new IllegalArgumentException("API not found: " + request.getApiId());
        }

        // 2. 加载数据集
        List<Map<String, Object>> dataset = datasetService.getData(request.getDatasetName());
        if (dataset.isEmpty()) {
            throw new IllegalArgumentException("Dataset is empty: " + request.getDatasetName());
        }

        int total = dataset.size();
        boolean isSse = "sse".equalsIgnoreCase(api.getResponseType());
        int timeoutSeconds = request.getTimeout() > 0 ? request.getTimeout() : (isSse ? 120 : 30);

        // 3. 构建 HTTP 客户端
        HttpClient httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(10))
                .build();

        // 4. 准备请求头
        Map<String, String> headers = new LinkedHashMap<>();
        if (api.getHeaders() != null) headers.putAll(api.getHeaders());
        if (request.getHeaders() != null) headers.putAll(request.getHeaders());
        if (request.getToken() != null && !request.getToken().isBlank()) {
            String token = request.getToken();
            if (!token.startsWith("Bearer ")) token = "Bearer " + token;
            headers.put("Authorization", token);
        }
        if (isSse) {
            headers.put("Accept", "text/event-stream");
        }

        // 5. 执行请求
        List<TestReportDetail> details = Collections.synchronizedList(new ArrayList<>());
        List<Long> responseTimes = Collections.synchronizedList(new ArrayList<>());
        int[] successCount = {0};
        int[] failedCount = {0};

        long startMs = System.currentTimeMillis();
        LocalDateTime startTime = LocalDateTime.now();

        int concurrency = Math.max(1, request.getConcurrency());
        ExecutorService executor = Executors.newFixedThreadPool(Math.min(concurrency, 20));

        Semaphore semaphore = new Semaphore(concurrency);
        CountDownLatch latch = new CountDownLatch(total);

        for (int i = 0; i < total; i++) {
            final int index = i;
            final Map<String, Object> body = dataset.get(i);

            executor.submit(() -> {
                try {
                    semaphore.acquire();
                    TestReportDetail detail = executeOneRequest(
                            httpClient, api.getUrl(), api.getMethod(),
                            headers, body, timeoutSeconds, isSse,
                            request.getRetries(), request.getRetryInterval(),
                            index);
                    details.add(detail);
                    responseTimes.add(detail.getResponseTimeMs());

                    if (detail.isSuccess()) {
                        synchronized (successCount) { successCount[0]++; }
                    } else {
                        synchronized (failedCount) { failedCount[0]++; }
                    }

                    // 发送进度事件
                    int completed = details.size();
                    long elapsed = System.currentTimeMillis() - startMs;
                    Map<String, Object> progressEvent = new LinkedHashMap<>();
                    progressEvent.put("type", "progress");
                    progressEvent.put("current", completed);
                    progressEvent.put("total", total);
                    progressEvent.put("success", successCount[0]);
                    progressEvent.put("failed", failedCount[0]);
                    progressEvent.put("elapsedMs", elapsed);

                    Map<String, Object> detailEvent = new LinkedHashMap<>();
                    detailEvent.put("type", "detail");
                    detailEvent.put("index", detail.getIndex());
                    detailEvent.put("statusCode", detail.getStatusCode());
                    detailEvent.put("responseTimeMs", detail.getResponseTimeMs());
                    detailEvent.put("success", detail.isSuccess());
                    if (detail.getError() != null) {
                        detailEvent.put("error", detail.getError());
                    }

                    try {
                        synchronized (emitter) {
                            emitter.send(SseEmitter.event()
                                    .name("progress")
                                    .data(objectMapper.writeValueAsString(progressEvent)));
                            emitter.send(SseEmitter.event()
                                    .name("detail")
                                    .data(objectMapper.writeValueAsString(detailEvent)));
                        }
                    } catch (Exception sendEx) {
                        log.warn("Failed to send SSE event for request {}: {}", index, sendEx.getMessage());
                    }
                } catch (Exception e) {
                    log.error("Error executing request {}", index, e);
                } finally {
                    semaphore.release();
                    latch.countDown();
                }
            });
        }

        latch.await();
        executor.shutdown();

        // 6. 计算统计信息
        LocalDateTime endTime = LocalDateTime.now();
        details.sort(Comparator.comparingInt(TestReportDetail::getIndex));

        long avgTime = 0;
        long p95Time = 0;
        long maxTime = 0;
        int maxIndex = 0;

        if (!responseTimes.isEmpty()) {
            List<Long> sortedTimes = new ArrayList<>(responseTimes);
            Collections.sort(sortedTimes);

            avgTime = sortedTimes.stream().mapToLong(Long::longValue).sum() / sortedTimes.size();
            int p95Idx = Math.max(0, (int) Math.ceil(sortedTimes.size() * 0.95) - 1);
            p95Time = sortedTimes.get(p95Idx);
            maxTime = sortedTimes.get(sortedTimes.size() - 1);

            for (TestReportDetail d : details) {
                if (d.getResponseTimeMs() == maxTime) {
                    maxIndex = d.getIndex();
                    break;
                }
            }
        }

        // 7. 生成报告
        String reportId = "rpt-" + DateTimeFormatter.ofPattern("yyyyMMdd-HHmmss").format(startTime);
        TestReport report = new TestReport();
        report.setId(reportId);
        report.setDatasetName(request.getDatasetName());
        report.setApiId(api.getId());
        report.setApiName(api.getName());
        report.setUrl(api.getUrl());
        report.setMethod(api.getMethod());
        report.setStartTime(startTime);
        report.setEndTime(endTime);
        report.setTotal(total);
        report.setSuccess(successCount[0]);
        report.setFailed(failedCount[0]);
        report.setAvgResponseTimeMs(avgTime);
        report.setP95ResponseTimeMs(p95Time);
        report.setMaxResponseTimeMs(maxTime);
        report.setMaxResponseTimeIndex(maxIndex);
        report.setDetails(details);

        reportService.save(report);

        // 8. 发送完成事件
        Map<String, Object> completeEvent = new LinkedHashMap<>();
        completeEvent.put("type", "complete");
        completeEvent.put("reportId", reportId);
        completeEvent.put("total", total);
        completeEvent.put("success", successCount[0]);
        completeEvent.put("failed", failedCount[0]);
        completeEvent.put("avgResponseTimeMs", avgTime);
        completeEvent.put("p95ResponseTimeMs", p95Time);
        completeEvent.put("maxResponseTimeMs", maxTime);

        try {
            emitter.send(SseEmitter.event()
                    .name("complete")
                    .data(objectMapper.writeValueAsString(completeEvent)));
            emitter.complete();
        } catch (Exception e) {
            log.warn("Failed to send complete event: {}", e.getMessage());
            try { emitter.complete(); } catch (Exception ignored) {}
        }
    }

    private TestReportDetail executeOneRequest(HttpClient client, String url, String method,
                                                Map<String, String> headers, Map<String, Object> body,
                                                int timeoutSeconds, boolean isSse,
                                                int retries, int retryInterval, int index) {
        TestReportDetail detail = new TestReportDetail();
        detail.setIndex(index);
        detail.setRequestBody(body);

        for (int attempt = 0; attempt <= retries; attempt++) {
            try {
                String bodyJson = objectMapper.writeValueAsString(body);

                HttpRequest.Builder reqBuilder = HttpRequest.newBuilder()
                        .uri(URI.create(url))
                        .timeout(Duration.ofSeconds(timeoutSeconds));

                // 设置请求头
                for (Map.Entry<String, String> h : headers.entrySet()) {
                    reqBuilder.header(h.getKey(), h.getValue());
                }

                // 设置 HTTP 方法和请求体
                switch (method.toUpperCase()) {
                    case "POST":
                        reqBuilder.POST(HttpRequest.BodyPublishers.ofString(bodyJson));
                        break;
                    case "PUT":
                        reqBuilder.PUT(HttpRequest.BodyPublishers.ofString(bodyJson));
                        break;
                    case "DELETE":
                        reqBuilder.DELETE();
                        break;
                    default:
                        reqBuilder.GET();
                        break;
                }

                long requestStart = System.currentTimeMillis();

                if (isSse) {
                    // SSE 流式响应
                    HttpResponse<java.io.InputStream> response = client.send(
                            reqBuilder.build(),
                            HttpResponse.BodyHandlers.ofInputStream());

                    detail.setStatusCode(response.statusCode());
                    StringBuilder sb = new StringBuilder();
                    try (BufferedReader reader = new BufferedReader(
                            new InputStreamReader(response.body()))) {
                        String line;
                        int eventCount = 0;
                        while ((line = reader.readLine()) != null) {
                            if (line.startsWith("data:")) {
                                eventCount++;
                                if (sb.length() < 2000) {
                                    sb.append(line).append("\n");
                                }
                            }
                        }
                        sb.append("[SSE events: ").append(eventCount).append("]");
                    }
                    detail.setResponseTimeMs(System.currentTimeMillis() - requestStart);
                    detail.setResponseSummary(truncate(sb.toString(), 2000));
                } else {
                    // 普通 JSON 响应
                    HttpResponse<String> response = client.send(
                            reqBuilder.build(),
                            HttpResponse.BodyHandlers.ofString());

                    detail.setStatusCode(response.statusCode());
                    detail.setResponseTimeMs(System.currentTimeMillis() - requestStart);
                    detail.setResponseSummary(truncate(response.body(), 2000));
                }

                detail.setSuccess(detail.getStatusCode() >= 200 && detail.getStatusCode() < 300);

                if (detail.isSuccess()) {
                    return detail; // 成功则不重试
                }

            } catch (Exception e) {
                detail.setSuccess(false);
                detail.setError(e.getClass().getSimpleName() + ": " + e.getMessage());
                detail.setResponseTimeMs(System.currentTimeMillis());
            }

            // 重试等待
            if (attempt < retries) {
                try {
                    Thread.sleep(retryInterval * 1000L);
                } catch (InterruptedException ie) {
                    Thread.currentThread().interrupt();
                    break;
                }
            }
        }

        return detail;
    }

    private String truncate(String s, int maxLen) {
        if (s == null) return null;
        return s.length() <= maxLen ? s : s.substring(0, maxLen) + "...(truncated)";
    }
}
