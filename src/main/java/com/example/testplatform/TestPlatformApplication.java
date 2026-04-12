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

    public static void main(String[] args) {
        SpringApplication.run(TestPlatformApplication.class, args);
    }

    @Bean
    public ApplicationRunner initDataDirectories() {
        return args -> {
            String[] dirs = {"apis", "datasets", "reports"};
            for (String dir : dirs) {
                Path path = Path.of(dataDir, dir);
                if (!Files.exists(path)) {
                    Files.createDirectories(path);
                }
            }
        };
    }
}
