package com.example.testplatform.model;

import java.util.Map;

public class TestExecutionRequest {

    private String apiId;
    private String datasetName;
    private int concurrency = 1;
    private int timeout = 30;
    private int retries = 3;
    private int retryInterval = 1;
    private int requestInterval = 0;  // 请求间隔(毫秒)，0 表示无间隔
    private Map<String, String> headers;
    private String token;

    public String getApiId() { return apiId; }
    public void setApiId(String apiId) { this.apiId = apiId; }

    public String getDatasetName() { return datasetName; }
    public void setDatasetName(String datasetName) { this.datasetName = datasetName; }

    public int getConcurrency() { return concurrency; }
    public void setConcurrency(int concurrency) { this.concurrency = concurrency; }

    public int getTimeout() { return timeout; }
    public void setTimeout(int timeout) { this.timeout = timeout; }

    public int getRetries() { return retries; }
    public void setRetries(int retries) { this.retries = retries; }

    public int getRetryInterval() { return retryInterval; }
    public void setRetryInterval(int retryInterval) { this.retryInterval = retryInterval; }

    public int getRequestInterval() { return requestInterval; }
    public void setRequestInterval(int requestInterval) { this.requestInterval = requestInterval; }

    public Map<String, String> getHeaders() { return headers; }
    public void setHeaders(Map<String, String> headers) { this.headers = headers; }

    public String getToken() { return token; }
    public void setToken(String token) { this.token = token; }
}
