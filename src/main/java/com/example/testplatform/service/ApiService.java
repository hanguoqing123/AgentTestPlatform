package com.example.testplatform.service;

import com.example.testplatform.model.ApiDefinition;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.*;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Stream;

@Service
public class ApiService {

    private final ObjectMapper objectMapper;
    private final Path apisDir;

    public ApiService(ObjectMapper objectMapper,
                      @Value("${app.data-dir:./data}") String dataDir) {
        this.objectMapper = objectMapper;
        this.apisDir = Path.of(dataDir, "apis");
    }

    public List<ApiDefinition> listAll() throws IOException {
        List<ApiDefinition> list = new ArrayList<>();
        if (!Files.exists(apisDir)) return list;
        try (Stream<Path> files = Files.list(apisDir)) {
            files.filter(p -> p.toString().endsWith(".json"))
                 .forEach(p -> {
                     try {
                         list.add(objectMapper.readValue(p.toFile(), ApiDefinition.class));
                     } catch (IOException e) {
                         // skip invalid files
                     }
                 });
        }
        list.sort((a, b) -> {
            if (a.getCreatedAt() == null || b.getCreatedAt() == null) return 0;
            return b.getCreatedAt().compareTo(a.getCreatedAt());
        });
        return list;
    }

    public ApiDefinition getById(String id) throws IOException {
        Path file = apisDir.resolve(id + ".json");
        if (!Files.exists(file)) return null;
        return objectMapper.readValue(file.toFile(), ApiDefinition.class);
    }

    public ApiDefinition save(ApiDefinition api) throws IOException {
        if (api.getId() == null || api.getId().isBlank()) {
            api.setId(generateId(api));
        }
        api.setCreatedAt(LocalDateTime.now());
        api.setUpdatedAt(LocalDateTime.now());
        if (api.getHeaders() == null || api.getHeaders().isEmpty()) {
            api.setHeaders(java.util.Map.of("Content-Type", "application/json"));
        }
        Path file = apisDir.resolve(api.getId() + ".json");
        objectMapper.writerWithDefaultPrettyPrinter().writeValue(file.toFile(), api);
        return api;
    }

    public ApiDefinition update(String id, ApiDefinition api) throws IOException {
        ApiDefinition existing = getById(id);
        if (existing == null) return null;

        api.setId(id);
        api.setCreatedAt(existing.getCreatedAt());
        api.setUpdatedAt(LocalDateTime.now());
        Path file = apisDir.resolve(id + ".json");
        objectMapper.writerWithDefaultPrettyPrinter().writeValue(file.toFile(), api);
        return api;
    }

    public boolean delete(String id) throws IOException {
        Path file = apisDir.resolve(id + ".json");
        return Files.deleteIfExists(file);
    }

    private String generateId(ApiDefinition api) {
        String base = api.getName();
        if (base == null || base.isBlank()) {
            base = api.getUrl();
        }
        return base.toLowerCase()
                .replaceAll("[^a-z0-9\\u4e00-\\u9fa5]+", "-")
                .replaceAll("^-|-$", "");
    }
}
