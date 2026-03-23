#!/bin/bash

echo "🚀 快速启动小行星光谱应用 - 开发模式"
echo "================================"
echo "⚠️  注意: 这是开发环境启动脚本"
echo "   生产部署请使用: ./start-production.sh"
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
sleep 2

# 启动后端
echo "🔧 启动后端服务..."
cd backend
if [ ! -f ".env" ]; then
    echo "⚠️  创建 .env 文件..."
    cat > .env << EOF
FLASK_ENV=development
SECRET_KEY=dev-secret-key
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=asteroid_spectral_db
DB_USER=root
DB_PASSWORD=bpol68
CORS_ORIGINS=http://localhost:3000
EOF
fi

# 检查并安装依赖
echo "📦 检查Python依赖..."
if ! python -c "import flask_cors" 2>/dev/null; then
    echo "📥 安装缺失的依赖..."
    pip install -r requirements.txt
fi

# 启动后端
python app.py &
BACKEND_PID=$!
echo "✅ 后端启动 (PID: $BACKEND_PID)"

# 等待后端启动
sleep 3

# 测试后端
echo "🔍 测试后端连接..."
if curl -s http://localhost:5000/health > /dev/null; then
    echo "✅ 后端健康检查通过"
else
    echo "❌ 后端启动失败"
    kill $BACKEND_PID 2>/dev/null
    exit 1
fi

# 启动前端
echo "🎨 启动前端服务..."
cd ../frontend

# 安装依赖（如果需要）
if [ ! -d "node_modules" ]; then
    echo "📦 安装前端依赖..."
    npm install
fi

# 启动前端
npm run dev &
FRONTEND_PID=$!
echo "✅ 前端启动 (PID: $FRONTEND_PID)"

# 等待前端启动
sleep 5

# 测试前端
echo "🔍 测试前端连接..."
if curl -s http://localhost:3000 > /dev/null; then
    echo "✅ 前端服务正常"
else
    echo "❌ 前端启动失败"
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
    exit 1
fi

# 测试API连接
echo "🔍 测试API连接..."
API_TEST=$(curl -s http://localhost:5000/api/classifications | grep -o '"systems"' || echo "")
if [ "$API_TEST" = '"systems"' ]; then
    echo "✅ API连接正常"
else
    echo "❌ API连接失败"
fi

echo ""
echo "🎉 开发环境启动完成!"
echo "================================"
echo "📍 本地访问地址:"
echo "   前端: http://localhost:3000"
echo "   后端: http://localhost:5000"
echo "   API:  http://localhost:5000/api"
echo ""
echo "⚠️  重要提示:"
echo "   这是开发环境，仅供本地测试使用"
echo "   外网部署请参考: QUICK_DEPLOY.md"
echo ""
echo "💡 开发提示:"
echo "- 如果看到网络错误，请刷新页面 (Ctrl+Shift+R)"
echo "- 查看右上角的API连接测试面板"
echo "- 按 Ctrl+C 停止所有服务"
echo "- 代码修改会自动热重载"
echo ""

# 清理函数
cleanup() {
    echo ""
    echo "🛑 停止服务..."
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null || true
    pkill -f "python.*app.py" 2>/dev/null || true
    pkill -f "npm.*dev" 2>/dev/null || true
    pkill -f "vite" 2>/dev/null || true
    echo "✅ 服务已停止"
    exit 0
}

# 设置信号处理
trap cleanup SIGINT SIGTERM

# 等待用户停止
echo "⏳ 服务运行中... 按 Ctrl+C 停止"
wait
