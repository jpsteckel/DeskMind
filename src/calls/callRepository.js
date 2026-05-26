import supabase from '../db/supabase.js';
import { getSignedUrl } from '../db/storage.js';

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
 *   - recording_url (optional)
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

  if (error) {
    console.warn(`supabase.updateCall: failed to update call ${callId}`, { updates, error });
    throw new Error(`Failed to update call record: ${error.message}`);
  }

  console.debug(`supabase.updateCall: updated call ${callId}`, { updates, data });
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

/**
 * Retrieves the transcript for a specific call.
 * 
 * @param {string} callId - The UUID of the call.
 * @returns {Promise<string|null>} The transcript text, or null if not available.
 */
export async function getCallTranscript(callId) {
  const call = await getCallById(callId);
  return call ? call.transcript : null;
}

/**
 * Retrieves the summary for a specific call.
 * 
 * @param {string} callId - The UUID of the call.
 * @returns {Promise<string|null>} The summary text, or null if not available.
 */
export async function getCallSummary(callId) {
  const call = await getCallById(callId);
  return call ? call.summary : null;
}

/**
 * Retrieves the recording URL for a specific call.
 * Can optionally generate a signed URL for temporary secure access.
 * 
 * @param {string} callId - The UUID of the call.
 * @param {boolean} signed - Whether to generate a signed URL (default: false)
 * @param {number} expiresIn - Expiry time in seconds for signed URL (default: 3600 = 1 hour)
 * @returns {Promise<object>} Object with publicUrl and optionally signedUrl
 */
export async function getCallRecording(callId, signed = false, expiresIn = 3600) {
  const call = await getCallById(callId);
  
  if (!call || !call.recording_url) {
    return null;
  }

  const result = {
    publicUrl: call.recording_url,
  };

  if (signed) {
    try {
      // Extract the file path from the URL
      // Format: https://bucket-url/storage/v1/object/public/bucket-name/file-path
      // We need to extract just the file path
      const urlObj = new URL(call.recording_url);
      const pathParts = urlObj.pathname.split('/');
      // Find the index where the bucket name is and get everything after
      const publicIndex = pathParts.indexOf('public');
      if (publicIndex !== -1) {
        const filePath = pathParts.slice(publicIndex + 2).join('/');
        result.signedUrl = await getSignedUrl('call-recordings', filePath, expiresIn);
      }
    } catch (err) {
      console.warn(`Failed to generate signed URL for call ${callId}:`, err.message);
    }
  }

  return result;
}

/**
 * Retrieves all transcript data for a client (for search/analytics).
 * Returns call ID, timestamp, and transcript for each call.
 * 
 * @param {string} clientId - The UUID of the client.
 * @param {number} limit - Maximum number of records to return (default: 100).
 * @returns {Promise<Array<object>>} Array of objects with id, created_at, transcript
 */
export async function getClientTranscripts(clientId, limit = 100) {
  const { data, error } = await supabase
    .from('calls')
    .select('id, created_at, transcript, summary')
    .eq('client_id', clientId)
    .not('transcript', 'is', null)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Failed to retrieve transcripts: ${error.message}`);
  return data || [];
}

/**
 * Retrieves summary statistics for a client.
 * 
 * @param {string} clientId - The UUID of the client.
 * @returns {Promise<object>} Statistics including total calls, total duration, etc.
 */
export async function getClientCallStats(clientId) {
  const { data, error } = await supabase
    .rpc('get_client_call_stats', { client_id_param: clientId });

  if (error) {
    console.warn(`Failed to retrieve call stats (RPC may not exist): ${error.message}`);
    // Fallback to manual calculation
    const calls = await getCallsByClientId(clientId, 1000);
    return {
      total_calls: calls.length,
      total_duration_seconds: calls.reduce((sum, call) => sum + (call.duration_seconds || 0), 0),
      average_duration_seconds: calls.length > 0 
        ? Math.round(calls.reduce((sum, call) => sum + (call.duration_seconds || 0), 0) / calls.length)
        : 0,
      calls_with_transcripts: calls.filter(c => c.transcript).length,
      calls_with_recordings: calls.filter(c => c.recording_url).length,
      appointment_booked_count: calls.filter(c => c.is_appointment_booked).length,
    };
  }

  return data;
}

/**
 * Searches call transcripts by keyword.
 * 
 * @param {string} clientId - The UUID of the client.
 * @param {string} keyword - The search term.
 * @param {number} limit - Maximum number of results (default: 20).
 * @returns {Promise<Array<object>>} Array of matching calls with highlights
 */
export async function searchTranscripts(clientId, keyword, limit = 20) {
  const { data, error } = await supabase
    .from('calls')
    .select('id, created_at, transcript, summary')
    .eq('client_id', clientId)
    .ilike('transcript', `%${keyword}%`)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Failed to search transcripts: ${error.message}`);
  return data || [];
}

/**
 * Deletes a call record and its associated data.
 * Note: This does not delete files from Supabase Storage.
 * 
 * @param {string} callId - The UUID of the call to delete.
 * @returns {Promise<void>}
 */
export async function deleteCall(callId) {
  const { error } = await supabase
    .from('calls')
    .delete()
    .eq('id', callId);

  if (error) throw new Error(`Failed to delete call: ${error.message}`);
}
