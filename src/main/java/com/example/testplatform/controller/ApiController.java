package com.example.testplatform.controller;

import com.example.testplatform.model.ApiDefinition;
import com.example.testplatform.service.ApiService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.util.List;

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
}
