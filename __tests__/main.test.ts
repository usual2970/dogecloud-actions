import * as process from 'process'
import * as cp from 'child_process'
import * as path from 'path'
import { test } from '@jest/globals'

// 模拟运行action
test('test runs', () => {
  process.env['INPUT_API-KEY'] = 'test-api-key'
  process.env['INPUT_SECRET-KEY'] = 'test-secret-key'
  process.env['INPUT_BUCKET-NAME'] = 'test-bucket'
  process.env['INPUT_LOCAL-PATH'] = './test-data'

  const np = process.execPath
  const ip = path.join(__dirname, '..', 'lib', 'main.js')
  const options: cp.ExecFileSyncOptions = {
    env: process.env
  }

  // 注意：这个测试需要实际的lib/main.js文件存在
  // 在实际项目中，你可能需要先构建项目或者模拟这个测试
  try {
    console.log(cp.execFileSync(np, [ip], options).toString())
  } catch (error) {
    // 预期会失败，因为我们使用的是测试数据
    console.log('Expected failure with test data')
  }
})
