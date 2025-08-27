import * as core from '@actions/core'
import { DogeCloudDeployer } from './deployer'

async function run(): Promise<void> {
  try {
    // 获取输入参数
    const apiKey = core.getInput('api-key', { required: true })
    const secretKey = core.getInput('secret-key', { required: true })
    const bucketName = core.getInput('bucket-name', { required: true })
    const localPath = core.getInput('local-path') || './dist'
    const remotePath = core.getInput('remote-path') || '/'
    const deleteRemoved = core.getInput('delete-removed') === 'true'
    const maxConcurrency = parseInt(core.getInput('max-concurrency') || '5', 10)
    const retryAttempts = parseInt(core.getInput('retry-attempts') || '3', 10)

    core.info(`🚀 开始部署到 Dogecloud...`)
    core.info(`📁 本地路径: ${localPath}`)
    core.info(`🌐 远程路径: ${remotePath}`)
    core.info(`🪣 存储桶: ${bucketName}`)
    core.info(`⚡ 最大并发数: ${maxConcurrency}`)
    core.info(`🔄 重试次数: ${retryAttempts}`)

    // 创建部署器实例
    const deployer = new DogeCloudDeployer({
      apiKey,
      secretKey,
      bucketName,
      maxConcurrency,
      retryAttempts
    })

    // 执行部署
    const result = await deployer.deploy({
      localPath,
      remotePath,
      deleteRemoved,
      maxConcurrency
    })

    // 设置输出
    core.setOutput('uploaded-files', result.uploadedFiles.toString())
    core.setOutput('deployment-url', result.deploymentUrl)
    core.setOutput('total-size', result.totalSize.toString())
    core.setOutput('duration', result.duration.toString())
    core.setOutput('failed-files', result.failedFiles.join(','))

    if (result.failedFiles.length > 0) {
      core.warning(`⚠️ 部署完成，但有 ${result.failedFiles.length} 个操作失败`)
      core.warning(`失败的文件: ${result.failedFiles.join(', ')}`)
    } else {
      core.info(`🎉 部署完全成功!`)
    }

    core.info(`📊 上传文件数: ${result.uploadedFiles}`)
    core.info(`🌐 部署地址: ${result.deploymentUrl}`)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    core.setFailed(`❌ 部署失败: ${message}`)
  }
}

run()
