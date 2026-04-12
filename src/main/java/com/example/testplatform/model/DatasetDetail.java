package com.example.testplatform.model;

import java.util.List;
import java.util.Map;

public class DatasetDetail {

    private DatasetMeta meta;
    private List<Map<String, Object>> data;

    public DatasetDetail() {}

    public DatasetDetail(DatasetMeta meta, List<Map<String, Object>> data) {
        this.meta = meta;
        this.data = data;
    }

    public DatasetMeta getMeta() { return meta; }
    public void setMeta(DatasetMeta meta) { this.meta = meta; }

    public List<Map<String, Object>> getData() { return data; }
    public void setData(List<Map<String, Object>> data) { this.data = data; }
}
