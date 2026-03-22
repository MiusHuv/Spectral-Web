#!/bin/bash

echo "🚀 启动小行星光谱应用 - Ngrok 模式"
echo "================================"
echo "此脚本会同时启动前后端，并通过 ngrok 暴露"
echo "================================"

# 检查 ngrok 是否安装
if ! command -v ngrok &> /dev/null; then
    echo "❌ 错误: ngrok 未安装"
    echo "请访问 https://ngrok.com/download 下载安装"
    exit 1
fi

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
pkill -f "ngrok" 2>/dev/null || true
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

# 重要：设置 CORS 为 * 以允许 ngrok 域名访问
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

# 启动后端 ngrok
echo "🌐 启动后端 ngrok (端口 5000)..."
ngrok http 5000 --log=stdout > ngrok-backend.log 2>&1 &
NGROK_BACKEND_PID=$!
sleep 3

# 获取后端 ngrok URL
BACKEND_URL=""
for i in {1..10}; do
    BACKEND_URL=$(curl -s http://localhost:4040/api/tunnels | grep -o '"public_url":"https://[^"]*' | head -1 | cut -d'"' -f4)
    if [ ! -z "$BACKEND_URL" ]; then
        break
    fi
    sleep 1
done

if [ -z "$BACKEND_URL" ]; then
    echo "❌ 无法获取后端 ngrok URL"
    kill $BACKEND_PID $NGROK_BACKEND_PID 2>/dev/null
    exit 1
fi

echo "✅ 后端 ngrok URL: $BACKEND_URL"

# 更新前端环境变量
echo "🔧 配置前端环境变量..."
cd frontend

cat > .env.local << EOF
# Ngrok 模式配置
VITE_API_URL=$BACKEND_URL
VITE_API_TIMEOUT=30000
VITE_ENABLE_DEBUG_MODE=true
EOF

echo "✅ 前端配置完成"

# 安装前端依赖（如果需要）
if [ ! -d "node_modules" ]; then
    echo "📦 安装前端依赖..."
    npm install
fi

# 启动前端
echo "🎨 启动前端服务 (端口 3000)..."
npm run dev > ../frontend.log 2>&1 &
FRONTEND_PID=$!
echo "✅ 前端启动 (PID: $FRONTEND_PID)"

cd ..

# 等待前端启动
echo "⏳ 等待前端启动..."
sleep 5

if ! curl -s http://localhost:3000 > /dev/null; then
    echo "❌ 前端启动失败，查看日志: tail -f frontend.log"
    kill $BACKEND_PID $FRONTEND_PID $NGROK_BACKEND_PID 2>/dev/null
    exit 1
fi
echo "✅ 前端服务正常"

# 启动前端 ngrok
echo "🌐 启动前端 ngrok (端口 3000)..."
ngrok http 3000 --log=stdout > ngrok-frontend.log 2>&1 &
NGROK_FRONTEND_PID=$!
sleep 3

# 获取前端 ngrok URL
FRONTEND_URL=""
for i in {1..10}; do
    FRONTEND_URL=$(curl -s http://localhost:4041/api/tunnels 2>/dev/null | grep -o '"public_url":"https://[^"]*' | head -1 | cut -d'"' -f4)
    if [ -z "$FRONTEND_URL" ]; then
        # 尝试从 4040 端口获取第二个隧道
        FRONTEND_URL=$(curl -s http://localhost:4040/api/tunnels | grep -o '"public_url":"https://[^"]*' | tail -1 | cut -d'"' -f4)
    fi
    if [ ! -z "$FRONTEND_URL" ] && [ "$FRONTEND_URL" != "$BACKEND_URL" ]; then
        break
    fi
    sleep 1
done

if [ -z "$FRONTEND_URL" ]; then
    echo "⚠️  无法自动获取前端 ngrok URL"
    echo "请手动运行: ngrok http 3000"
else
    echo "✅ 前端 ngrok URL: $FRONTEND_URL"
fi

echo ""
echo "🎉 Ngrok 模式启动完成!"
echo "================================"
echo "📍 本地地址:"
echo "   前端: http://localhost:3000"
echo "   后端: http://localhost:5000"
echo ""
echo "🌐 外网地址:"
echo "   前端: $FRONTEND_URL"
echo "   后端: $BACKEND_URL"
echo ""
echo "📊 Ngrok 控制台:"
echo "   后端: http://localhost:4040"
echo "   前端: http://localhost:4041"
echo ""
echo "💡 提示:"
echo "- 分享前端 URL 给外网用户访问"
echo "- 前端会自动使用后端 ngrok URL"
echo "- 按 Ctrl+C 停止所有服务"
echo "- 查看日志: tail -f backend.log frontend.log"
echo ""
echo "⚠️  注意:"
echo "- ngrok 免费版有连接数限制"
echo "- 每次重启 URL 会变化"
echo "- 不要在生产环境使用"
echo ""

# 清理函数
cleanup() {
    echo ""
    echo "🛑 停止所有服务..."
    kill $BACKEND_PID $FRONTEND_PID $NGROK_BACKEND_PID $NGROK_FRONTEND_PID 2>/dev/null || true
    pkill -f "python.*app.py" 2>/dev/null || true
    pkill -f "npm.*dev" 2>/dev/null || true
    pkill -f "vite" 2>/dev/null || true
    pkill -f "ngrok" 2>/dev/null || true
    
    # 清理临时配置
    rm -f frontend/.env.local
    
    echo "✅ 服务已停止"
    exit 0
}

# 设置信号处理
trap cleanup SIGINT SIGTERM

# 等待用户停止
echo "⏳ 服务运行中... 按 Ctrl+C 停止"
wait
