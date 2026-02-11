# ============================================
# Stage 1: 构建阶段
# ============================================
FROM node:20-alpine AS builder

WORKDIR /app

# 复制 package 文件并安装依赖
COPY package*.json ./
RUN npm ci --only=production && \
    npm cache clean --force

# 复制源代码
COPY . .

# 构建应用
RUN npm run build

# ============================================
# Stage 2: 生产阶段
# ============================================
FROM node:20-alpine

WORKDIR /app

# 安装 dumb-init (处理僵尸进程)
RUN apk add --no-cache dumb-init

# 创建非root用户
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001

# 复制依赖和构建产物
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/package.json ./package.json

# 切换到非root用户
USER nestjs

# 暴露端口
EXPOSE 3000

# 健康检查
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/v1/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# 启动应用
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main"]
