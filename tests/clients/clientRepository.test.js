import { test, describe } from 'node:test';
import assert from 'node:assert';
import { getAllClients, getClientByID } from '../../src/clients/clientRepository.js';

describe('Client Repository', () => {
  test('fetches all clients from the database', async () => {
    const clients = await getAllClients();
    console.log('Fetched clients:', clients);

    assert(Array.isArray(clients));
    assert(clients.length >= 0);
  });

  test('fetches a client by id from the database', async () => {
    const testClientId = "9fef2486-0db7-4c1b-878f-f5b30d822ace";
    const client = await getClientByID(testClientId);

    assert(client !== undefined);
    assert(client.id === testClientId);
  });
});
