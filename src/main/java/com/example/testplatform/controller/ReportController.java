package com.example.testplatform.controller;

import com.example.testplatform.model.TestReport;
import com.example.testplatform.service.ReportService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.util.List;

@RestController
@RequestMapping("/api/reports")
public class ReportController {

    private final ReportService reportService;

    public ReportController(ReportService reportService) {
        this.reportService = reportService;
    }

    @GetMapping
    public List<TestReport> listAll() throws IOException {
        return reportService.listAll();
    }

    @GetMapping("/{id}")
    public ResponseEntity<TestReport> getById(@PathVariable String id) throws IOException {
        TestReport report = reportService.getById(id);
        return report != null ? ResponseEntity.ok(report) : ResponseEntity.notFound().build();
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable String id) throws IOException {
        return reportService.delete(id)
                ? ResponseEntity.ok().build()
                : ResponseEntity.notFound().build();
    }
}
