# DogeCloud Actions 测试指南

这个项目包含两种类型的测试：单元测试和集成测试。

## 测试类型

### 单元测试 (Unit Tests)
- 文件：`tests/dogecloud.test.ts`
- 使用 Mock 对象测试各个功能模块
- 不需要真实的 API 凭据
- 运行快速，适合开发过程中频繁运行

### 集成测试 (Integration Tests)
- 文件：`tests/dogecloud.integration.test.ts`
- 使用真实的 DogeCloud API 进行测试
- 需要真实的 API 凭据
- 运行较慢，适合部署前验证

## 运行测试

### 运行所有测试
```bash
npm test
```

### 只运行单元测试
```bash
npm run test:unit
```

### 只运行集成测试
```bash
npm run test:integration
```

### 监视模式 (开发时使用)
```bash
npm run test:watch
```

### 生成覆盖率报告
```bash
npm run test:coverage
```

## 配置集成测试

### 1. 创建环境变量文件
复制 `.env.test.example` 为 `.env.test`：
```bash
cp .env.test.example .env.test
```

### 2. 填入真实凭据
编辑 `.env.test` 文件：
```env
DOGECLOUD_ACCESS_KEY=你的访问密钥
DOGECLOUD_SECRET_KEY=你的密钥
```

### 3. 运行集成测试
```bash
npm run test:integration
```

## 测试功能覆盖

### 单元测试覆盖
- ✅ DogeCloud 类构造函数
- ✅ getTmpToken() 方法 (包括缓存机制)
- ✅ initS3Client() 方法
- ✅ uploadFile() 方法
- ✅ dogecloudApi() 方法 (包括签名验证)
- ✅ 错误处理

### 集成测试覆盖
- ✅ 真实 API 获取临时令牌
- ✅ 真实 S3 客户端初始化
- ✅ 真实文件上传到 DogeCloud
- ✅ 令牌缓存机制
- ✅ 并发上传测试
- ✅ 错误处理 (无效凭据、网络错误)
- ✅ 性能测试 (响应时间、大文件上传)

## 测试输出示例

### 单元测试输出
```
DogeCloud
  constructor
    ✓ should create an instance with access and secret keys
  getTmpToken
    ✓ should successfully get temporary token
    ✓ should cache token and not make additional requests when token is valid
    ✓ should refresh token when expired
    ✓ should throw error when API returns error code
  ...
```

### 集成测试输出
```
DogeCloud Integration Tests
  Real API Tests
    ✓ should get temporary token from real API
    ✅ Token received: { accessKeyId: '12345678...', bucket: 'my-bucket', ... }
    ✓ should initialize S3 client with real credentials
    ✅ S3 client initialized successfully
    ✓ should upload file to real S3 bucket
    ✅ File uploaded successfully: integration-test/1234567890-test-file.txt
    ...
```

## 注意事项

1. **不要提交 .env.test 文件**：该文件包含敏感信息，已被 .gitignore 忽略
2. **集成测试会产生实际费用**：虽然测试文件很小，但上传到 DogeCloud 可能产生少量费用
3. **网络依赖**：集成测试需要稳定的网络连接
4. **API 限制**：请注意 DogeCloud API 的调用频率限制

## 故障排除

### 集成测试跳过
如果看到 "Skipping integration tests" 消息，检查：
- `.env.test` 文件是否存在
- 环境变量是否正确设置
- 凭据是否有效

### 测试超时
如果测试超时，可能原因：
- 网络连接不稳定
- DogeCloud 服务响应慢
- 文件过大

可以在测试文件中调整超时时间。

### API 错误
常见错误及解决方案：
- `401 Unauthorized`：检查访问密钥和密钥是否正确
- `403 Forbidden`：检查账户权限和余额
- `429 Too Many Requests`：降低测试频率或稍后重试
