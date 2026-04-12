package com.example.testplatform.model;

import java.time.LocalDateTime;
import java.util.List;

public class TestReport {

    private String id;
    private String datasetName;
    private String apiId;
    private String apiName;
    private String url;
    private String method;
    private LocalDateTime startTime;
    private LocalDateTime endTime;
    private int total;
    private int success;
    private int failed;
    private long avgResponseTimeMs;
    private long p95ResponseTimeMs;
    private long maxResponseTimeMs;
    private int maxResponseTimeIndex;
    private List<TestReportDetail> details;

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getDatasetName() { return datasetName; }
    public void setDatasetName(String datasetName) { this.datasetName = datasetName; }

    public String getApiId() { return apiId; }
    public void setApiId(String apiId) { this.apiId = apiId; }

    public String getApiName() { return apiName; }
    public void setApiName(String apiName) { this.apiName = apiName; }

    public String getUrl() { return url; }
    public void setUrl(String url) { this.url = url; }

    public String getMethod() { return method; }
    public void setMethod(String method) { this.method = method; }

    public LocalDateTime getStartTime() { return startTime; }
    public void setStartTime(LocalDateTime startTime) { this.startTime = startTime; }

    public LocalDateTime getEndTime() { return endTime; }
    public void setEndTime(LocalDateTime endTime) { this.endTime = endTime; }

    public int getTotal() { return total; }
    public void setTotal(int total) { this.total = total; }

    public int getSuccess() { return success; }
    public void setSuccess(int success) { this.success = success; }

    public int getFailed() { return failed; }
    public void setFailed(int failed) { this.failed = failed; }

    public long getAvgResponseTimeMs() { return avgResponseTimeMs; }
    public void setAvgResponseTimeMs(long avgResponseTimeMs) { this.avgResponseTimeMs = avgResponseTimeMs; }

    public long getP95ResponseTimeMs() { return p95ResponseTimeMs; }
    public void setP95ResponseTimeMs(long p95ResponseTimeMs) { this.p95ResponseTimeMs = p95ResponseTimeMs; }

    public long getMaxResponseTimeMs() { return maxResponseTimeMs; }
    public void setMaxResponseTimeMs(long maxResponseTimeMs) { this.maxResponseTimeMs = maxResponseTimeMs; }

    public int getMaxResponseTimeIndex() { return maxResponseTimeIndex; }
    public void setMaxResponseTimeIndex(int maxResponseTimeIndex) { this.maxResponseTimeIndex = maxResponseTimeIndex; }

    public List<TestReportDetail> getDetails() { return details; }
    public void setDetails(List<TestReportDetail> details) { this.details = details; }
}
