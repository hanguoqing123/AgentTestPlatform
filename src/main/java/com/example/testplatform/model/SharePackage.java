package com.example.testplatform.model;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * 分享包：包含一个 API 定义及其所有关联数据集，序列化为 JSON 文件供导出/导入
 */
public class SharePackage {

    private LocalDateTime createdAt;

    // API 信息
    private ApiDefinition api;

    // 该 API 下所有数据集
    private List<DatasetSnapshot> datasets;

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public ApiDefinition getApi() { return api; }
    public void setApi(ApiDefinition api) { this.api = api; }

    public List<DatasetSnapshot> getDatasets() { return datasets; }
    public void setDatasets(List<DatasetSnapshot> datasets) { this.datasets = datasets; }

    /**
     * 数据集快照：meta + data 打包在一起
     */
    public static class DatasetSnapshot {
        private DatasetMeta meta;
        private List<Map<String, Object>> data;

        public DatasetSnapshot() {}

        public DatasetSnapshot(DatasetMeta meta, List<Map<String, Object>> data) {
            this.meta = meta;
            this.data = data;
        }

        public DatasetMeta getMeta() { return meta; }
        public void setMeta(DatasetMeta meta) { this.meta = meta; }

        public List<Map<String, Object>> getData() { return data; }
        public void setData(List<Map<String, Object>> data) { this.data = data; }
    }
}
