package com.example.testplatform.model;

import java.time.LocalDateTime;

public class DatasetMeta {

    private String name;
    private String apiId;
    private int count;
    private String description;
    private LocalDateTime createdAt;

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getApiId() { return apiId; }
    public void setApiId(String apiId) { this.apiId = apiId; }

    public int getCount() { return count; }
    public void setCount(int count) { this.count = count; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
