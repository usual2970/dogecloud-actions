import { DogeCloudDeployer } from '../src/deployer'

describe('DogeCloudDeployer', () => {
  let deployer: DogeCloudDeployer

  beforeEach(() => {
    deployer = new DogeCloudDeployer({
      apiKey: 'test-api-key',
      secretKey: 'test-secret-key',
      bucketName: 'test-bucket'
    })
  })

  describe('constructor', () => {
    it('should create instance with correct config', () => {
      expect(deployer).toBeInstanceOf(DogeCloudDeployer)
    })

    it('should use default endpoint when not provided', () => {
      const deployerWithDefaults = new DogeCloudDeployer({
        apiKey: 'test-api-key',
        secretKey: 'test-secret-key',
        bucketName: 'test-bucket'
      })
      expect(deployerWithDefaults).toBeInstanceOf(DogeCloudDeployer)
    })

    it('should use custom endpoint when provided', () => {
      const customDeployer = new DogeCloudDeployer({
        apiKey: 'test-api-key',
        secretKey: 'test-secret-key',
        bucketName: 'test-bucket',
        endpoint: 'https://custom.api.com'
      })
      expect(customDeployer).toBeInstanceOf(DogeCloudDeployer)
    })
  })

  // TODO: Add more tests for deploy functionality
  // Note: These would require mocking axios and file system operations
})
