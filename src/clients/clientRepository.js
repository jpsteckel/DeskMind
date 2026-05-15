import supabase from '../db/supabase.js';

function normalizeClient(client) {
  if (!client) return null;

  const normalized = { ...client };

  // Compatibility helpers for legacy field names.
  if (normalized.phone && !normalized.phone_number) normalized.phone_number = normalized.phone;
  if (normalized.phone_number && !normalized.phone) normalized.phone = normalized.phone_number;

  normalized.full_address = formatFullAddress(normalized);
  normalized.address = normalized.full_address || normalized.address || '';

  normalized.services_offered = normalized.services_offered || formatServiceTypes(normalized.service_types);
  normalized.hours_of_operation = normalized.hours_of_operation || formatHours(normalized.hours);

  return normalized;
}

function formatFullAddress(client) {
  const parts = [client.address, client.city, client.state, client.zip]
    .filter((part) => typeof part === 'string' && part.trim().length > 0)
    .map((part) => part.trim());

  return parts.length > 0 ? parts.join(', ') : null;
}

function formatServiceTypes(serviceTypes) {
  if (!serviceTypes) return '';
  if (Array.isArray(serviceTypes)) return serviceTypes.join(', ');
  if (typeof serviceTypes === 'object') {
    return Object.entries(serviceTypes)
      .map(([key, value]) => {
        if (Array.isArray(value)) return `${key}: ${value.join(', ')}`;
        return `${key}: ${value}`;
      })
      .join('; ');
  }
  return String(serviceTypes);
}

function formatHours(hours) {
  if (!hours) return '';
  if (typeof hours === 'string') return hours;
  if (Array.isArray(hours)) return hours.join(', ');
  if (typeof hours === 'object') {
    return Object.entries(hours)
      .map(([day, value]) => `${day}: ${value}`)
      .join('; ');
  }
  return String(hours);
}

/**
 * Fetches a single client record from Supabase by their Telnyx phone number.
 *
 * @param {string} phoneNumber - E.164 formatted number, e.g. "+13025550101".
 *   This must match the `phone` column exactly.
 * @returns {Promise<object|null>} The client row, or null if not found.
 */
export async function getClientByPhoneNumber(phoneNumber) {
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('phone', phoneNumber)
    .single();

  if (error) {
    // PGRST116 = no rows found — not a real error, just means no client matched
    if (error.code === 'PGRST116') return null;
    throw new Error(`Supabase lookup failed: ${error.message}`);
  }

  return normalizeClient(data);
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
  return normalizeClient(data);
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
    .eq('phone', phoneNumber)
    .select()
    .single();

  if (error) throw new Error(`Failed to update client: ${error.message}`);
  return normalizeClient(data);
}

/**
 * Fetches all client records from Supabase.
 *
 * @returns {Promise<Array<object>>} Array of client rows.
 */
export async function getAllClients() {
  const { data, error } = await supabase
    .from('clients')
    .select('*');

  if (error) throw new Error(`Failed to fetch clients: ${error.message}`);
  return Array.isArray(data) ? data.map(normalizeClient) : data;
}

/**
 * Fetches a single client record from Supabase by their ID.
 *
 * @param {string|number} id - The client's unique ID.
 * @returns {Promise<object|null>} The client row, or null if not found.
 */
export async function getClientByID(id) {
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(`Supabase lookup failed: ${error.message}`);
  }

  return normalizeClient(data);
}