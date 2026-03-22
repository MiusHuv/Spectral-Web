#!/bin/bash

echo "=== 导出功能诊断 ==="
echo ""

echo "1. 检查后端服务..."
if curl -s http://localhost:5000/health > /dev/null 2>&1; then
    echo "✓ 后端服务正常运行"
    curl -s http://localhost:5000/health | python3 -m json.tool 2>/dev/null || echo "  (响应格式异常)"
else
    echo "✗ 后端服务无法访问"
    echo "  请运行: cd asteroid-spectral-app/backend && python app.py"
fi
echo ""

echo "2. 检查前端配置..."
if [ -f "frontend/.env" ]; then
    echo "✓ .env 文件存在"
    echo "  配置内容："
    grep -E "VITE_API_URL|VITE_API_TIMEOUT" frontend/.env | sed 's/^/    /'
else
    echo "✗ .env 文件不存在"
    echo "  建议创建配置文件"
fi
echo ""

echo "3. 测试导出API..."
http_code=$(curl -s -w "%{http_code}" -X POST http://localhost:5000/api/export/asteroids \
  -H "Content-Type: application/json" \
  -d '{
    "item_ids": ["1"],
    "format": "csv",
    "include_fields": {
      "basic_info": true,
      "classification": true,
      "orbital_params": false,
      "physical_props": false,
      "spectral_data": false
    }
  }' -o /tmp/export_test.csv 2>&1 | tail -1)

if [ "$http_code" = "200" ]; then
    echo "✓ 导出API工作正常 (HTTP $http_code)"
    if [ -f /tmp/export_test.csv ]; then
        file_size=$(wc -c < /tmp/export_test.csv)
        echo "  导出文件大小: $file_size bytes"
        rm -f /tmp/export_test.csv
    fi
else
    echo "✗ 导出API返回错误: HTTP $http_code"
fi
echo ""

echo "4. 检查进程状态..."
backend_running=false
frontend_running=false

if ps aux | grep -E "python.*app\.py" | grep -v grep > /dev/null 2>&1; then
    echo "✓ 后端进程运行中"
    backend_running=true
    ps aux | grep -E "python.*app\.py" | grep -v grep | awk '{print "  PID: " $2 ", 内存: " $6/1024 "MB"}' | head -1
else
    echo "✗ 后端进程未运行"
fi

if ps aux | grep -E "vite|npm.*dev" | grep -v grep > /dev/null 2>&1; then
    echo "✓ 前端进程运行中"
    frontend_running=true
    ps aux | grep -E "node.*vite" | grep -v grep | awk '{print "  PID: " $2 ", 内存: " $6/1024 "MB"}' | head -1
else
    echo "✗ 前端进程未运行"
fi
echo ""

echo "5. 检查端口占用..."
if command -v netstat > /dev/null 2>&1; then
    if netstat -tuln 2>/dev/null | grep -q ":5000 "; then
        echo "✓ 端口 5000 (后端) 正在监听"
    else
        echo "✗ 端口 5000 (后端) 未监听"
    fi
    
    if netstat -tuln 2>/dev/null | grep -q ":3000 "; then
        echo "✓ 端口 3000 (前端) 正在监听"
    else
        echo "✗ 端口 3000 (前端) 未监听"
    fi
elif command -v ss > /dev/null 2>&1; then
    if ss -tuln 2>/dev/null | grep -q ":5000 "; then
        echo "✓ 端口 5000 (后端) 正在监听"
    else
        echo "✗ 端口 5000 (后端) 未监听"
    fi
    
    if ss -tuln 2>/dev/null | grep -q ":3000 "; then
        echo "✓ 端口 3000 (前端) 正在监听"
    else
        echo "✗ 端口 3000 (前端) 未监听"
    fi
else
    echo "⚠ 无法检查端口状态 (netstat/ss 命令不可用)"
fi
echo ""

echo "6. 检查数据库连接..."
if [ -f "backend/config.py" ]; then
    db_host=$(grep "DB_HOST" backend/config.py | head -1 | cut -d"'" -f2)
    db_port=$(grep "DB_PORT" backend/config.py | head -1 | grep -o '[0-9]*' | head -1)
    echo "  数据库配置: $db_host:$db_port"
    
    if command -v mysql > /dev/null 2>&1; then
        if mysql -h "$db_host" -P "$db_port" -u root -pbpol68 -e "SELECT 1" > /dev/null 2>&1; then
            echo "✓ 数据库连接正常"
        else
            echo "✗ 数据库连接失败"
        fi
    else
        echo "⚠ 无法测试数据库连接 (mysql 命令不可用)"
    fi
else
    echo "⚠ 无法找到配置文件"
fi
echo ""

echo "=== 诊断完成 ==="
echo ""

# 提供建议
if [ "$backend_running" = false ]; then
    echo "建议: 启动后端服务"
    echo "  cd asteroid-spectral-app/backend && python app.py"
    echo ""
fi

if [ "$frontend_running" = false ]; then
    echo "建议: 启动前端服务"
    echo "  cd asteroid-spectral-app/frontend && npm run dev"
    echo ""
fi

if [ ! -f "frontend/.env" ]; then
    echo "建议: 创建前端配置文件"
    echo "  cp frontend/.env.example frontend/.env"
    echo ""
fi

echo "如需更多帮助，请查看: EXPORT_TROUBLESHOOTING.md"
