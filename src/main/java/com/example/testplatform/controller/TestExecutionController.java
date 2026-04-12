package com.example.testplatform.controller;

import com.example.testplatform.model.TestExecutionRequest;
import com.example.testplatform.service.TestExecutionService;
import javax.servlet.http.HttpServletResponse;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@RestController
@RequestMapping("/api/test")
public class TestExecutionController {

    private final TestExecutionService testExecutionService;

    public TestExecutionController(TestExecutionService testExecutionService) {
        this.testExecutionService = testExecutionService;
    }

    @PostMapping(value = "/execute", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter execute(@RequestBody TestExecutionRequest request,
                              HttpServletResponse response) {
        // 防止代理层缓冲 SSE 流
        response.setHeader("X-Accel-Buffering", "no");
        response.setHeader("Cache-Control", "no-cache, no-transform");
        response.setHeader("Connection", "keep-alive");

        // 10 分钟超时，足够长时间运行的测试
        SseEmitter emitter = new SseEmitter(600_000L);

        emitter.onCompletion(() -> {});
        emitter.onTimeout(emitter::complete);
        emitter.onError(e -> {});

        testExecutionService.execute(request, emitter);
        return emitter;
    }
}
