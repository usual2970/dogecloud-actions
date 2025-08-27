# Dogecloud Actions

一个用于将文件部署到 Dogecloud CDN 的 GitHub Actions，支持并发上传以提高部署效率。

## 功能特性

- 🚀 快速并发部署静态文件到 Dogecloud CDN
- ⚡ 可配置的并发上传数量，提高大文件集合的上传效率
- � 智能重试机制，自动处理网络异常和临时错误
- �📁 支持单文件或整个目录上传
- 🗑️ 可选择删除远程多余文件
- 🔧 完全可配置的部署路径
- 📊 详细的部署日志、进度显示和统计信息
- 🎯 指数退避重试策略，提高稳定性

## 使用方法

### 基本用法

在你的 GitHub 仓库中创建 `.github/workflows/deploy.yml` 文件：

```yaml
name: Deploy to Dogecloud

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v4
    
    - name: Build your project
      run: |
        # 在这里添加你的构建命令
        # 例如：npm install && npm run build
        
    - name: Deploy to Dogecloud
      uses: ./
      with:
        api-key: ${{ secrets.DOGECLOUD_API_KEY }}
        secret-key: ${{ secrets.DOGECLOUD_SECRET_KEY }}
        bucket-name: 'your-bucket-name'
        local-path: './dist'
        remote-path: '/'
        delete-removed: 'false'
        max-concurrency: '10'
        retry-attempts: '5'
```

### 高性能部署示例

对于大型项目，你可以调整并发参数以获得最佳性能：

```yaml
- name: High Performance Deploy to Dogecloud
  uses: ./
  with:
    api-key: ${{ secrets.DOGECLOUD_API_KEY }}
    secret-key: ${{ secrets.DOGECLOUD_SECRET_KEY }}
    bucket-name: 'large-project'
    local-path: './build'
    remote-path: '/'
    delete-removed: 'true'
    max-concurrency: '15'  # 增加并发数以加快上传
    retry-attempts: '5'    # 增加重试次数以提高稳定性
```

### 输入参数

| 参数 | 描述 | 必需 | 默认值 |
|------|------|------|--------|
| `api-key` | Dogecloud API 密钥 | ✅ | - |
| `secret-key` | Dogecloud 密钥 | ✅ | - |
| `bucket-name` | Dogecloud 存储桶名称 | ✅ | - |
| `local-path` | 要上传的本地路径 | ❌ | `./dist` |
| `remote-path` | 远程存储路径 | ❌ | `/` |
| `delete-removed` | 是否删除远程多余文件 | ❌ | `false` |
| `max-concurrency` | 最大并发上传数量 | ❌ | `5` |
| `retry-attempts` | 失败重试次数 | ❌ | `3` |

### 输出

| 输出 | 描述 |
|------|------|
| `uploaded-files` | 上传的文件数量 |
| `deployment-url` | 部署后的访问URL |
| `total-size` | 上传文件的总大小（字节） |
| `duration` | 部署耗时（毫秒） |
| `failed-files` | 失败操作的文件列表（逗号分隔） |

### 获取 Dogecloud 密钥

1. 登录 [Dogecloud 控制台](https://console.dogecloud.com/)
2. 进入 API 管理页面
3. 创建新的 API 密钥对
4. 在 GitHub 仓库的 Settings > Secrets and variables > Actions 中添加：
   - `DOGECLOUD_API_KEY`: 你的 API 密钥
   - `DOGECLOUD_SECRET_KEY`: 你的密钥

## 开发

### 环境要求

- Node.js 20+
- npm 或 yarn

### 安装依赖

```bash
npm install
```

### 构建

```bash
npm run build
```

### 测试

```bash
npm test
```

### 代码格式化

```bash
npm run format
```

### 代码检查

```bash
npm run lint
```

### 打包

```bash
npm run package
```

## 项目结构

```
dogecloud-actions/
├── .github/
│   └── workflows/          # GitHub Actions 工作流
├── __tests__/              # 测试文件
├── src/
│   ├── main.ts            # 主入口文件
│   └── deployer.ts        # Dogecloud 部署器
├── action.yml             # Action 配置文件
├── package.json           # 项目配置
├── tsconfig.json          # TypeScript 配置
├── jest.config.js         # Jest 测试配置
├── .eslintrc.js          # ESLint 配置
├── .prettierrc           # Prettier 配置
└── README.md             # 项目文档
```

## 示例

### 部署 React 应用

```yaml
name: Deploy React App

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v4
    
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '18'
        cache: 'npm'
        
    - name: Install dependencies
      run: npm ci
      
    - name: Build React app
      run: npm run build
      
    - name: Deploy to Dogecloud
      uses: ./
      with:
        api-key: ${{ secrets.DOGECLOUD_API_KEY }}
        secret-key: ${{ secrets.DOGECLOUD_SECRET_KEY }}
        bucket-name: 'my-react-app'
        local-path: './build'
        remote-path: '/'
        delete-removed: 'true'
```

### 部署 Vue.js 应用

```yaml
name: Deploy Vue App

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v4
    
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '18'
        cache: 'npm'
        
    - name: Install dependencies
      run: npm ci
      
    - name: Build Vue app
      run: npm run build
      
    - name: Deploy to Dogecloud
      uses: ./
      with:
        api-key: ${{ secrets.DOGECLOUD_API_KEY }}
        secret-key: ${{ secrets.DOGECLOUD_SECRET_KEY }}
        bucket-name: 'my-vue-app'
        local-path: './dist'
        remote-path: '/'
```

## 贡献

欢迎提交 Issue 和 Pull Request！

## 许可证

MIT License
