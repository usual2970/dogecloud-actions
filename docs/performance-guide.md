# 性能优化指南

## 并发参数调优

### 推荐的并发设置

根据不同的使用场景，我们推荐以下并发参数：

| 场景 | 文件数量 | 推荐并发数 | 重试次数 | 说明 |
|------|----------|------------|----------|------|
| 小型项目 | < 50 | 3-5 | 3 | 默认设置，适合大多数情况 |
| 中型项目 | 50-200 | 8-12 | 5 | 平衡性能和稳定性 |
| 大型项目 | 200-1000 | 15-20 | 5 | 高性能设置 |
| 超大项目 | > 1000 | 20-30 | 7 | 极限性能，需要稳定网络 |

### 性能调优技巧

#### 1. 网络带宽考虑

- **低带宽环境** (< 10Mbps): 使用较低的并发数 (3-5)
- **中等带宽** (10-100Mbps): 使用中等并发数 (8-15)
- **高带宽环境** (> 100Mbps): 可以使用高并发数 (15-30)

#### 2. 文件大小影响

- **小文件为主** (< 1MB): 可以使用更高的并发数
- **大文件为主** (> 10MB): 建议降低并发数，避免内存压力

#### 3. 重试策略

- **稳定网络**: 3次重试通常足够
- **不稳定网络**: 增加到5-7次重试
- **移动网络**: 建议7-10次重试

### 监控和诊断

#### 常见问题和解决方案

1. **上传速度慢**
   - 检查网络带宽
   - 适当增加并发数
   - 检查是否有防火墙限制

2. **频繁重试**
   - 降低并发数
   - 增加重试间隔
   - 检查API限流设置

3. **内存使用过高**
   - 降低并发数
   - 检查文件大小分布
   - 考虑分批上传

### 最佳实践

#### 1. 渐进式调优

```yaml
# 第一次部署：使用保守设置
- name: Initial Deploy
  uses: ./
  with:
    max-concurrency: '5'
    retry-attempts: '3'

# 优化后：根据性能测试结果调整
- name: Optimized Deploy
  uses: ./
  with:
    max-concurrency: '12'
    retry-attempts: '5'
```

#### 2. 条件化配置

```yaml
# 根据分支使用不同的性能设置
- name: Deploy to Production
  uses: ./
  with:
    max-concurrency: ${{ github.ref == 'refs/heads/main' && '15' || '8' }}
    retry-attempts: ${{ github.ref == 'refs/heads/main' && '5' || '3' }}
```

#### 3. 环境变量配置

```yaml
env:
  # 生产环境使用高性能设置
  DEPLOY_CONCURRENCY: ${{ secrets.DEPLOY_CONCURRENCY || '10' }}
  DEPLOY_RETRIES: ${{ secrets.DEPLOY_RETRIES || '5' }}

steps:
- name: Deploy
  uses: ./
  with:
    max-concurrency: ${{ env.DEPLOY_CONCURRENCY }}
    retry-attempts: ${{ env.DEPLOY_RETRIES }}
```

### 性能测试

#### 基准测试脚本

创建一个简单的性能测试：

```bash
#!/bin/bash

echo "开始性能测试..."

# 测试不同并发设置
for concurrency in 5 10 15 20; do
    echo "测试并发数: $concurrency"
    
    start_time=$(date +%s)
    
    # 运行部署
    npm run deploy -- --max-concurrency=$concurrency
    
    end_time=$(date +%s)
    duration=$((end_time - start_time))
    
    echo "并发数 $concurrency 完成时间: ${duration}秒"
    echo "---"
done
```

#### 监控指标

关注以下关键指标：

- **总部署时间**: 完成所有文件上传的时间
- **平均文件上传时间**: 总时间除以文件数量
- **失败率**: 失败的文件数量占总数的百分比
- **重试次数**: 总重试次数，反映网络稳定性
- **内存使用**: 峰值内存使用量

### 故障排除

#### 日志分析

查看部署日志中的关键信息：

```
📊 上传进度: 45/100 (45%)
✅ 上传成功: file1.js
❌ 上传失败 (2/3): file2.css - 网络超时
⏳ 等待 2000ms 后重试...
```

#### 常见错误码

- **429**: API限流，降低并发数
- **500/502/503**: 服务器错误，增加重试次数
- **ETIMEDOUT**: 网络超时，检查网络连接

### 高级配置示例

#### 自适应并发

```typescript
// 在实际项目中，可以根据文件数量自动调整并发数
const fileCount = 150;
const adaptiveConcurrency = Math.min(
  Math.max(Math.floor(fileCount / 10), 5), // 最少5个并发
  20 // 最多20个并发
);
```

#### 分组上传

```typescript
// 对于超大项目，可以考虑分组上传
const largeFiles = files.filter(f => f.size > 10 * 1024 * 1024); // > 10MB
const smallFiles = files.filter(f => f.size <= 10 * 1024 * 1024); // <= 10MB

// 先上传小文件（高并发）
await uploadFiles(smallFiles, { maxConcurrency: 20 });

// 再上传大文件（低并发）
await uploadFiles(largeFiles, { maxConcurrency: 5 });
```
