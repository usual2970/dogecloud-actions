import { DogeCloudDeployer } from '../src/deployer'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

describe('并发性能测试', () => {
  let deployer: DogeCloudDeployer
  let testDir: string

  beforeAll(async () => {
    deployer = new DogeCloudDeployer({
      apiKey: 'test-api-key',
      secretKey: 'test-secret-key',
      bucketName: 'test-bucket'
    })

    // 创建测试目录和文件
    testDir = path.join(os.tmpdir(), 'dogecloud-test-' + Date.now())
    await fs.promises.mkdir(testDir, { recursive: true })

    // 创建多个测试文件
    for (let i = 0; i < 20; i++) {
      const filePath = path.join(testDir, `test-file-${i}.txt`)
      await fs.promises.writeFile(filePath, `测试文件内容 ${i}`.repeat(100))
    }
  })

  afterAll(async () => {
    // 清理测试目录
    await fs.promises.rm(testDir, { recursive: true, force: true })
  })

  test('应该正确创建部署器实例', () => {
    expect(deployer).toBeInstanceOf(DogeCloudDeployer)
  })

  test('应该能够获取文件列表', async () => {
    // 这里可以添加实际的文件扫描测试
    const files = await fs.promises.readdir(testDir)
    expect(files.length).toBe(20)
  })

  // 注意：以下测试需要实际的Dogecloud API凭证
  // 在实际测试中，你可能需要模拟API调用

  test.skip('并发上传性能测试', async () => {
    const startTime = Date.now()

    // 使用并发上传
    const result = await deployer.deploy({
      localPath: testDir,
      remotePath: '/test',
      maxConcurrency: 10
    })

    const duration = Date.now() - startTime

    expect(result.uploadedFiles).toBe(20)
    expect(duration).toBeLessThan(30000) // 应该在30秒内完成

    console.log(`并发上传完成时间: ${duration}ms`)
    console.log(`平均每文件: ${Math.round(duration / 20)}ms`)
  })

  test.skip('串行上传性能对比测试', async () => {
    const deployer = new DogeCloudDeployer({
      apiKey: 'test-api-key',
      secretKey: 'test-secret-key',
      bucketName: 'test-bucket',
      maxConcurrency: 1 // 串行上传
    })

    const startTime = Date.now()

    const result = await deployer.deploy({
      localPath: testDir,
      remotePath: '/test-serial',
      maxConcurrency: 1
    })

    const duration = Date.now() - startTime

    expect(result.uploadedFiles).toBe(20)

    console.log(`串行上传完成时间: ${duration}ms`)
    console.log(`平均每文件: ${Math.round(duration / 20)}ms`)
  })
})
