/**
 * Jest Test Setup
 *
 * Initializes global test environment and mocks.
 */

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.SKIP_LAUNCH = 'true';

// Initialize globals that would normally be set by the server
global.browserLength = 0;
global.browserLimit = 20;
global.timeOut = 60000;
global.browser = null;
global.browserWarmedUp = false;

// Increase timeout for integration tests
jest.setTimeout(120000);

// Force Jest to exit after tests complete (handles lingering timers)
afterAll(() => {
  // Allow any pending promises to settle
  return new Promise(resolve => setTimeout(resolve, 100));
});
