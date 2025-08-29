export interface DogeCloudConfig {
    apiKey: string;
    secretKey: string;
    bucketName: string;
    endpoint?: string;
    maxConcurrency?: number;
    retryAttempts?: number;
    retryDelay?: number;
}
export interface DeployOptions {
    localPath: string;
    remotePath: string;
    deleteRemoved?: boolean;
    maxConcurrency?: number;
    chunkSize?: number;
}
export interface DeployResult {
    uploadedFiles: number;
    deploymentUrl: string;
    totalSize: number;
    duration: number;
    failedFiles: string[];
}
export interface UploadProgress {
    completed: number;
    total: number;
    currentFile: string;
    percentage: number;
}
export interface FileInfo {
    localPath: string;
    remotePath: string;
    size: number;
    mimeType?: string;
}
export declare class DogeCloudDeployer {
    private readonly config;
    private readonly client;
    private readonly endpoint;
    private readonly maxConcurrency;
    private readonly retryAttempts;
    private readonly retryDelay;
    constructor(config: DogeCloudConfig);
    /**
     * 生成API签名
     */
    private generateSignature;
    /**
     * 发送API请求
     */
    private apiRequest;
    /**
     * 获取文件的MIME类型
     */
    private getMimeType;
    /**
     * 递归获取目录下所有文件
     */
    private getFiles;
    /**
     * 上传单个文件（带重试机制）
     */
    private uploadFile;
    /**
     * 并发上传文件列表
     */
    private uploadFilesConcurrently;
    /**
     * 并发删除远程文件
     */
    private deleteRemoteFilesConcurrently;
    /**
     * 获取远程文件列表
     */
    private getRemoteFiles;
    /**
     * 删除远程文件
     */
    private deleteRemoteFile;
    /**
     * 执行部署
     */
    deploy(options: DeployOptions): Promise<DeployResult>;
    /**
     * 格式化字节大小
     */
    private formatBytes;
    /**
     * 格式化持续时间
     */
    private formatDuration;
}
//# sourceMappingURL=deployer.d.ts.map