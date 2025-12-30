import { expect, test, describe, beforeAll, afterAll } from 'vitest';
import { handlers } from './handlers.js';
import { customHandlers } from './handlers/custom/index.js';
import { setupServer } from 'msw/node';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const server = setupServer(...handlers);

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' });
});

afterAll(() => {
  server.close();
});

test('handlers should be an array', () => {
  expect(Array.isArray(handlers)).toBe(true);
});

test('handlers should be generated from OpenAPI spec', () => {
  expect(handlers.length).toBeGreaterThan(0);
});

test('handlers should include algod endpoints', () => {
  // Verify at least some common endpoints were generated
  expect(handlers.length).toBeGreaterThan(10);
});

test('custom handlers should be included', () => {
  // Custom handlers should be present
  expect(handlers.length).toBeGreaterThanOrEqual(customHandlers.length);
});

test('custom handlers should have priority over OpenAPI handlers', () => {
  // Custom handlers should appear first in the array
  const firstHandlers = handlers.slice(0, customHandlers.length);
  expect(firstHandlers).toEqual(customHandlers);
});

describe('HAR recording handlers', () => {
  test('should return exact response from account.har', async () => {
    // Load and parse the HAR file
    const harPath = join(__dirname, '../recordings/account.har');
    const harContent = readFileSync(harPath, 'utf-8');
    const har = JSON.parse(harContent);

    // Extract the expected response from the HAR entry
    const expectedResponse = JSON.parse(har.log.entries[0].response.content.text);

    // Make the request to mock server
    const accountAddress = 'YF6SYO6WNACUF5YDJ6QDY4HNJPIFDP6GZNBDDLDUXFT3C43EDPHMGZVE5U';
    const response = await fetch(`http://mock/v2/accounts/${accountAddress}`);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');

    const actualResponse = await response.json();

    // Verify the response matches exactly what's in the HAR file
    expect(actualResponse).toEqual(expectedResponse);
  });
});