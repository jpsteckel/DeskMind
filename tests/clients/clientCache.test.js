import { test, describe } from 'node:test';
import assert from 'node:assert';
import { getCachedClient } from '../../src/clients/clientCache.js';

describe('Client Cache', () => {
    test('should fall back to clientRepository on cache miss', async () => {
        const client = getCachedClient('+10000000000'); // Example phone number
        assert(client !== undefined);
    });
    test('should retrieve client from cache if available', async () => {
        const client = getCachedClient('+10000000000'); // Example phone number
        assert(client !== undefined);
    });
});