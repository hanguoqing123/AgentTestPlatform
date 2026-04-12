package com.example.testplatform;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.scheduling.annotation.EnableAsync;

import java.nio.file.Files;
import java.nio.file.Path;

@SpringBootApplication
@EnableAsync
public class TestPlatformApplication {

    @Value("${app.data-dir:./data}")
    private String dataDir;

    @Value("${server.port:8899}")
    private int serverPort;

    public static void main(String[] args) {
        SpringApplication.run(TestPlatformApplication.class, args);
    }

    @Bean
    public ApplicationRunner init() {
        return args -> {
            // 初始化数据目录
            String[] dirs = {"apis", "datasets", "reports"};
            for (String dir : dirs) {
                Path path = Path.of(dataDir, dir);
                if (!Files.exists(path)) {
                    Files.createDirectories(path);
                }
            }

            // 输出访问地址
            System.out.println();
            System.out.println("==============================================");
            System.out.println("  ⚡ AgentTestPlatform 启动成功！");
            System.out.println("  访问地址: http://localhost:" + serverPort);
            System.out.println("==============================================");
            System.out.println();
        };
    }
}
