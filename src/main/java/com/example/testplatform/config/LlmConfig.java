package com.example.testplatform.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@ConfigurationProperties(prefix = "app.llm")
public class LlmConfig {

    private String apiUrl = "https://api.openai.com/v1/chat/completions";
    private String apiKey = "";
    private String model = "gpt-4o-mini";
    private int maxTokens = 4096;
    private double temperature = 0.8;

    public String getApiUrl() { return apiUrl; }
    public void setApiUrl(String apiUrl) { this.apiUrl = apiUrl; }

    public String getApiKey() { return apiKey; }
    public void setApiKey(String apiKey) { this.apiKey = apiKey; }

    public String getModel() { return model; }
    public void setModel(String model) { this.model = model; }

    public int getMaxTokens() { return maxTokens; }
    public void setMaxTokens(int maxTokens) { this.maxTokens = maxTokens; }

    public double getTemperature() { return temperature; }
    public void setTemperature(double temperature) { this.temperature = temperature; }

    public boolean isConfigured() {
        return apiKey != null && !apiKey.isBlank() && apiUrl != null && !apiUrl.isBlank();
    }
}
