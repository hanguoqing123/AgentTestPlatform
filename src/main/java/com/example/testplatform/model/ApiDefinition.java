package com.example.testplatform.model;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;

public class ApiDefinition {

    private String id;
    private String name;
    private String url;
    private String method;
    private Map<String, String> headers = new LinkedHashMap<>();
    private Map<String, Object> bodySchema = new LinkedHashMap<>();
    private String responseType = "json"; // json | sse
    private String description;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getUrl() { return url; }
    public void setUrl(String url) { this.url = url; }

    public String getMethod() { return method; }
    public void setMethod(String method) { this.method = method; }

    public Map<String, String> getHeaders() { return headers; }
    public void setHeaders(Map<String, String> headers) { this.headers = headers; }

    public Map<String, Object> getBodySchema() { return bodySchema; }
    public void setBodySchema(Map<String, Object> bodySchema) { this.bodySchema = bodySchema; }

    public String getResponseType() { return responseType; }
    public void setResponseType(String responseType) { this.responseType = responseType; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
