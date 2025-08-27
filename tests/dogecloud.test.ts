import { DogeCloud } from '../src/dogecloud'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import axios from 'axios'
import { Readable } from 'stream'

// Mock dependencies
jest.mock('@aws-sdk/client-s3')
jest.mock('axios')

const mockAxios = axios as jest.Mocked<typeof axios>
const mockS3Client = S3Client as jest.MockedClass<typeof S3Client>
const mockPutObjectCommand = PutObjectCommand as jest.MockedClass<
  typeof PutObjectCommand
>

describe('DogeCloud', () => {
  let dogeCloud: DogeCloud
  const mockAccessKey = 'test-access-key'
  const mockSecretKey = 'test-secret-key'

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks()
    dogeCloud = new DogeCloud(mockAccessKey, mockSecretKey)
  })

  describe('constructor', () => {
    it('should create an instance with access and secret keys', () => {
      expect(dogeCloud).toBeInstanceOf(DogeCloud)
      expect(dogeCloud['accessKey']).toBe(mockAccessKey)
      expect(dogeCloud['secretKey']).toBe(mockSecretKey)
    })
  })

  describe('getTmpToken', () => {
    const mockTokenResponse = {
      Credentials: {
        accessKeyId: 'mock-access-key-id',
        secretAccessKey: 'mock-secret-access-key',
        sessionToken: 'mock-session-token'
      },
      ExpiredAt: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
      Buckets: [
        {
          name: 'test-bucket',
          s3Bucket: 'test-s3-bucket',
          s3Endpoint: 'https://test-endpoint.com'
        }
      ]
    }

    beforeEach(() => {
      mockAxios.request.mockResolvedValue({
        data: {
          code: 200,
          msg: 'success',
          data: mockTokenResponse
        }
      })
    })

    it('should successfully get temporary token', async () => {
      const token = await dogeCloud.getTmpToken()

      expect(token).toEqual(mockTokenResponse)
      expect(mockAxios.request).toHaveBeenCalledWith({
        url: 'https://api.dogecloud.com/auth/tmp_token.json',
        method: 'POST',
        data: JSON.stringify({
          channel: 'OSS_FULL',
          scopes: ['*']
        }),
        responseType: 'json',
        headers: {
          'Content-Type': 'application/json',
          Authorization: expect.stringMatching(/^TOKEN test-access-key:/)
        }
      })
    })

    it('should cache token and not make additional requests when token is valid', async () => {
      // First call
      const token1 = await dogeCloud.getTmpToken()
      expect(mockAxios.request).toHaveBeenCalledTimes(1)

      // Second call should use cached token
      const token2 = await dogeCloud.getTmpToken()
      expect(mockAxios.request).toHaveBeenCalledTimes(1)
      expect(token1).toEqual(token2)
    })

    it('should refresh token when expired', async () => {
      // Mock a token that expires soon (within 300 seconds)
      const expiredTokenResponse = {
        ...mockTokenResponse,
        ExpiredAt: Math.floor(Date.now() / 1000) + 200 // 200 seconds from now
      }

      mockAxios.request
        .mockResolvedValueOnce({
          data: {
            code: 200,
            msg: 'success',
            data: expiredTokenResponse
          }
        })
        .mockResolvedValueOnce({
          data: {
            code: 200,
            msg: 'success',
            data: mockTokenResponse
          }
        })

      // First call with soon-to-expire token
      await dogeCloud.getTmpToken()
      expect(mockAxios.request).toHaveBeenCalledTimes(1)

      // Second call should refresh the token
      const newToken = await dogeCloud.getTmpToken()
      expect(mockAxios.request).toHaveBeenCalledTimes(2)
      expect(newToken).toEqual(mockTokenResponse)
    })

    it('should throw error when API returns error code', async () => {
      mockAxios.request.mockResolvedValue({
        data: {
          code: 400,
          msg: 'Invalid credentials',
          data: null
        }
      })

      await expect(dogeCloud.getTmpToken()).rejects.toEqual({
        errno: 400,
        msg: 'API Error: Invalid credentials'
      })
    })
  })

  describe('initS3Client', () => {
    const mockTokenResponse = {
      Credentials: {
        accessKeyId: 'mock-access-key-id',
        secretAccessKey: 'mock-secret-access-key',
        sessionToken: 'mock-session-token'
      },
      ExpiredAt: Math.floor(Date.now() / 1000) + 3600,
      Buckets: [
        {
          name: 'test-bucket',
          s3Bucket: 'test-s3-bucket',
          s3Endpoint: 'https://test-endpoint.com'
        }
      ]
    }

    beforeEach(() => {
      mockAxios.request.mockResolvedValue({
        data: {
          code: 200,
          msg: 'success',
          data: mockTokenResponse
        }
      })
    })

    it('should initialize S3 client with correct configuration', async () => {
      const s3Client = await dogeCloud.initS3Client()

      expect(S3Client).toHaveBeenCalledWith({
        endpoint: 'https://test-endpoint.com',
        credentials: {
          accessKeyId: 'mock-access-key-id',
          secretAccessKey: 'mock-secret-access-key',
          sessionToken: 'mock-session-token'
        }
      })
      expect(s3Client).toBeInstanceOf(S3Client)
    })

    it('should reuse existing S3 client', async () => {
      // First call
      const s3Client1 = await dogeCloud.initS3Client()

      // Second call should return the same instance
      const s3Client2 = await dogeCloud.initS3Client()

      expect(s3Client1).toBe(s3Client2)
      expect(S3Client).toHaveBeenCalledTimes(1)
    })
  })

  describe('uploadFile', () => {
    const mockTokenResponse = {
      Credentials: {
        accessKeyId: 'mock-access-key-id',
        secretAccessKey: 'mock-secret-access-key',
        sessionToken: 'mock-session-token'
      },
      ExpiredAt: Math.floor(Date.now() / 1000) + 3600,
      Buckets: [
        {
          name: 'test-bucket',
          s3Bucket: 'test-s3-bucket',
          s3Endpoint: 'https://test-endpoint.com'
        }
      ]
    }

    beforeEach(() => {
      mockAxios.request.mockResolvedValue({
        data: {
          code: 200,
          msg: 'success',
          data: mockTokenResponse
        }
      })

      // Mock S3Client send method
      const mockSend = jest.fn().mockResolvedValue({})
      mockS3Client.prototype.send = mockSend
    })

    it('should upload file successfully', async () => {
      const mockFileStream = new Readable({
        read() {
          this.push('test file content')
          this.push(null)
        }
      }) as any

      const key = 'test/file.txt'
      const result = await dogeCloud.uploadFile(key, mockFileStream)

      expect(result).toBe(key)
      expect(PutObjectCommand).toHaveBeenCalledWith({
        Bucket: 'test-s3-bucket',
        Key: key,
        Body: mockFileStream
      })
      expect(mockS3Client.prototype.send).toHaveBeenCalledWith(
        expect.any(PutObjectCommand)
      )
    })

    it('should handle S3 upload errors', async () => {
      const mockFileStream = new Readable({
        read() {
          this.push('test file content')
          this.push(null)
        }
      }) as any

      const mockError = new Error('S3 upload failed')
      mockS3Client.prototype.send = jest.fn().mockRejectedValue(mockError)

      await expect(
        dogeCloud.uploadFile('test/file.txt', mockFileStream)
      ).rejects.toThrow('S3 upload failed')
    })
  })

  describe('dogecloudApi', () => {
    it('should make API request with form data', async () => {
      const mockResponse = { test: 'data' }
      mockAxios.request.mockResolvedValue({
        data: {
          code: 200,
          msg: 'success',
          data: mockResponse
        }
      })

      const result = await dogeCloud['dogecloudApi']('/test/endpoint', {
        param1: 'value1',
        param2: 'value2'
      })

      expect(result).toEqual(mockResponse)
      expect(mockAxios.request).toHaveBeenCalledWith({
        url: 'https://api.dogecloud.com/test/endpoint',
        method: 'POST',
        data: 'param1=value1&param2=value2',
        responseType: 'json',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: expect.stringMatching(/^TOKEN test-access-key:/)
        }
      })
    })

    it('should make API request with JSON data', async () => {
      const mockResponse = { test: 'data' }
      mockAxios.request.mockResolvedValue({
        data: {
          code: 200,
          msg: 'success',
          data: mockResponse
        }
      })

      const requestData = { param1: 'value1', param2: 'value2' }
      const result = await dogeCloud['dogecloudApi'](
        '/test/endpoint',
        requestData,
        true
      )

      expect(result).toEqual(mockResponse)
      expect(mockAxios.request).toHaveBeenCalledWith({
        url: 'https://api.dogecloud.com/test/endpoint',
        method: 'POST',
        data: JSON.stringify(requestData),
        responseType: 'json',
        headers: {
          'Content-Type': 'application/json',
          Authorization: expect.stringMatching(/^TOKEN test-access-key:/)
        }
      })
    })

    it('should generate correct HMAC signature', async () => {
      mockAxios.request.mockResolvedValue({
        data: {
          code: 200,
          msg: 'success',
          data: {}
        }
      })

      await dogeCloud['dogecloudApi']('/test/endpoint', { test: 'data' })

      const authHeader =
        mockAxios.request.mock.calls[0][0].headers?.Authorization
      expect(authHeader).toMatch(/^TOKEN test-access-key:[a-f0-9]{40}$/)
    })

    it('should throw error for non-200 response codes', async () => {
      mockAxios.request.mockResolvedValue({
        data: {
          code: 401,
          msg: 'Unauthorized',
          data: null
        }
      })

      await expect(dogeCloud['dogecloudApi']('/test/endpoint')).rejects.toEqual(
        {
          errno: 401,
          msg: 'API Error: Unauthorized'
        }
      )
    })
  })

  describe('deleteFile', () => {
    it('should exist as a method', () => {
      expect(typeof dogeCloud.deleteFile).toBe('function')
    })

    // TODO: Implement deleteFile method and add tests
  })
})
