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
const core = __importStar(require("@actions/core"));
const deployer_1 = require("./deployer");
async function run() {
    try {
        // 获取输入参数
        const apiKey = core.getInput('api-key', { required: true });
        const secretKey = core.getInput('secret-key', { required: true });
        const bucketName = core.getInput('bucket-name', { required: true });
        const localPath = core.getInput('local-path') || './dist';
        const remotePath = core.getInput('remote-path') || '/';
        const deleteRemoved = core.getInput('delete-removed') === 'true';
        const maxConcurrency = parseInt(core.getInput('max-concurrency') || '5', 10);
        const retryAttempts = parseInt(core.getInput('retry-attempts') || '3', 10);
        core.info(`🚀 开始部署到 Dogecloud...`);
        core.info(`📁 本地路径: ${localPath}`);
        core.info(`🌐 远程路径: ${remotePath}`);
        core.info(`🪣 存储桶: ${bucketName}`);
        core.info(`⚡ 最大并发数: ${maxConcurrency}`);
        core.info(`🔄 重试次数: ${retryAttempts}`);
        // 创建部署器实例
        const deployer = new deployer_1.DogeCloudDeployer({
            apiKey,
            secretKey,
            bucketName,
            maxConcurrency,
            retryAttempts
        });
        // 执行部署
        const result = await deployer.deploy({
            localPath,
            remotePath,
            deleteRemoved,
            maxConcurrency
        });
        // 设置输出
        core.setOutput('uploaded-files', result.uploadedFiles.toString());
        core.setOutput('deployment-url', result.deploymentUrl);
        core.setOutput('total-size', result.totalSize.toString());
        core.setOutput('duration', result.duration.toString());
        core.setOutput('failed-files', result.failedFiles.join(','));
        if (result.failedFiles.length > 0) {
            core.warning(`⚠️ 部署完成，但有 ${result.failedFiles.length} 个操作失败`);
            core.warning(`失败的文件: ${result.failedFiles.join(', ')}`);
        }
        else {
            core.info(`🎉 部署完全成功!`);
        }
        core.info(`📊 上传文件数: ${result.uploadedFiles}`);
        core.info(`🌐 部署地址: ${result.deploymentUrl}`);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        core.setFailed(`❌ 部署失败: ${message}`);
    }
}
run();
//# sourceMappingURL=main.js.map