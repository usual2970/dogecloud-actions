"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.DogeCloudDeployer = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const core = __importStar(require("@actions/core"));
const dogecloud_1 = require("./dogecloud");
class DogeCloudDeployer {
    constructor(config) {
        this.config = config;
        this.endpoint = config.endpoint || 'https://api.dogecloud.com';
        this.maxConcurrency = config.maxConcurrency || 5;
        this.retryAttempts = config.retryAttempts || 3;
        this.retryDelay = config.retryDelay || 1000;
        this.client = new dogecloud_1.DogeCloud(this.config.apiKey, this.config.secretKey, this.config.bucketName);
    }
    /**
     * 获取文件的MIME类型
     */
    getMimeType(filePath) {
        const ext = path.extname(filePath).toLowerCase();
        const mimeTypes = {
            '.html': 'text/html',
            '.css': 'text/css',
            '.js': 'application/javascript',
            '.json': 'application/json',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.gif': 'image/gif',
            '.svg': 'image/svg+xml',
            '.ico': 'image/x-icon',
            '.woff': 'font/woff',
            '.woff2': 'font/woff2',
            '.ttf': 'font/ttf',
            '.eot': 'application/vnd.ms-fontobject'
        };
        return mimeTypes[ext] || 'application/octet-stream';
    }
    /**
     * 递归获取目录下所有文件
     */
    async getFiles(dirPath, basePath = '') {
        const files = [];
        const items = await fs.promises.readdir(dirPath);
        for (const item of items) {
            const itemPath = path.join(dirPath, item);
            const stat = await fs.promises.stat(itemPath);
            if (stat.isDirectory()) {
                const subFiles = await this.getFiles(itemPath, path.join(basePath, item));
                files.push(...subFiles);
            }
            else {
                files.push({
                    localPath: itemPath,
                    remotePath: path.join(basePath, item).replace(/\\/g, '/'),
                    size: stat.size,
                    mimeType: this.getMimeType(itemPath)
                });
            }
        }
        return files;
    }
    /**
     * 上传单个文件（带重试机制）
     */
    async uploadFile(file) {
        let lastError = null;
        for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
            try {
                core.info(`正在上传 (${attempt}/${this.retryAttempts}): ${file.remotePath}`);
                // 读取文件ReadStream并上传
                const fileStream = fs.createReadStream(file.localPath);
                await this.client.uploadFile(file.remotePath, fileStream);
                core.info(`✅ 上传成功: ${file.remotePath}`);
                return;
            }
            catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));
                core.warning(`❌ 上传失败 (${attempt}/${this.retryAttempts}): ${file.remotePath} - ${lastError.message}`);
                if (attempt < this.retryAttempts) {
                    const delay = this.retryDelay * Math.pow(2, attempt - 1); // 指数退避
                    core.info(`⏳ 等待 ${delay}ms 后重试...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }
        throw lastError || new Error(`上传失败: ${file.remotePath}`);
    }
    /**
     * 并发上传文件列表
     */
    async uploadFilesConcurrently(files, maxConcurrency) {
        const concurrency = maxConcurrency || this.maxConcurrency;
        const failedFiles = [];
        let completed = 0;
        // 创建信号量控制并发数
        const semaphore = new Array(concurrency).fill(null);
        // 进度报告
        const reportProgress = () => {
            const percentage = Math.round((completed / files.length) * 100);
            core.info(`📊 上传进度: ${completed}/${files.length} (${percentage}%)`);
        };
        // 并发上传任务
        const uploadTasks = files.map(async (file) => {
            // 等待信号量
            await new Promise(resolve => {
                const checkSemaphore = () => {
                    const index = semaphore.findIndex(slot => slot === null);
                    if (index !== -1) {
                        semaphore[index] = file.remotePath;
                        resolve();
                    }
                    else {
                        setTimeout(checkSemaphore, 10);
                    }
                };
                checkSemaphore();
            });
            try {
                await this.uploadFile(file);
            }
            catch (error) {
                failedFiles.push(file.remotePath);
                core.error(`文件上传失败: ${file.remotePath} - ${error}`);
            }
            finally {
                // 释放信号量
                const index = semaphore.findIndex(slot => slot === file.remotePath);
                if (index !== -1) {
                    semaphore[index] = null;
                }
                completed++;
                reportProgress();
            }
        });
        // 等待所有上传任务完成
        await Promise.all(uploadTasks);
        return failedFiles;
    }
    /**
     * 并发删除远程文件
     */
    async deleteRemoteFilesConcurrently(filesToDelete) {
        const failedDeletes = [];
        const maxConcurrency = Math.min(this.maxConcurrency, 3); // 删除操作限制更低的并发数
        // 分批删除
        const chunks = [];
        for (let i = 0; i < filesToDelete.length; i += maxConcurrency) {
            chunks.push(filesToDelete.slice(i, i + maxConcurrency));
        }
        for (const chunk of chunks) {
            const deleteTasks = chunk.map(async (file) => {
                try {
                    await this.deleteRemoteFile(file);
                }
                catch (error) {
                    failedDeletes.push(file);
                    core.error(`文件删除失败: ${file} - ${error}`);
                }
            });
            await Promise.all(deleteTasks);
        }
        return failedDeletes;
    }
    /**
     * 删除远程文件
     */
    async deleteRemoteFile(key) {
        core.info(`正在删除远程文件: ${key}`);
        await this.client.deleteFile(key);
    }
    /**
     * 执行部署
     */
    async deploy(options) {
        const startTime = Date.now();
        const { localPath, remotePath, maxConcurrency, chunkSize } = options;
        let deleteRemoved = options.deleteRemoved || false;
        // 检查本地路径是否存在
        if (!fs.existsSync(localPath)) {
            throw new Error(`本地路径不存在: ${localPath}`);
        }
        const stat = await fs.promises.stat(localPath);
        let localFiles = [];
        if (stat.isFile()) {
            // 单个文件
            localFiles = [
                {
                    localPath,
                    remotePath: path
                        .join(remotePath, path.basename(localPath))
                        .replace(/\\/g, '/'),
                    size: stat.size,
                    mimeType: this.getMimeType(localPath)
                }
            ];
        }
        else {
            // 目录
            localFiles = await this.getFiles(localPath);
            // 调整远程路径
            localFiles = localFiles.map(file => ({
                ...file,
                remotePath: path.join(remotePath, file.remotePath).replace(/\\/g, '/')
            }));
        }
        const totalSize = localFiles.reduce((sum, file) => sum + file.size, 0);
        core.info(`📁 发现 ${localFiles.length} 个文件需要上传，总大小: ${this.formatBytes(totalSize)}`);
        // 如果启用删除远程文件，先获取远程文件列表（在上传之前）
        let remoteFilesBeforeUpload = [];
        if (deleteRemoved) {
            core.info(`🔍 获取远程文件列表（上传前）...`);
            try {
                remoteFilesBeforeUpload = await this.client.allFiles();
                core.info(`📝 远程现有文件数量: ${remoteFilesBeforeUpload.length}`);
            }
            catch (error) {
                core.warning(`⚠️ 获取远程文件列表失败，跳过清理: ${error}`);
                // 如果获取失败，为安全起见关闭删除功能
                deleteRemoved = false;
            }
        }
        // 并发上传文件
        core.info(`🚀 开始并发上传，最大并发数: ${maxConcurrency || this.maxConcurrency}`);
        const failedUploads = await this.uploadFilesConcurrently(localFiles, maxConcurrency);
        // 删除远程多余文件（如果启用）
        const failedDeletes = [];
        if (deleteRemoved && remoteFilesBeforeUpload.length > 0) {
            core.info(`�️ 开始清理远程多余文件...`);
            // 创建本地文件的远程路径集合，确保路径格式一致
            const localRemotePaths = new Set(localFiles.map(f => {
                // 标准化路径格式，确保路径分隔符一致
                let normalizedPath = f.remotePath.replace(/\\/g, '/');
                // 确保路径格式与远程文件路径格式一致
                if (!normalizedPath.startsWith('/') && remotePath.startsWith('/')) {
                    normalizedPath = '/' + normalizedPath;
                }
                return normalizedPath;
            }));
            // 标准化远程文件路径并过滤需要删除的文件
            const filesToDelete = remoteFilesBeforeUpload.filter(remoteFile => {
                // 标准化远程文件路径
                let normalizedRemoteFile = '/' + this.trimStartChars(remoteFile.replace(/\\/g, '/'), '/');
                // 检查是否在本地文件列表中
                const shouldKeep = localRemotePaths.has(normalizedRemoteFile);
                if (!shouldKeep) {
                    core.info(`🗑️ 标记删除: ${remoteFile}`);
                }
                return !shouldKeep;
            });
            // 输出调试信息
            core.info(`📋 本地文件映射的远程路径 (${localRemotePaths.size} 个):`);
            Array.from(localRemotePaths)
                .slice(0, 5)
                .forEach(path => core.info(`   - ${path}`));
            if (localRemotePaths.size > 5) {
                core.info(`   ... 还有 ${localRemotePaths.size - 5} 个文件`);
            }
            if (filesToDelete.length > 0) {
                core.info(`🗑️ 需要删除 ${filesToDelete.length} 个远程文件`);
                // 安全检查：避免删除过多文件
                const deleteRatio = filesToDelete.length / remoteFilesBeforeUpload.length;
                if (deleteRatio > 0.8) {
                    core.warning(`⚠️ 警告：即将删除 ${Math.round(deleteRatio * 100)}% 的远程文件，这可能不安全`);
                    core.warning(`如果确认要删除这些文件，请检查路径配置是否正确`);
                }
                filesToDelete.slice(0, 10).forEach(file => core.info(`   - ${file}`));
                if (filesToDelete.length > 10) {
                    core.info(`   ... 还有 ${filesToDelete.length - 10} 个文件`);
                }
                const deleteFailures = await this.deleteRemoteFilesConcurrently(filesToDelete);
                failedDeletes.push(...deleteFailures);
            }
            else {
                core.info(`✅ 没有需要删除的远程文件`);
            }
        }
        const duration = Date.now() - startTime;
        const uploadedFiles = localFiles.length - failedUploads.length;
        const allFailedFiles = [...failedUploads, ...failedDeletes];
        // 构建部署URL（这里需要根据实际的Dogecloud CDN域名配置）
        const deploymentUrl = `https://${this.config.bucketName}.dogecdn.com${remotePath}`;
        // 输出部署总结
        core.info(`\n📊 部署完成总结:`);
        core.info(`⏱️  耗时: ${this.formatDuration(duration)}`);
        core.info(`✅ 成功上传: ${uploadedFiles}/${localFiles.length} 个文件`);
        core.info(`📦 总大小: ${this.formatBytes(totalSize)}`);
        core.info(`🌐 部署地址: ${deploymentUrl}`);
        if (allFailedFiles.length > 0) {
            core.warning(`❌ 失败操作: ${allFailedFiles.length} 个`);
            allFailedFiles.forEach(file => core.warning(`   - ${file}`));
        }
        return {
            uploadedFiles,
            deploymentUrl,
            totalSize,
            duration,
            failedFiles: allFailedFiles
        };
    }
    /**
     * 格式化字节大小
     */
    formatBytes(bytes) {
        if (bytes === 0)
            return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    /**
     * 格式化持续时间
     */
    formatDuration(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        if (minutes > 0) {
            return `${minutes}分${remainingSeconds}秒`;
        }
        else {
            return `${remainingSeconds}秒`;
        }
    }
    // 只去除开头的指定字符
    trimStartChars(str, chars) {
        const charSet = new Set(chars.split(''));
        let start = 0;
        while (start < str.length && charSet.has(str[start])) {
            start++;
        }
        return str.slice(start);
    }
}
exports.DogeCloudDeployer = DogeCloudDeployer;
//# sourceMappingURL=deployer.js.map