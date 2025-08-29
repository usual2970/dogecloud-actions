import { DogeCloud } from '../src/dogecloud'
import { createReadStream, writeFileSync, unlinkSync, existsSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

/**
 * 集成测试 - 使用真实的 DogeCloud API
 *
 * 运行前需要设置环境变量：
 * DOGECLOUD_ACCESS_KEY=your_access_key
 * DOGECLOUD_SECRET_KEY=your_secret_key
 *
 * 或者在项目根目录创建 .env.test 文件：
 * DOGECLOUD_ACCESS_KEY=your_access_key
 * DOGECLOUD_SECRET_KEY=your_secret_key
 */

// 检查环境变量
const accessKey = process.env.DOGECLOUD_ACCESS_KEY
const secretKey = process.env.DOGECLOUD_SECRET_KEY
const bucket = process.env.DOGECLOUD_BUCKET
const hasCredentials = !!(accessKey && secretKey && bucket)

if (!hasCredentials) {
  console.warn(
    '⚠️  Skipping integration tests - DogeCloud credentials not found'
  )
  console.log('Please set environment variables:')
  console.log('DOGECLOUD_ACCESS_KEY=your_access_key')
  console.log('DOGECLOUD_SECRET_KEY=your_secret_key')
}

const describeIf = (condition: boolean) =>
  condition ? describe : describe.skip

describeIf(hasCredentials)('DogeCloud Integration Tests', () => {
  let dogeCloud: DogeCloud
  const testFileName = 'test-integration-file.txt'
  const testFilePath = join(tmpdir(), testFileName)
  const testFileContent =
    'This is a test file for DogeCloud integration testing.\nCreated at: ' +
    new Date().toISOString()

  beforeAll(() => {
    dogeCloud = new DogeCloud(accessKey!, secretKey!, bucket!)

    // 创建测试文件
    writeFileSync(testFilePath, testFileContent, 'utf8')
  })

  afterAll(() => {
    // 清理测试文件
    if (existsSync(testFilePath)) {
      unlinkSync(testFilePath)
    }
  })

  describe('Real API Tests', () => {
    it('should get temporary token from real API', async () => {
      const token = await dogeCloud.getTmpToken()

      expect(token).toBeDefined()
      expect(token.Credentials).toBeDefined()
      expect(token.Credentials.accessKeyId).toBeTruthy()
      expect(token.Credentials.secretAccessKey).toBeTruthy()
      expect(token.Credentials.sessionToken).toBeTruthy()
      expect(token.ExpiredAt).toBeGreaterThan(Math.floor(Date.now() / 1000))
      expect(token.Buckets).toBeInstanceOf(Array)
      expect(token.Buckets.length).toBeGreaterThan(0)
      expect(token.Buckets[0].name).toBeTruthy()
      expect(token.Buckets[0].s3Bucket).toBeTruthy()
      expect(token.Buckets[0].s3Endpoint).toBeTruthy()

      console.log('✅ Token received:', {
        accessKeyId: token.Credentials.accessKeyId.substring(0, 8) + '...',
        bucket: token.Buckets[0].name,
        endpoint: token.Buckets[0].s3Endpoint,
        expiresIn: token.ExpiredAt - Math.floor(Date.now() / 1000) + ' seconds'
      })
    }, 10000) // 10 second timeout

    it('should initialize S3 client with real credentials', async () => {
      const s3Client = await dogeCloud.initS3Client()

      expect(s3Client).toBeDefined()
      expect(typeof s3Client.send).toBe('function')

      console.log('✅ S3 client initialized successfully')
    }, 10000)

    it('should list all files in the bucket', async () => {
      const files = await dogeCloud.allFiles()

      expect(files).toBeDefined()
      expect(Array.isArray(files)).toBe(true)
      expect(files.length).toBeGreaterThan(0)

      console.log('✅ Files listed successfully:', files)
    }, 10000)

    it('should upload file to real S3 bucket', async () => {
      const fileStream = createReadStream(testFilePath)
      const uploadKey = `integration-test/${Date.now()}-${testFileName}`

      const result = await dogeCloud.uploadFile(uploadKey, fileStream)

      expect(result).toBe(uploadKey)

      console.log('✅ File uploaded successfully:', uploadKey)
    }, 30000) // 30 second timeout for upload

    it('should handle token caching correctly', async () => {
      const startTime = Date.now()

      // First call - should make API request
      const token1 = await dogeCloud.getTmpToken()
      const firstCallTime = Date.now() - startTime

      // Second call - should use cached token
      const cacheStartTime = Date.now()
      const token2 = await dogeCloud.getTmpToken()
      const secondCallTime = Date.now() - cacheStartTime

      expect(token1).toEqual(token2)
      expect(secondCallTime).toBeLessThan(firstCallTime / 2) // Cached call should be much faster

      console.log('✅ Token caching works:', {
        firstCall: firstCallTime + 'ms',
        cachedCall: secondCallTime + 'ms'
      })
    }, 15000)

    it('should handle multiple concurrent uploads', async () => {
      const uploadPromises: Promise<string>[] = []
      const fileCount = 3

      for (let i = 0; i < fileCount; i++) {
        const fileStream = createReadStream(testFilePath)
        const uploadKey = `integration-test/concurrent-${Date.now()}-${i}-${testFileName}`
        uploadPromises.push(dogeCloud.uploadFile(uploadKey, fileStream))
      }

      const results = await Promise.all(uploadPromises)

      expect(results).toHaveLength(fileCount)
      results.forEach((result, index) => {
        expect(result).toContain(
          `concurrent-${Date.now().toString().substring(0, 8)}`
        )
      })

      console.log('✅ Concurrent uploads completed:', results.length + ' files')
    }, 60000) // 60 second timeout for concurrent uploads
  })

  describe('Error Handling Tests', () => {
    it('should handle invalid credentials gracefully', async () => {
      const invalidDogeCloud = new DogeCloud(
        'invalid-key',
        'invalid-secret',
        'invalid-bucket'
      )

      await expect(invalidDogeCloud.getTmpToken()).rejects.toMatchObject({
        errno: expect.any(Number),
        msg: expect.stringMatching(/API Error/)
      })

      console.log('✅ Invalid credentials handled correctly')
    }, 10000)

    it('should handle network errors', async () => {
      // 临时修改 API 端点来模拟网络错误
      const originalDogecloudApi = dogeCloud['dogecloudApi']
      dogeCloud['dogecloudApi'] = async () => {
        throw new Error('Network error')
      }

      await expect(dogeCloud.getTmpToken()).rejects.toThrow('Network error')

      // 恢复原始方法
      dogeCloud['dogecloudApi'] = originalDogecloudApi

      console.log('✅ Network error handled correctly')
    }, 10000)
  })

  describe('Performance Tests', () => {
    it('should complete token retrieval within reasonable time', async () => {
      const startTime = Date.now()

      await dogeCloud.getTmpToken()

      const duration = Date.now() - startTime
      expect(duration).toBeLessThan(5000) // Should complete within 5 seconds

      console.log('✅ Token retrieval performance:', duration + 'ms')
    }, 10000)

    it('should handle large file upload', async () => {
      // 创建一个较大的测试文件 (1MB)
      const largeFileName = 'large-test-file.txt'
      const largeFilePath = join(tmpdir(), largeFileName)
      const largeContent = 'x'.repeat(1024 * 1024) // 1MB of 'x' characters

      writeFileSync(largeFilePath, largeContent, 'utf8')

      try {
        const fileStream = createReadStream(largeFilePath)
        const uploadKey = `integration-test/large-${Date.now()}-${largeFileName}`

        const startTime = Date.now()
        const result = await dogeCloud.uploadFile(uploadKey, fileStream)
        const uploadTime = Date.now() - startTime

        expect(result).toBe(uploadKey)
        expect(uploadTime).toBeLessThan(30000) // Should complete within 30 seconds

        console.log('✅ Large file upload performance:', {
          size: '1MB',
          time: uploadTime + 'ms',
          speed: (1024 / (uploadTime / 1000)).toFixed(2) + ' KB/s'
        })
      } finally {
        // 清理大文件
        if (existsSync(largeFilePath)) {
          unlinkSync(largeFilePath)
        }
      }
    }, 45000) // 45 second timeout for large file
  })
})
