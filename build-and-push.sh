#!/bin/bash

# ============================================
# Docker 镜像构建和推送脚本
# ============================================

set -e  # 遇到错误立即退出

# 配置变量
DOCKER_USERNAME="bingess"  # 替换为你的 Docker Hub 用户名
IMAGE_NAME="mindflow-backend"
VERSION="latest"

# 完整镜像名称
FULL_IMAGE_NAME="${DOCKER_USERNAME}/${IMAGE_NAME}:${VERSION}"

echo "======================================"
echo "开始构建 Docker 镜像"
echo "镜像名称: ${FULL_IMAGE_NAME}"
echo "======================================"

# 1. 检查 Docker 是否运行
if ! docker info > /dev/null 2>&1; then
  echo "❌ 错误: Docker 未运行，请先启动 Docker Desktop"
  exit 1
fi

# 2. 登录 Docker Hub
echo ""
echo "正在登录 Docker Hub..."
docker login

# 3. 构建镜像
echo ""
echo "正在构建镜像..."
docker build -t ${FULL_IMAGE_NAME} .

# 4. 推送镜像
echo ""
echo "正在推送镜像到 Docker Hub..."
docker push ${FULL_IMAGE_NAME}

# 5. 完成
echo ""
echo "======================================"
echo "✅ 镜像构建和推送完成！"
echo "======================================"
echo ""
echo "镜像地址: ${FULL_IMAGE_NAME}"
echo ""
echo "在 Sealos 部署时使用以下配置："
echo "  image: ${FULL_IMAGE_NAME}"
echo ""
echo "下一步: 在 Sealos 应用管理中创建部署"
