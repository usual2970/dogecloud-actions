import * as fs from 'fs'
import * as path from 'path'
import * as core from '@actions/core'
import { DogeCloud } from './dogecloud'

export interface DogeCloudConfig {
  apiKey: string
  secretKey: string
  bucketName: string
  endpoint?: string
  maxConcurrency?: number
  retryAttempts?: number
  retryDelay?: number
}

export interface DeployOptions {
  localPath: string
  remotePath: string
  deleteRemoved?: boolean
  maxConcurrency?: number
  chunkSize?: number
}

export interface DeployResult {
  uploadedFiles: number
  deploymentUrl: string
  totalSize: number
  duration: number
  failedFiles: string[]
}

export interface UploadProgress {
  completed: number
  total: number
  currentFile: string
  percentage: number
}

export interface FileInfo {
  localPath: string
  remotePath: string
  size: number
  mimeType?: string
}

export class DogeCloudDeployer {
  private readonly config: DogeCloudConfig
  private readonly client: DogeCloud
  private readonly endpoint: string
  private readonly maxConcurrency: number
  private readonly retryAttempts: number
  private readonly retryDelay: number

  constructor(config: DogeCloudConfig) {
    this.config = config
    this.endpoint = config.endpoint || 'https://api.dogecloud.com'
    this.maxConcurrency = config.maxConcurrency || 5
    this.retryAttempts = config.retryAttempts || 3
    this.retryDelay = config.retryDelay || 1000

    this.client = new DogeCloud(
      this.config.apiKey,
      this.config.secretKey,
      this.config.bucketName
    )
  }

