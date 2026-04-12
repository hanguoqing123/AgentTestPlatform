package com.example.testplatform.service;

import com.example.testplatform.model.DatasetDetail;
import com.example.testplatform.model.DatasetMeta;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.*;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import java.util.stream.Stream;

@Service
public class DatasetService {

    private final ObjectMapper objectMapper;
    private final Path datasetsDir;

    public DatasetService(ObjectMapper objectMapper,
                          @Value("${app.data-dir:./data}") String dataDir) {
        this.objectMapper = objectMapper;
        this.datasetsDir = Path.of(dataDir, "datasets");
    }

    public List<DatasetMeta> listAll() throws IOException {
        List<DatasetMeta> list = new ArrayList<>();
        if (!Files.exists(datasetsDir)) return list;
        try (Stream<Path> dirs = Files.list(datasetsDir)) {
            dirs.filter(Files::isDirectory)
                .forEach(dir -> {
                    Path metaFile = dir.resolve("meta.json");
                    if (Files.exists(metaFile)) {
                        try {
                            list.add(objectMapper.readValue(metaFile.toFile(), DatasetMeta.class));
                        } catch (IOException e) {
                            // skip
                        }
                    }
                });
        }
        list.sort((a, b) -> {
            if (a.getCreatedAt() == null || b.getCreatedAt() == null) return 0;
            return b.getCreatedAt().compareTo(a.getCreatedAt());
        });
        return list;
    }

    public List<DatasetMeta> listByApiId(String apiId) throws IOException {
        return listAll().stream()
                .filter(d -> apiId.equals(d.getApiId()))
                .collect(Collectors.toList());
    }

    public DatasetDetail getByName(String name) throws IOException {
        Path dir = datasetsDir.resolve(name);
        Path metaFile = dir.resolve("meta.json");
        Path dataFile = dir.resolve("data.json");
        if (!Files.exists(metaFile)) return null;

        DatasetMeta meta = objectMapper.readValue(metaFile.toFile(), DatasetMeta.class);
        List<Map<String, Object>> data = new ArrayList<>();
        if (Files.exists(dataFile)) {
            data = objectMapper.readValue(dataFile.toFile(),
                    new TypeReference<List<Map<String, Object>>>() {});
        }
        return new DatasetDetail(meta, data);
    }

    public List<Map<String, Object>> getData(String name) throws IOException {
        Path dataFile = datasetsDir.resolve(name).resolve("data.json");
        if (!Files.exists(dataFile)) return new ArrayList<>();
        return objectMapper.readValue(dataFile.toFile(),
                new TypeReference<List<Map<String, Object>>>() {});
    }

    public DatasetMeta create(String name, String apiId, String description,
                              List<Map<String, Object>> data) throws IOException {
        Path dir = datasetsDir.resolve(name);
        Files.createDirectories(dir);

        DatasetMeta meta = new DatasetMeta();
        meta.setName(name);
        meta.setApiId(apiId);
        meta.setCount(data.size());
        meta.setDescription(description);
        meta.setCreatedAt(LocalDateTime.now());

        objectMapper.writerWithDefaultPrettyPrinter()
                .writeValue(dir.resolve("meta.json").toFile(), meta);
        objectMapper.writerWithDefaultPrettyPrinter()
                .writeValue(dir.resolve("data.json").toFile(), data);

        return meta;
    }

    public boolean delete(String name) throws IOException {
        Path dir = datasetsDir.resolve(name);
        if (!Files.exists(dir)) return false;
        try (Stream<Path> files = Files.walk(dir)) {
            files.sorted(java.util.Comparator.reverseOrder())
                 .forEach(p -> {
                     try { Files.delete(p); } catch (IOException e) { /* skip */ }
                 });
        }
        return true;
    }
}
