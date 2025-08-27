# Changelog

所有对此项目的重要更改都将记录在此文件中。

格式基于 [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)，
并且此项目遵循 [语义化版本](https://semver.org/spec/v2.0.0.html)。

## [Unreleased]

### Added
- 并发文件上传功能，支持自定义最大并发数
- 文件上传重试机制，支持指数退避策略
- 详细的上传进度显示和统计信息
- 性能优化的批量删除远程文件功能
- 完整的错误处理和失败文件追踪
- 文件大小和持续时间格式化显示

### Changed
- 改进了部署结果接口，增加了更多统计信息
- 优化了API请求的错误处理机制
- 增强了日志输出的可读性

## [1.0.0] - 2024-08-27

### Added
- 初始版本发布
- 基本的 Dogecloud CDN 部署功能
- 支持单文件和目录上传
- 可选的远程文件清理功能
- GitHub Actions 集成
- TypeScript 支持
- 完整的测试套件
- CI/CD 工作流
- 详细的文档和使用示例

### Security
- API 密钥安全处理
- 请求签名验证机制

## [0.1.0] - 2024-08-27

### Added
- 项目初始化
- 基础项目结构搭建
- 开发环境配置

[Unreleased]: https://github.com/yourusername/dogecloud-actions/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/yourusername/dogecloud-actions/releases/tag/v1.0.0
[0.1.0]: https://github.com/yourusername/dogecloud-actions/releases/tag/v0.1.0
