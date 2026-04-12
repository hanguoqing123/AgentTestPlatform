package com.example.testplatform.controller;

import com.example.testplatform.model.DatasetDetail;
import com.example.testplatform.model.DatasetMeta;
import com.example.testplatform.service.DatasetService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/datasets")
public class DatasetController {

    private final DatasetService datasetService;

    public DatasetController(DatasetService datasetService) {
        this.datasetService = datasetService;
    }

    @GetMapping
    public List<DatasetMeta> list(@RequestParam(required = false) String apiId) throws IOException {
        if (apiId != null && !apiId.isBlank()) {
            return datasetService.listByApiId(apiId);
        }
        return datasetService.listAll();
    }

    @GetMapping("/{name}")
    public ResponseEntity<DatasetDetail> getByName(@PathVariable String name) throws IOException {
        DatasetDetail detail = datasetService.getByName(name);
        return detail != null ? ResponseEntity.ok(detail) : ResponseEntity.notFound().build();
    }

    @PostMapping
    public DatasetMeta create(@RequestBody CreateDatasetRequest request) throws IOException {
        return datasetService.create(
                request.name, request.apiId, request.description, request.data);
    }

    @DeleteMapping("/{name}")
    public ResponseEntity<Void> delete(@PathVariable String name) throws IOException {
        return datasetService.delete(name)
                ? ResponseEntity.ok().build()
                : ResponseEntity.notFound().build();
    }

    public static class CreateDatasetRequest {
        public String name;
        public String apiId;
        public String description;
        public List<Map<String, Object>> data;
    }
}
