package com.example.testplatform.service;

import com.example.testplatform.model.ApiDefinition;
import com.example.testplatform.model.DatasetDetail;
import com.example.testplatform.model.DatasetMeta;
import com.example.testplatform.model.SharePackage;
import com.example.testplatform.model.SharePackage.DatasetSnapshot;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.*;

@Service
public class ShareService {

    private final ApiService apiService;
    private final DatasetService datasetService;

    public ShareService(ApiService apiService, DatasetService datasetService) {
        this.apiService = apiService;
        this.datasetService = datasetService;
    }

    /**
     * 构建分享包（不持久化，直接返回对象供 Controller 序列化下载）
     */
    public SharePackage buildSharePackage(String apiId) throws IOException {
        ApiDefinition api = apiService.getById(apiId);
        if (api == null) {
            throw new IllegalArgumentException("接口不存在：" + apiId);
        }

        List<DatasetMeta> metas = datasetService.listByApiId(apiId);
        List<DatasetSnapshot> snapshots = new ArrayList<>();
        for (DatasetMeta meta : metas) {
            List<Map<String, Object>> data = datasetService.getData(meta.getName());
            snapshots.add(new DatasetSnapshot(meta, data));
        }

        SharePackage pkg = new SharePackage();
        pkg.setCreatedAt(LocalDateTime.now());
        pkg.setApi(api);
        pkg.setDatasets(snapshots);
        return pkg;
    }

    /**
     * 从分享包导入
     */
    public ImportResult importFromPackage(SharePackage pkg, String apiStrategy, String datasetStrategy) throws IOException {
        if (pkg == null || pkg.getApi() == null) {
            throw new IllegalArgumentException("分享文件格式无效");
        }

        ImportResult result = new ImportResult();
        ApiDefinition sourceApi = pkg.getApi();

        // 1. 导入接口
        String targetApiId = importApi(sourceApi, apiStrategy, result);

        // 2. 导入数据集
        if (pkg.getDatasets() != null) {
            for (DatasetSnapshot ds : pkg.getDatasets()) {
                importDataset(ds, targetApiId, datasetStrategy, result);
            }
        }

        return result;
    }

    private String importApi(ApiDefinition sourceApi, String strategy, ImportResult result) throws IOException {
        ApiDefinition existing = apiService.getById(sourceApi.getId());

        if (existing == null) {
            ApiDefinition newApi = cloneApiForImport(sourceApi, sourceApi.getName());
            try {
                apiService.save(newApi);
                result.apiStatus = "imported";
                result.apiName = newApi.getName();
                return newApi.getId();
            } catch (IllegalArgumentException e) {
                // URL+Method 重复
                if (strategy == null) strategy = "skip";
                return handleApiConflictByUrlMethod(sourceApi, strategy, result);
            }
        }

        // 同名接口存在
        if (strategy == null) strategy = "skip";
        switch (strategy) {
            case "overwrite":
                apiService.delete(existing.getId());
                ApiDefinition overwriteApi = cloneApiForImport(sourceApi, sourceApi.getName());
                apiService.save(overwriteApi);
                result.apiStatus = "overwritten";
                result.apiName = overwriteApi.getName();
                return overwriteApi.getId();

            case "rename":
                String newName = generateUniqueName(sourceApi.getName());
                ApiDefinition renamedApi = cloneApiForImport(sourceApi, newName);
                apiService.save(renamedApi);
                result.apiStatus = "renamed";
                result.apiName = renamedApi.getName();
                return renamedApi.getId();

            case "skip":
            default:
                result.apiStatus = "skipped";
                result.apiName = existing.getName();
                return existing.getId();
        }
    }

