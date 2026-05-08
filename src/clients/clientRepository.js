import supabase from '../db/supabase.js';

/**
 * Fetches a single client record from Supabase by their Telnyx phone number.
 *
 * @param {string} phoneNumber - E.164 formatted number, e.g. "+13025550101".
 *   This must match the `phone_number` column exactly.
 * @returns {Promise<object|null>} The client row, or null if not found.
 */
export async function getClientByPhoneNumber(phoneNumber) {
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('phone_number', phoneNumber)
    .single();

  if (error) {
    // PGRST116 = no rows found — not a real error, just means no client matched
    if (error.code === 'PGRST116') return null;
    throw new Error(`Supabase lookup failed: ${error.message}`);
  }

  return data;
}

/**
 * Inserts a new client record into Supabase.
 *
 * @param {object} clientData - Object matching the clients table schema.
 * @returns {Promise<object>} The inserted row.
 */
export async function createClient(clientData) {
  const { data, error } = await supabase
    .from('clients')
    .insert(clientData)
    .select()
    .single();

  if (error) throw new Error(`Failed to create client: ${error.message}`);
  return data;
}

/**
 * Updates fields on an existing client record.
 * Only the fields provided in `updates` are changed.
 *
 * @param {string} phoneNumber - The client's Telnyx number (lookup key).
 * @param {object} updates - Partial client object with fields to update.
 * @returns {Promise<object>} The updated row.
 */
export async function updateClient(phoneNumber, updates) {
  const { data, error } = await supabase
    .from('clients')
    .update(updates)
    .eq('phone_number', phoneNumber)
    .select()
    .single();

  if (error) throw new Error(`Failed to update client: ${error.message}`);
  return data;
}