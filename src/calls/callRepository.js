import supabase from '../db/supabase.js';

/**
 * Inserts a new call record into Supabase with all available call information.
 * 
 * @param {object} callData - Object matching the calls table schema:
 *   - client_id (required)
 *   - caller_phone (required)
 *   - caller_name (optional)
 *   - transcript (optional)
 *   - summary (optional)
 *   - call_type (optional)
 *   - is_appointment_booked (optional, defaults to false)
 *   - duration_seconds (optional, defaults to 0)
 * @returns {Promise<object>} The inserted call record.
 */
export async function createCall(callData) {
  const { data, error } = await supabase
    .from('calls')
    .insert(callData)
    .select()
    .single();

  if (error) throw new Error(`Failed to create call record: ${error.message}`);
  return data;
}

/**
 * Updates an existing call record with additional information.
 * Useful for populating fields like transcript, summary, call_type after the call ends.
 * 
 * @param {string} callId - The UUID of the call record to update.
 * @param {object} updates - Partial call object with fields to update.
 * @returns {Promise<object>} The updated call record.
 */
export async function updateCall(callId, updates) {
  const { data, error } = await supabase
    .from('calls')
    .update(updates)
    .eq('id', callId)
    .select()
    .single();

  if (error) throw new Error(`Failed to update call record: ${error.message}`);
  return data;
}

/**
 * Retrieves a single call record by ID.
 * 
 * @param {string} callId - The UUID of the call.
 * @returns {Promise<object|null>} The call record, or null if not found.
 */
export async function getCallById(callId) {
  const { data, error } = await supabase
    .from('calls')
    .select('*')
    .eq('id', callId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // No rows found
    throw new Error(`Failed to retrieve call: ${error.message}`);
  }

  return data;
}

/**
 * Retrieves all call records for a given client.
 * 
 * @param {string} clientId - The UUID of the client.
 * @param {number} limit - Maximum number of records to return (default: 50).
 * @returns {Promise<Array<object>>} Array of call records.
 */
export async function getCallsByClientId(clientId, limit = 50) {
  const { data, error } = await supabase
    .from('calls')
    .select('*')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Failed to retrieve calls for client: ${error.message}`);
  return data;
}
