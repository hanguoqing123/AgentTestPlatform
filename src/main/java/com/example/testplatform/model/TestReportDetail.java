package com.example.testplatform.model;

public class TestReportDetail {

    private int index;
    private Object requestBody;
    private int statusCode;
    private long responseTimeMs;
    private boolean success;
    private String responseSummary;
    private String error;

    public int getIndex() { return index; }
    public void setIndex(int index) { this.index = index; }

    public Object getRequestBody() { return requestBody; }
    public void setRequestBody(Object requestBody) { this.requestBody = requestBody; }

    public int getStatusCode() { return statusCode; }
    public void setStatusCode(int statusCode) { this.statusCode = statusCode; }

    public long getResponseTimeMs() { return responseTimeMs; }
    public void setResponseTimeMs(long responseTimeMs) { this.responseTimeMs = responseTimeMs; }

    public boolean isSuccess() { return success; }
    public void setSuccess(boolean success) { this.success = success; }

    public String getResponseSummary() { return responseSummary; }
    public void setResponseSummary(String responseSummary) { this.responseSummary = responseSummary; }

    public String getError() { return error; }
    public void setError(String error) { this.error = error; }
}
