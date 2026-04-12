# ===== 阶段 1: 构建前端 =====
FROM node:18-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install --registry=https://registry.npmmirror.com
COPY frontend/ ./
RUN npm run build

# ===== 阶段 2: 构建后端 =====
FROM maven:3.9-eclipse-temurin-11 AS backend-build
WORKDIR /app
COPY pom.xml ./
RUN mvn dependency:go-offline -q
COPY src/ ./src/
COPY --from=frontend-build /app/frontend/dist/ ./src/main/resources/static/
RUN mvn clean package -DskipTests -q

# ===== 阶段 3: 运行 =====
FROM eclipse-temurin:11-jre-alpine
WORKDIR /app
COPY --from=backend-build /app/target/AgentTestPlatform-1.0.0.jar app.jar

# 数据目录
RUN mkdir -p /app/data/apis /app/data/datasets /app/data/reports
VOLUME /app/data

EXPOSE 8899

ENTRYPOINT ["java", "-jar", "app.jar"]
