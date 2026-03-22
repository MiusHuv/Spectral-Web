#!/bin/bash

echo "🚀 启动小行星光谱应用 - Ngrok 简化模式"
echo "================================"
echo "使用单个 ngrok 隧道 + 本地反向代理"
echo "================================"

# 检查当前目录
if [ ! -f "package.json" ]; then
    echo "❌ 错误: 请在 asteroid-spectral-app 目录中运行此脚本"
    exit 1
fi

# 杀死现有进程
echo "🧹 清理现有进程..."
pkill -f "python.*app.py" 2>/dev/null || true
pkill -f "npm.*dev" 2>/dev/null || true
pkill -f "vite" 2>/dev/null || true
pkill -f "nginx.*asteroid" 2>/dev/null || true
sleep 2

# 启动后端
echo "🔧 启动后端服务 (端口 5000)..."
cd backend

if [ ! -f ".env" ]; then
    echo "⚠️  创建 .env 文件..."
    cat > .env << EOF
FLASK_ENV=development
SECRET_KEY=dev-secret-key
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=asteroid_spectral_db
DB_USER=newuser
DB_PASSWORD=bpol68
CORS_ORIGINS=*
EOF
fi

# 设置 CORS 为 * 以允许 ngrok 域名
sed -i.bak 's/CORS_ORIGINS=.*/CORS_ORIGINS=*/' .env

python app.py > ../backend.log 2>&1 &
BACKEND_PID=$!
echo "✅ 后端启动 (PID: $BACKEND_PID)"

cd ..

# 等待后端启动
echo "⏳ 等待后端启动..."
sleep 3

if ! curl -s http://localhost:5000/health > /dev/null; then
    echo "❌ 后端启动失败，查看日志: tail -f backend.log"
    exit 1
fi
echo "✅ 后端健康检查通过"

# 配置前端使用相对路径
echo "🔧 配置前端..."
cd frontend

cat > .env.local << EOF
# Ngrok 模式 - 使用相对路径
VITE_API_URL=
VITE_API_TIMEOUT=30000
VITE_ENABLE_DEBUG_MODE=true
EOF

# 安装依赖
if [ ! -d "node_modules" ]; then
    echo "📦 安装前端依赖..."
    npm install
fi

# 构建前端（生产模式）
echo "🏗️  构建前端..."
npm run build

cd ..

# 创建临时 Nginx 配置
echo "🔧 创建 Nginx 配置..."
cat > nginx-ngrok.conf << 'EOF'
worker_processes 1;
daemon off;
error_log /dev/stdout info;

events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;
    
    access_log /dev/stdout;
    
    server {
        listen 8080;
        
        # 前端静态文件
        location / {
            root FRONTEND_DIST_PATH;
            try_files $uri $uri/ /index.html;
        }
        
        # 后端 API 代理
        location /api {
            proxy_pass http://127.0.0.1:5000;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_read_timeout 300s;
        }
        
        # 健康检查
        location /health {
            proxy_pass http://127.0.0.1:5000/health;
        }
    }
}
EOF

# 替换路径
FRONTEND_DIST=$(pwd)/frontend/dist
sed -i.bak "s|FRONTEND_DIST_PATH|$FRONTEND_DIST|g" nginx-ngrok.conf

# 启动 Nginx
echo "🌐 启动 Nginx (端口 8080)..."
if command -v nginx &> /dev/null; then
    nginx -c $(pwd)/nginx-ngrok.conf -p $(pwd) > nginx.log 2>&1 &
    NGINX_PID=$!
    echo "✅ Nginx 启动 (PID: $NGINX_PID)"
    
    sleep 2
    
    if ! curl -s http://localhost:8080/health > /dev/null; then
        echo "❌ Nginx 启动失败，查看日志: tail -f nginx.log"
        kill $BACKEND_PID 2>/dev/null
        exit 1
    fi
    echo "✅ Nginx 健康检查通过"
    
    echo ""
    echo "🎉 服务启动完成!"
    echo "================================"
    echo "📍 本地地址: http://localhost:8080"
    echo ""
    echo "🌐 现在运行 ngrok:"
    echo "   ngrok http 8080"
    echo ""
    echo "💡 提示:"
    echo "- ngrok 会给你一个公网 URL"
    echo "- 分享这个 URL 给外网用户"
    echo "- 前端和后端都通过同一个 URL 访问"
    echo "- 按 Ctrl+C 停止所有服务"
    echo ""
    
    # 清理函数
    cleanup() {
        echo ""
        echo "🛑 停止所有服务..."
        kill $BACKEND_PID $NGINX_PID 2>/dev/null || true
        pkill -f "python.*app.py" 2>/dev/null || true
        pkill -f "nginx.*asteroid" 2>/dev/null || true
        rm -f frontend/.env.local nginx-ngrok.conf nginx-ngrok.conf.bak
        echo "✅ 服务已停止"
        exit 0
    }
    
    trap cleanup SIGINT SIGTERM
    
    echo "⏳ 服务运行中... 按 Ctrl+C 停止"
    wait
    
else
    echo "❌ Nginx 未安装"
    echo ""
    echo "方案 A: 安装 Nginx (推荐)"
    echo "  Ubuntu/Debian: sudo apt install nginx"
    echo "  CentOS/RHEL:   sudo yum install nginx"
    echo "  macOS:         brew install nginx"
    echo ""
    echo "方案 B: 使用双 ngrok 隧道"
    echo "  运行: ./start-with-ngrok.sh"
    echo ""
    
    kill $BACKEND_PID 2>/dev/null
    exit 1
fi
