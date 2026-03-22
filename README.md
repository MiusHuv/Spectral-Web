# Asteroid Spectral Visualization Web Application

A full-stack web application for exploring asteroid data organized by taxonomic classifications, viewing spectral curves, and examining orbital and physical properties.

## Technology Stack

- **Frontend**: React 18+ with TypeScript, D3.js v7, Vite
- **Backend**: Python Flask with Flask-CORS, Flask-RESTful
- **Database**: MySQL (existing asteroid_spectral_db)

## Project Structure

```
asteroid-spectral-app/
├── frontend/                 # React frontend application
│   ├── src/
│   │   ├── components/      # React components
│   │   ├── services/        # API services
│   │   ├── types/           # TypeScript type definitions
│   │   └── utils/           # Utility functions
│   ├── public/              # Static assets
│   └── package.json
├── backend/                 # Flask backend application
│   ├── app/
│   │   ├── api/            # API endpoints
│   │   ├── services/       # Business logic services
│   │   └── models/         # Data models
│   ├── tests/              # Backend tests
│   ├── app.py              # Flask application entry point
│   ├── config.py           # Configuration management
│   └── requirements.txt
└── package.json            # Root package.json for development scripts
```

## Development Setup

### Prerequisites

- Node.js 18+ and npm
- Python 3.8+
- MySQL database with asteroid_spectral_db

### Installation

1. Clone the repository and navigate to the project directory
2. Install all dependencies:
   ```bash
   npm run install:all
   ```

3. Set up backend environment:
   ```bash
   cd backend
   cp .env.example .env
   # Edit .env with your database credentials
   ```

4. Create Python virtual environment (optional but recommended):
   ```bash
   cd backend
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   pip install -r requirements.txt
   ```

### Development

**快速启动（推荐）：**
```bash
./quick-start.sh
```

或使用 npm 脚本：
```bash
npm run dev
```

或分别启动：
```bash
# Frontend (runs on http://localhost:3000)
npm run dev:frontend

# Backend (runs on http://localhost:5000)
npm run dev:backend
```

### Testing

Run all tests:
```bash
npm run test
```

Run tests separately:
```bash
# Frontend tests
npm run test:frontend

# Backend tests
npm run test:backend
```

### Building for Production

Build the frontend for production:
```bash
npm run build
```

## 外网访问（Ngrok）

如果需要通过 ngrok 将应用暴露到外网：

### 方案一：单隧道模式（推荐）
```bash
# 1. 启动服务（需要 Nginx）
./start-with-ngrok-simple.sh

# 2. 在另一个终端运行 ngrok
ngrok http 8080
```

### 方案二：双隧道模式
```bash
# 自动启动前后端和两个 ngrok 隧道
./start-with-ngrok.sh
```

详细说明请参考：[NGROK_GUIDE.md](NGROK_GUIDE.md)

## 生产部署

详细的生产环境部署指南：
- 快速部署：[QUICK_DEPLOY.md](QUICK_DEPLOY.md)
- 完整指南：[EXTERNAL_DEPLOYMENT_GUIDE.md](EXTERNAL_DEPLOYMENT_GUIDE.md)

## API Endpoints

The backend will provide RESTful API endpoints for:
- Classification data (Bus-DeMeo, Tholen)
- Asteroid information and properties
- Spectral data retrieval
- Data export functionality

## Contributing

1. Follow the existing code style and structure
2. Write tests for new functionality
3. Update documentation as needed
4. Use TypeScript for frontend development
5. Follow Flask best practices for backend development