# Sealos 部署指南

本文档详细说明如何在 Sealos 平台上部署 MindFlow Backend 服务。

## 📋 前置准备

### 1. 注册 Sealos 账号

访问 [https://cloud.sealos.io](https://cloud.sealos.io) 注册账号并充值。

**建议充值**：100 元人民币（可用约 1 个月）

### 2. 准备 API 密钥

确保已获取以下第三方 API 密钥：

- **Doubao ASR**（可选）
  - App Key
  - Access Key

- **Coze AI**（必须，用于 NVC 分析）
  - API Token
  - Project ID

如果没有这些密钥，AI 功能将不可用，但其他功能（认证、记录管理、数据同步）可以正常工作。

### 3. 准备本地环境

确保本地已安装：
- Docker（用于构建镜像）
- Git（用于代码推送）

---

## 🚀 部署步骤

### 第一步：初始化 Git 仓库并推送代码

```bash
# 1. 进入项目目录
cd /Users/bytedance/Documents/Code/Ocean-backend

# 2. 初始化 Git 仓库
git init

# 3. 添加所有文件
git add .

# 4. 创建首次提交
git commit -m "Initial commit: MindFlow Backend

- 认证模块（JWT 双 Token + 多设备管理）
- 记录管理模块（CRUD + 乐观锁 + 全文搜索）
- AI 代理模块（Coze NVC 分析，SSE 流式）
- 数据同步模块（增量拉取 + 批量推送 + 冲突检测）
- 完整文档（README、PROGRESS、CLIENT_INTEGRATION_GUIDE、SUMMARY）

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"

# 5. 添加远程仓库
git remote add origin https://github.com/BinGess/Ocean-backend.git

# 6. 推送到 GitHub（需要 GitHub 账号权限）
git push -u origin main
```

### 第二步：在 Sealos 创建 PostgreSQL 数据库

1. **登录 Sealos 控制台**
   - 访问：https://cloud.sealos.io
   - 点击"桌面" → "数据库"

2. **创建 PostgreSQL 数据库**
   - 点击"新建数据库"
   - 选择数据库类型：**PostgreSQL 14**
   - 配置参数：
     - 数据库名称：`mindflow-db`
     - CPU：`0.5 核`
     - 内存：`1 GB`
     - 存储：`5 GB`
   - 点击"创建"

3. **等待数据库就绪**
   - 等待约 1-2 分钟，直到状态变为"运行中"
   - 记录连接信息（会在创建完成后显示）：
     ```
     主机名：mindflow-db.ns-xxx.svc.cluster.local
     端口：5432
     用户名：postgres
     密码：<自动生成的密码>
     数据库名：postgres
     ```

4. **创建应用数据库**
   - 点击数据库卡片 → "终端"
   - 执行以下命令创建 mindflow 数据库：
     ```sql
     CREATE DATABASE mindflow;
     ```

### 第三步：初始化数据库 Schema

1. **打开数据库终端**
   - 在 Sealos 数据库管理界面，点击 `mindflow-db` → "终端"

2. **连接到 mindflow 数据库**
   ```bash
   \c mindflow
   ```

3. **复制并执行初始化脚本**
   - 打开本地文件：`src/database/migrations/001_initial_schema.sql`
   - 将全部内容复制粘贴到 Sealos 数据库终端
   - 执行脚本（会创建 8 张表、索引、触发器）

4. **验证表是否创建成功**
   ```sql
   \dt
   ```

   应该看到以下 8 张表：
   ```
   users
   devices
   refresh_tokens
   records
   weekly_insights
   insight_reports
   sync_logs
   ai_api_logs
   ```

### 第四步：构建 Docker 镜像

由于 Sealos 镜像仓库需要登录，我们使用 **Docker Hub** 作为镜像仓库。

1. **登录 Docker Hub**
   ```bash
   docker login
   ```

   输入你的 Docker Hub 用户名和密码。

2. **构建镜像**
   ```bash
   # 替换 <your-dockerhub-username> 为你的 Docker Hub 用户名
   docker build -t <your-dockerhub-username>/mindflow-backend:latest .

   # 例如：
   # docker build -t bingess/mindflow-backend:latest .
   ```

3. **推送镜像到 Docker Hub**
   ```bash
   docker push <your-dockerhub-username>/mindflow-backend:latest
   ```

   推送完成后，镜像地址为：`<your-dockerhub-username>/mindflow-backend:latest`

**或者使用 Sealos 镜像服务（推荐）**：

Sealos 提供了内置的镜像构建服务，可以直接从 GitHub 仓库构建：

1. 点击 Sealos 桌面 → "镜像服务"
2. 点击"新建镜像"
3. 配置：
   - 仓库地址：`https://github.com/BinGess/Ocean-backend.git`
   - 分支：`main`
   - Dockerfile 路径：`./Dockerfile`
4. 点击"构建"
5. 等待构建完成，记录镜像地址（类似：`registry.sealos.io/xxx/mindflow-backend:latest`）

### 第五步：创建应用部署

1. **进入应用管理**
   - 点击 Sealos 桌面 → "应用管理"

2. **使用 YAML 部署**
   - 点击右上角"YAML 部署"
   - 将以下 YAML 内容复制粘贴到编辑器：

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: mindflow-secrets
type: Opaque
stringData:
  # 数据库连接信息（需要替换为你的实际值）
  DATABASE_HOST: "mindflow-db.ns-xxx.svc.cluster.local"
  DATABASE_PORT: "5432"
  DATABASE_USERNAME: "postgres"
  DATABASE_PASSWORD: "<你的数据库密码>"
  DATABASE_NAME: "mindflow"

  # JWT 密钥（请生成强随机字符串）
  # 使用命令生成：openssl rand -base64 32
  JWT_SECRET: "<生成 32 字节随机字符串>"
  JWT_REFRESH_SECRET: "<生成另一个 32 字节随机字符串>"

  # 第三方 API 密钥（可选）
  DOUBAO_ASR_APP_KEY: ""
  DOUBAO_ASR_ACCESS_KEY: ""
  COZE_API_TOKEN: "<你的 Coze API Token>"
  COZE_PROJECT_ID: "<你的 Coze Project ID>"

---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: mindflow-backend
  labels:
    app: mindflow-backend
spec:
  replicas: 2
  selector:
    matchLabels:
      app: mindflow-backend
  template:
    metadata:
      labels:
        app: mindflow-backend
    spec:
      containers:
      - name: backend
        # 替换为你的镜像地址
        image: <your-dockerhub-username>/mindflow-backend:latest
        # 或使用 Sealos 镜像服务地址
        # image: registry.sealos.io/xxx/mindflow-backend:latest

        ports:
        - containerPort: 3000
          name: http

        env:
        - name: NODE_ENV
          value: "production"
        - name: PORT
          value: "3000"

        # 从 Secret 读取敏感配置
        - name: DATABASE_HOST
          valueFrom:
            secretKeyRef:
              name: mindflow-secrets
              key: DATABASE_HOST
        - name: DATABASE_PORT
          valueFrom:
            secretKeyRef:
              name: mindflow-secrets
              key: DATABASE_PORT
        - name: DATABASE_USERNAME
          valueFrom:
            secretKeyRef:
              name: mindflow-secrets
              key: DATABASE_USERNAME
        - name: DATABASE_PASSWORD
          valueFrom:
            secretKeyRef:
              name: mindflow-secrets
              key: DATABASE_PASSWORD
        - name: DATABASE_NAME
          valueFrom:
            secretKeyRef:
              name: mindflow-secrets
              key: DATABASE_NAME
        - name: JWT_SECRET
          valueFrom:
            secretKeyRef:
              name: mindflow-secrets
              key: JWT_SECRET
        - name: JWT_REFRESH_SECRET
          valueFrom:
            secretKeyRef:
              name: mindflow-secrets
              key: JWT_REFRESH_SECRET
        - name: COZE_API_TOKEN
          valueFrom:
            secretKeyRef:
              name: mindflow-secrets
              key: COZE_API_TOKEN
        - name: COZE_PROJECT_ID
          valueFrom:
            secretKeyRef:
              name: mindflow-secrets
              key: COZE_PROJECT_ID

        resources:
          requests:
            cpu: "500m"
            memory: "512Mi"
          limits:
            cpu: "1000m"
            memory: "1Gi"

        livenessProbe:
          httpGet:
            path: /api/v1/health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 3

        readinessProbe:
          httpGet:
            path: /api/v1/health
            port: 3000
          initialDelaySeconds: 10
          periodSeconds: 5
          timeoutSeconds: 3
          failureThreshold: 3

---
apiVersion: v1
kind: Service
metadata:
  name: mindflow-backend
spec:
  selector:
    app: mindflow-backend
  ports:
  - name: http
    port: 3000
    targetPort: 3000
  type: ClusterIP
```

3. **修改 YAML 配置**

   **必须修改的字段**：

   - `stringData.DATABASE_HOST`：替换为你的数据库主机名（在数据库详情中查看）
   - `stringData.DATABASE_PASSWORD`：替换为你的数据库密码
   - `stringData.JWT_SECRET`：生成强随机字符串（使用 `openssl rand -base64 32`）
   - `stringData.JWT_REFRESH_SECRET`：生成另一个强随机字符串
   - `stringData.COZE_API_TOKEN`：填入你的 Coze API Token
   - `stringData.COZE_PROJECT_ID`：填入你的 Coze Project ID
   - `spec.template.spec.containers[0].image`：替换为你的镜像地址

4. **点击"部署"**
   - 等待约 1-2 分钟，直到 Pod 状态变为 "Running"

### 第六步：配置公网访问（Ingress）

1. **在应用管理界面，找到 `mindflow-backend` 应用**

2. **点击"外网访问"**
   - 协议：`HTTPS`
   - 域名：可以使用 Sealos 提供的免费域名，或者绑定自己的域名
   - 目标端口：`3000`

3. **保存配置**
   - Sealos 会自动配置 Ingress 和 Let's Encrypt 证书
   - 等待约 1-2 分钟，证书配置完成

4. **记录公网地址**
   - 例如：`https://mindflow-backend-xxx.cloud.sealos.io`

### 第七步：验证部署

1. **测试健康检查**
   ```bash
   curl https://mindflow-backend-xxx.cloud.sealos.io/api/v1/health
   ```

   预期响应：
   ```json
   {
     "status": "ok",
     "timestamp": "2026-02-11T12:00:00.000Z",
     "service": "MindFlow Backend",
     "version": "1.0.0"
   }
   ```

2. **测试注册接口**
   ```bash
   curl -X POST https://mindflow-backend-xxx.cloud.sealos.io/api/v1/auth/register \
     -H "Content-Type: application/json" \
     -d '{
       "phone": "13800138000",
       "password": "Test123456",
       "username": "测试用户",
       "deviceInfo": {
         "deviceId": "test-device-001",
         "deviceName": "测试设备",
         "osType": "ios",
         "osVersion": "17.0"
       }
     }'
   ```

   预期响应：
   ```json
   {
     "user": {
       "id": "...",
       "phone": "13800138000",
       "username": "测试用户"
     },
     "accessToken": "eyJ...",
     "refreshToken": "eyJ...",
     "expiresIn": 604800
   }
   ```

3. **测试登录接口**
   ```bash
   curl -X POST https://mindflow-backend-xxx.cloud.sealos.io/api/v1/auth/login \
     -H "Content-Type: application/json" \
     -d '{
       "phone": "13800138000",
       "password": "Test123456",
       "deviceInfo": {
         "deviceId": "test-device-001",
         "deviceName": "测试设备",
         "osType": "ios",
         "osVersion": "17.0"
       }
     }'
   ```

4. **查看应用日志**
   - 在 Sealos 应用管理界面，点击 Pod → "日志"
   - 查看是否有错误信息

---

## 📊 资源监控

### 查看资源使用情况

在 Sealos 应用管理界面可以看到：
- CPU 使用率
- 内存使用率
- 网络流量
- Pod 状态

### 自动扩缩容（可选）

如果用户量增长，可以配置 HPA（Horizontal Pod Autoscaler）：

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: mindflow-backend-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: mindflow-backend
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

---

## 💰 成本预估

基于以下配置（100 用户/天）：

| 资源 | 配置 | 月费用（元） |
|------|------|-------------|
| PostgreSQL | 0.5核/1GB/5GB | ~40 |
| 应用实例 | 0.5核/512MB × 2副本 | ~50 |
| 流量 | 约 10GB/月 | ~5 |
| **总计** | - | **~95** |

*注：实际费用以 Sealos 平台计费为准*

---

## 🔧 常见问题

### 1. Pod 启动失败

**现象**：Pod 状态为 `CrashLoopBackOff`

**解决方案**：
1. 查看 Pod 日志：点击 Pod → "日志"
2. 检查常见问题：
   - 数据库连接失败：检查 `DATABASE_HOST`、`DATABASE_PASSWORD` 是否正确
   - 环境变量缺失：检查 Secret 配置是否完整
   - 镜像拉取失败：检查镜像地址是否正确

### 2. 无法访问 API

**现象**：访问 `https://mindflow-backend-xxx.cloud.sealos.io/api/v1/health` 返回 404 或超时

**解决方案**：
1. 检查 Ingress 配置是否正确
2. 检查 Service 是否正常：`kubectl get svc`
3. 检查 Pod 是否 Running：`kubectl get pods`

### 3. 数据库连接失败

**现象**：日志中出现 `ECONNREFUSED` 或 `password authentication failed`

**解决方案**：
1. 确认数据库已创建且状态为"运行中"
2. 检查 `DATABASE_HOST` 是否正确（格式：`mindflow-db.ns-xxx.svc.cluster.local`）
3. 检查 `DATABASE_PASSWORD` 是否正确
4. 在数据库终端测试连接：`\c mindflow`

### 4. AI 功能不可用

**现象**：调用 `/api/v1/ai/analyze-nvc` 返回错误

**解决方案**：
1. 检查 `COZE_API_TOKEN` 和 `COZE_PROJECT_ID` 是否正确
2. 验证 Coze API 密钥是否有效
3. 查看应用日志，确认错误详情

---

## 🔄 更新部署

当代码有更新时，按以下步骤重新部署：

1. **推送新代码到 GitHub**
   ```bash
   git add .
   git commit -m "Update: xxx"
   git push origin main
   ```

2. **重新构建镜像**
   ```bash
   docker build -t <your-dockerhub-username>/mindflow-backend:v1.1 .
   docker push <your-dockerhub-username>/mindflow-backend:v1.1
   ```

3. **更新 Deployment**
   - 在 Sealos 应用管理界面，点击 `mindflow-backend` → "编辑"
   - 修改镜像版本：`image: xxx/mindflow-backend:v1.1`
   - 点击"保存"
   - Kubernetes 会自动滚动更新（零停机）

---

## 📝 下一步

部署完成后，你可以：

1. **配置 Flutter 客户端**
   - 参考 `CLIENT_INTEGRATION_GUIDE.md`
   - 修改 API Base URL 为 Sealos 公网地址

2. **配置监控告警**
   - 在 Sealos 设置资源告警阈值
   - 接收 CPU、内存、磁盘告警通知

3. **备份数据库**
   - Sealos 数据库支持自动备份（每日一次）
   - 也可以手动创建快照

4. **优化性能**
   - 根据实际使用情况调整副本数
   - 配置 CDN 加速静态资源
   - 添加 Redis 缓存层

---

## 🆘 技术支持

如遇到问题，可以通过以下方式获取帮助：

1. **查看项目文档**
   - README.md
   - PROGRESS.md
   - CLIENT_INTEGRATION_GUIDE.md

2. **Sealos 官方文档**
   - https://docs.sealos.io

3. **提交 Issue**
   - https://github.com/BinGess/Ocean-backend/issues

---

**部署愉快！🎉**
