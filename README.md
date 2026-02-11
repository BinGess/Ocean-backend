# MindFlow Backend

MindFlow 情绪觉察记录应用的服务端代码，基于 NestJS + PostgreSQL 构建，为 Flutter 移动应用提供云端数据存储、AI 代理和多设备同步能力。

## 🚀 技术栈

- **框架**: NestJS (Node.js 20 + TypeScript)
- **数据库**: PostgreSQL 14 + TypeORM
- **认证**: JWT (Access Token 7天 + Refresh Token 30天)
- **流式响应**: Server-Sent Events (SSE)
- **部署**: Docker + Sealos (Kubernetes)

## ✨ 核心功能

### 已完成 ✅
- ✅ **用户认证**（注册/登录/JWT 双 Token/多设备管理）
- ✅ **情绪记录管理**（CRUD + 乐观锁 + 全文搜索 + 软删除）
- ✅ **AI 代理**（Coze NVC 情绪分析，SSE 流式响应）
- ✅ **数据同步**（增量拉取 + 批量推送 + 冲突检测 + 首次迁移）
- ✅ **同步日志**（追踪所有同步操作）
- ✅ **安全防护**（bcrypt 加密 + 限流 + 数据隔离）

### 可选扩展 ⚠️
- ⚠️ 周报洞察生成（实体已设计，API 暂未实现）
- ⚠️ 用户设置同步（暂未实现）
- ⚠️ Doubao ASR 语音转录（暂未实现）

## 📊 项目统计

- **API 端点**: 19 个
- **核心文件**: 51 个
- **代码量**: 约 7800 行
- **数据库表**: 8 张
- **开发时间**: 2-3 天（单人）

## 🎯 API 概览

### 认证相关（7 个）
```
POST   /api/v1/auth/register         # 注册
POST   /api/v1/auth/login            # 登录
POST   /api/v1/auth/refresh          # 刷新 Token
POST   /api/v1/auth/logout           # 登出
GET    /api/v1/auth/me               # 获取当前用户
GET    /api/v1/auth/devices          # 查看所有设备
DELETE /api/v1/auth/devices/:id      # 远程登出
```

### 记录管理（6 个）
```
POST   /api/v1/records                    # 创建记录
PATCH  /api/v1/records/:id                # 部分更新
GET    /api/v1/records                    # 分页查询
GET    /api/v1/records/:id                # 获取单条
DELETE /api/v1/records/:id                # 软删除
GET    /api/v1/records/search?q=关键词    # 全文搜索
```

### AI 代理（1 个）
```
POST   /api/v1/ai/analyze-nvc              # NVC 情绪分析（SSE 流式）
```

### 数据同步（4 个）
```
GET    /api/v1/sync/pull                   # 增量拉取
POST   /api/v1/sync/push                   # 批量推送
POST   /api/v1/sync/resolve-conflict       # 手动解决冲突
POST   /api/v1/sync/bulk-migrate           # 首次迁移
```

### 系统（1 个）
```
GET    /api/v1/health                       # 健康检查
```

## 🛠️ 快速开始

### 1. 环境准备

确保已安装以下工具：
- Node.js >= 20.0.0
- Docker & Docker Compose（可选，用于本地数据库）
- PostgreSQL 14（或使用 Docker）

### 2. 克隆项目

```bash
git clone https://github.com/BinGess/Ocean-backend.git
cd Ocean-backend
```

### 3. 安装依赖

```bash
npm install
```

### 4. 启动数据库

使用 Docker Compose 启动 PostgreSQL：

```bash
docker compose up -d postgres
```

或手动启动 PostgreSQL 服务（端口 5432）。

### 5. 初始化数据库

**重要：必须手动执行数据库初始化脚本**

```bash
# 使用 psql 执行初始化脚本
psql -h localhost -U postgres -d mindflow -f src/database/migrations/001_initial_schema.sql

# 或者使用 Docker exec（如果使用 Docker Compose）
docker exec -i ocean-backend-postgres-1 psql -U postgres -d mindflow < src/database/migrations/001_initial_schema.sql
```

### 6. 配置环境变量

复制 `.env.example` 为 `.env` 并填入配置：

```bash
cp .env.example .env
```

编辑 `.env` 文件，填入以下关键配置：

