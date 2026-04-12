package com.example.testplatform.service;

import com.example.testplatform.model.TestReport;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.*;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Stream;

@Service
public class ReportService {

    private final ObjectMapper objectMapper;
    private final Path reportsDir;

    public ReportService(ObjectMapper objectMapper,
                         @Value("${app.data-dir:./data}") String dataDir) {
        this.objectMapper = objectMapper;
        this.reportsDir = Path.of(dataDir, "reports");
    }

    public List<TestReport> listAll() throws IOException {
        List<TestReport> list = new ArrayList<>();
        if (!Files.exists(reportsDir)) return list;
        try (Stream<Path> files = Files.list(reportsDir)) {
            files.filter(p -> p.toString().endsWith(".json"))
                 .forEach(p -> {
                     try {
                         TestReport report = objectMapper.readValue(p.toFile(), TestReport.class);
                         // 列表不返回 details 以减少数据量
                         report.setDetails(null);
                         list.add(report);
                     } catch (IOException e) {
                         // skip
                     }
                 });
        }
        list.sort((a, b) -> {
            if (a.getStartTime() == null || b.getStartTime() == null) return 0;
            return b.getStartTime().compareTo(a.getStartTime());
        });
        return list;
    }

    public TestReport getById(String id) throws IOException {
        Path file = reportsDir.resolve(id + ".json");
        if (!Files.exists(file)) return null;
        return objectMapper.readValue(file.toFile(), TestReport.class);
    }

    public void save(TestReport report) throws IOException {
        Path file = reportsDir.resolve(report.getId() + ".json");
        objectMapper.writerWithDefaultPrettyPrinter().writeValue(file.toFile(), report);
    }

    public boolean delete(String id) throws IOException {
        Path file = reportsDir.resolve(id + ".json");
        return Files.deleteIfExists(file);
    }
}
