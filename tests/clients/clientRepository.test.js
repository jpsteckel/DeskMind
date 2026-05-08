import { test, describe } from 'node:test';
import assert from 'node:assert';
import { getAllClients, getClientByID, getClientByPhoneNumber, createClient, updateClient } from '../../src/clients/clientRepository.js';

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

  test('feches a client by phone number from the database', async () => {
    const testPhoneNumber = "+14845065950";
    const client = await getClientByPhoneNumber(testPhoneNumber);

    assert(client !== undefined);
    assert(client.phone_number === testPhoneNumber);
  });

  test('create default client', async () => {
    const defaultClient = {
        business_name: "Default Client",
        phone_number: "+10000000000",
    };
    const createdClient = await createClient(defaultClient);

    assert(createdClient !== undefined);
    assert(createdClient.business_name === defaultClient.business_name);
    assert(createdClient.phone_number === defaultClient.phone_number);
  });

  test('update client', async () => {
    const testPhoneNumber = "+10000000000";
    const updatedBusinessName = "Updated Client Name";

    const updatedClient = await updateClient(testPhoneNumber, { business_name: updatedBusinessName });

    assert(updatedClient !== undefined);
    assert(updatedClient.business_name === updatedBusinessName);
  });
});
