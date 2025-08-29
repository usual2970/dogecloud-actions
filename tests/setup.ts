// Test setup file
import 'jest';
import * as dotenv from 'dotenv';
import { existsSync } from 'fs';
import { join } from 'path';

// Load environment variables for testing
const envTestPath = join(__dirname, '../.env.test');
if (existsSync(envTestPath)) {
  dotenv.config({ path: envTestPath });
}

// Mock console methods to avoid noise in test output
global.console = {
  ...console
  // Uncomment to ignore console.log output
  // log: jest.fn(),
  // warn: jest.fn(),
  // error: jest.fn(),
};