  /**
   * 获取文件的MIME类型
   */
  private getMimeType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase()
    const mimeTypes: Record<string, string> = {
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
    }
    return mimeTypes[ext] || 'application/octet-stream'
  }

  /**
   * 递归获取目录下所有文件
   */
  private async getFiles(
    dirPath: string,
    basePath: string = ''
  ): Promise<FileInfo[]> {
    const files: FileInfo[] = []
    const items = await fs.promises.readdir(dirPath)

    for (const item of items) {
      const itemPath = path.join(dirPath, item)
      const stat = await fs.promises.stat(itemPath)

      if (stat.isDirectory()) {
        const subFiles = await this.getFiles(
          itemPath,
          path.join(basePath, item)
        )
        files.push(...subFiles)
      } else {
        files.push({
          localPath: itemPath,
          remotePath: path.join(basePath, item).replace(/\\/g, '/'),
          size: stat.size,
          mimeType: this.getMimeType(itemPath)
        })
      }
    }

    return files
  }

  /**
   * 上传单个文件（带重试机制）
   */
  private async uploadFile(file: FileInfo): Promise<void> {
    let lastError: Error | null = null

    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        core.info(
          `正在上传 (${attempt}/${this.retryAttempts}): ${file.remotePath}`
        )

        // 读取文件ReadStream并上传
        const fileStream = fs.createReadStream(file.localPath)
        await this.client.uploadFile(file.remotePath, fileStream)

        core.info(`✅ 上传成功: ${file.remotePath}`)
        return
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
        core.warning(
          `❌ 上传失败 (${attempt}/${this.retryAttempts}): ${file.remotePath} - ${lastError.message}`
        )

        if (attempt < this.retryAttempts) {
          const delay = this.retryDelay * Math.pow(2, attempt - 1) // 指数退避
          core.info(`⏳ 等待 ${delay}ms 后重试...`)
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      }
    }

    throw lastError || new Error(`上传失败: ${file.remotePath}`)
  }

  /**
   * 并发上传文件列表
   */
  private async uploadFilesConcurrently(
    files: FileInfo[],
    maxConcurrency?: number
  ): Promise<string[]> {
    const concurrency = maxConcurrency || this.maxConcurrency
    const failedFiles: string[] = []
    let completed = 0

    // 创建信号量控制并发数
    const semaphore = new Array(concurrency).fill(null)

    // 进度报告
    const reportProgress = () => {
      const percentage = Math.round((completed / files.length) * 100)
      core.info(`📊 上传进度: ${completed}/${files.length} (${percentage}%)`)
    }

    // 并发上传任务
    const uploadTasks = files.map(async file => {
      // 等待信号量
      await new Promise<void>(resolve => {
        const checkSemaphore = () => {
          const index = semaphore.findIndex(slot => slot === null)
          if (index !== -1) {
            semaphore[index] = file.remotePath
            resolve()
          } else {
            setTimeout(checkSemaphore, 10)
          }
        }
        checkSemaphore()
      })

      try {
        await this.uploadFile(file)
      } catch (error) {
        failedFiles.push(file.remotePath)
        core.error(`文件上传失败: ${file.remotePath} - ${error}`)
      } finally {
        // 释放信号量
        const index = semaphore.findIndex(slot => slot === file.remotePath)
        if (index !== -1) {
          semaphore[index] = null
        }

        completed++
        reportProgress()
      }
    })

    // 等待所有上传任务完成
    await Promise.all(uploadTasks)

    return failedFiles
  }

  /**
   * 并发删除远程文件
   */
  private async deleteRemoteFilesConcurrently(
    filesToDelete: string[]
  ): Promise<string[]> {
    const failedDeletes: string[] = []
    const maxConcurrency = Math.min(this.maxConcurrency, 3) // 删除操作限制更低的并发数

    // 分批删除
    const chunks = []
    for (let i = 0; i < filesToDelete.length; i += maxConcurrency) {
      chunks.push(filesToDelete.slice(i, i + maxConcurrency))
    }

    for (const chunk of chunks) {
      const deleteTasks = chunk.map(async file => {
        try {
          await this.deleteRemoteFile(file)
        } catch (error) {
          failedDeletes.push(file)
          core.error(`文件删除失败: ${file} - ${error}`)
        }
      })

      await Promise.all(deleteTasks)
    }

    return failedDeletes
  }

  /**
   * 删除远程文件
   */
  private async deleteRemoteFile(key: string): Promise<void> {
    core.info(`正在删除远程文件: ${key}`)

    await this.client.deleteFile(key)
  }

  /**
   * 执行部署
   */
  async deploy(options: DeployOptions): Promise<DeployResult> {
    const startTime = Date.now()
    const {
      localPath,
      remotePath,
      deleteRemoved = false,
      maxConcurrency,
      chunkSize
    } = options

    // 检查本地路径是否存在
    if (!fs.existsSync(localPath)) {
      throw new Error(`本地路径不存在: ${localPath}`)
    }

    const stat = await fs.promises.stat(localPath)
    let localFiles: FileInfo[] = []

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
      ]
    } else {
      // 目录
      localFiles = await this.getFiles(localPath)
      // 调整远程路径
      localFiles = localFiles.map(file => ({
        ...file,
        remotePath: path.join(remotePath, file.remotePath).replace(/\\/g, '/')
      }))
    }

    const totalSize = localFiles.reduce((sum, file) => sum + file.size, 0)
    core.info(
      `📁 发现 ${localFiles.length} 个文件需要上传，总大小: ${this.formatBytes(totalSize)}`
    )

    // 并发上传文件
    core.info(
      `🚀 开始并发上传，最大并发数: ${maxConcurrency || this.maxConcurrency}`
    )
    const failedUploads = await this.uploadFilesConcurrently(
      localFiles,
      maxConcurrency
    )

    // 删除远程多余文件（如果启用）
    const failedDeletes: string[] = []
    if (deleteRemoved) {
      core.info(`🔍 检查需要删除的远程文件...`)
      const remoteFiles = await this.client.allFiles()
      const localRemotePaths = new Set(localFiles.map(f => f.remotePath))

      const filesToDelete = remoteFiles.filter(
        file => !localRemotePaths.has(file)
      )

      if (filesToDelete.length > 0) {
        core.info(`🗑️ 需要删除 ${filesToDelete.length} 个远程文件`)
        const deleteFailures =
          await this.deleteRemoteFilesConcurrently(filesToDelete)
        failedDeletes.push(...deleteFailures)
      } else {
        core.info(`✅ 没有需要删除的远程文件`)
      }
    }

    const duration = Date.now() - startTime
    const uploadedFiles = localFiles.length - failedUploads.length
    const allFailedFiles = [...failedUploads, ...failedDeletes]

    // 构建部署URL（这里需要根据实际的Dogecloud CDN域名配置）
    const deploymentUrl = `https://${this.config.bucketName}.dogecdn.com${remotePath}`

    // 输出部署总结
    core.info(`\n📊 部署完成总结:`)
    core.info(`⏱️  耗时: ${this.formatDuration(duration)}`)
    core.info(`✅ 成功上传: ${uploadedFiles}/${localFiles.length} 个文件`)
    core.info(`📦 总大小: ${this.formatBytes(totalSize)}`)
    core.info(`🌐 部署地址: ${deploymentUrl}`)

    if (allFailedFiles.length > 0) {
      core.warning(`❌ 失败操作: ${allFailedFiles.length} 个`)
      allFailedFiles.forEach(file => core.warning(`   - ${file}`))
    }

    return {
      uploadedFiles,
      deploymentUrl,
      totalSize,
      duration,
      failedFiles: allFailedFiles
    }
  }

  /**
   * 格式化字节大小
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  /**
   * 格式化持续时间
   */
  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60

    if (minutes > 0) {
      return `${minutes}分${remainingSeconds}秒`
    } else {
      return `${remainingSeconds}秒`
    }
  }
}