```env
# 数据库配置
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USERNAME=postgres
DATABASE_PASSWORD=postgres
DATABASE_NAME=mindflow

# JWT 密钥（请生成强随机字符串）
JWT_SECRET=<生成 32 字节随机字符串>
JWT_REFRESH_SECRET=<生成另一个 32 字节随机字符串>

# 第三方 API 密钥（可选，不配置则 AI 功能不可用）
DOUBAO_ASR_APP_KEY=your_doubao_app_key
DOUBAO_ASR_ACCESS_KEY=your_doubao_access_key
COZE_API_TOKEN=your_coze_token
COZE_PROJECT_ID=your_coze_project_id
```

### 7. 启动开发服务器

```bash
npm run start:dev
```

服务将在 `http://localhost:3000/api/v1` 启动。

### 8. 验证服务

测试健康检查端点：

```bash
curl http://localhost:3000/api/v1/health
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

## 🐳 Docker 部署

### 构建镜像

```bash
docker build -t mindflow-backend:latest .
```

### 运行容器

```bash
docker run -p 3000:3000 \
  -e DATABASE_HOST=your_db_host \
  -e DATABASE_PASSWORD=your_db_password \
  -e JWT_SECRET=your_jwt_secret \
  mindflow-backend:latest
```

### 使用 Docker Compose

```bash
docker compose up -d
```

## ☁️ Sealos 部署

详细的 Sealos 部署配置请参考 **计划文档**（`~/.claude/plans/...`），包含：

- Kubernetes Deployment YAML
- Secret 配置
- Ingress 配置（HTTPS + 域名）
- 资源配置（CPU/内存/存储）

**预估成本**（100 用户/天）：~95元/月

## 📚 文档资源

1. **SUMMARY.md** - 项目总结文档（架构、API、部署）
2. **PROGRESS.md** - 开发进度追踪
3. **CLIENT_INTEGRATION_GUIDE.md** - Flutter 客户端接入指南（55KB+）
4. **计划文档** - 技术架构设计、数据库设计、安全设计

## 🔐 安全特性

- ✅ JWT 双 Token 认证（Access Token 7天 + Refresh Token 30天）
- ✅ bcrypt 密码加密（cost=12）
- ✅ 登录失败锁定（5 次失败锁定 1 分钟）
- ✅ 全局限流保护（100 次/分钟）
- ✅ AI API 限流（10 次/分钟）
- ✅ 数据隔离（用户维度自动过滤）
- ✅ 软删除（保留数据恢复能力）
- ✅ 操作日志（同步日志、AI 调用日志）

## 🧪 测试

当前项目**未编写单元测试**，建议生产部署前添加测试覆盖：

```bash
# 运行单元测试（暂无测试文件）
npm run test

# 运行 E2E 测试（暂无测试文件）
npm run test:e2e

# 生成测试覆盖率报告
npm run test:cov
```

## 📖 开发指南

### 添加新模块

1. 创建模块目录：`src/modules/your-module/`
2. 创建实体：`entities/your-entity.entity.ts`
3. 创建 DTO：`dto/create-your.dto.ts`, `dto/update-your.dto.ts`
4. 创建服务：`your-module.service.ts`
5. 创建控制器：`your-module.controller.ts`
6. 创建模块：`your-module.module.ts`
7. 在 `app.module.ts` 中导入模块

### 数据库迁移

当前使用纯 SQL 脚本管理迁移：

1. 创建新的迁移脚本：`src/database/migrations/002_xxx.sql`
2. 手动执行：`psql -h localhost -U postgres -d mindflow -f src/database/migrations/002_xxx.sql`

建议生产环境使用 TypeORM 迁移工具。

### 限流配置

在控制器中使用 `@Throttle` 装饰器自定义限流：

```typescript
@Throttle({ global: { limit: 10, ttl: 60000 } }) // 10 次/分钟
@Post('sensitive-action')
async sensitiveAction() {}
```

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License

## 🔗 相关链接

- **Flutter 客户端**: [Ocean](https://github.com/BinGess/Ocean)
- **Sealos 平台**: [https://sealos.io](https://sealos.io)
- **NestJS 文档**: [https://nestjs.com](https://nestjs.com)
- **TypeORM 文档**: [https://typeorm.io](https://typeorm.io)