    private String handleApiConflictByUrlMethod(ApiDefinition sourceApi, String strategy, ImportResult result) throws IOException {
        List<ApiDefinition> allApis = apiService.listAll();
        ApiDefinition conflicting = allApis.stream()
                .filter(a -> sourceApi.getUrl().equals(a.getUrl()) &&
                             sourceApi.getMethod().equalsIgnoreCase(a.getMethod()))
                .findFirst().orElse(null);

        switch (strategy) {
            case "overwrite":
                if (conflicting != null) {
                    apiService.delete(conflicting.getId());
                }
                ApiDefinition overwriteApi = cloneApiForImport(sourceApi, sourceApi.getName());
                apiService.save(overwriteApi);
                result.apiStatus = "overwritten";
                result.apiName = overwriteApi.getName();
                return overwriteApi.getId();

            case "rename":
                // URL+Method 冲突无法通过改名解决，退化为 skip
                result.apiStatus = "skipped";
                result.apiName = conflicting != null ? conflicting.getName() : sourceApi.getName();
                result.apiMessage = "URL+Method 重复，已使用已有接口";
                return conflicting != null ? conflicting.getId() : sourceApi.getId();

            case "skip":
            default:
                result.apiStatus = "skipped";
                result.apiName = conflicting != null ? conflicting.getName() : sourceApi.getName();
                return conflicting != null ? conflicting.getId() : sourceApi.getId();
        }
    }

    private void importDataset(DatasetSnapshot ds, String targetApiId, String strategy, ImportResult result) throws IOException {
        DatasetMeta meta = ds.getMeta();
        String originalName = meta.getName();

        DatasetDetail existing = datasetService.getByName(originalName);

        if (existing == null) {
            datasetService.create(originalName, targetApiId, meta.getDescription(), ds.getData());
            result.datasetResults.add(new DatasetImportStatus(originalName, "imported", originalName));
            return;
        }

        if (strategy == null) strategy = "skip";
        switch (strategy) {
            case "overwrite":
                datasetService.delete(originalName);
                datasetService.create(originalName, targetApiId, meta.getDescription(), ds.getData());
                result.datasetResults.add(new DatasetImportStatus(originalName, "overwritten", originalName));
                break;

            case "rename":
                String newName = generateUniqueDatasetName(originalName);
                datasetService.create(newName, targetApiId, meta.getDescription(), ds.getData());
                result.datasetResults.add(new DatasetImportStatus(originalName, "renamed", newName));
                break;

            case "skip":
            default:
                result.datasetResults.add(new DatasetImportStatus(originalName, "skipped", originalName));
                break;
        }
    }

    private ApiDefinition cloneApiForImport(ApiDefinition source, String name) {
        ApiDefinition api = new ApiDefinition();
        api.setName(name);
        api.setUrl(source.getUrl());
        api.setMethod(source.getMethod());
        api.setHeaders(source.getHeaders() != null ? new LinkedHashMap<>(source.getHeaders()) : null);
        api.setBodySchema(source.getBodySchema() != null ? new LinkedHashMap<>(source.getBodySchema()) : null);
        api.setResponseType(source.getResponseType());
        api.setDescription(source.getDescription());
        return api;
    }

    private String generateUniqueName(String baseName) throws IOException {
        List<ApiDefinition> allApis = apiService.listAll();
        String candidate = baseName + " (导入)";
        int counter = 2;
        while (true) {
            final String check = candidate;
            boolean exists = allApis.stream().anyMatch(a -> check.equals(a.getName()));
            if (!exists) return candidate;
            candidate = baseName + " (导入 " + counter + ")";
            counter++;
            if (counter > 100) {
                return baseName + " (导入 " + System.currentTimeMillis() + ")";
            }
        }
    }

    private String generateUniqueDatasetName(String baseName) throws IOException {
        String candidate = baseName + "_imported";
        int counter = 2;
        while (datasetService.getByName(candidate) != null) {
            candidate = baseName + "_imported_" + counter;
            counter++;
            if (counter > 100) {
                candidate = baseName + "_" + System.currentTimeMillis();
                break;
            }
        }
        return candidate;
    }

    // ========== 结果模型 ==========

    public static class ImportResult {
        public String apiStatus;
        public String apiName;
        public String apiMessage;
        public List<DatasetImportStatus> datasetResults = new ArrayList<>();
    }

    public static class DatasetImportStatus {
        public String originalName;
        public String status;
        public String finalName;

        public DatasetImportStatus() {}

        public DatasetImportStatus(String originalName, String status, String finalName) {
            this.originalName = originalName;
            this.status = status;
            this.finalName = finalName;
        }
    }
}
