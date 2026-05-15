import redis from '../db/redis.js';

// TTL for call mappings - calls typically complete within 30 minutes
const CALL_MAPPING_TTL_SECONDS = 1800; // 30 minutes

/**
 * Builds the Redis key for storing call metadata by call_control_id.
 * 
 * @param {string} callControlId - The Telnyx call_control_id.
 * @returns {string} Redis key.
 */
const callMetadataKey = (callControlId) => `call:${callControlId}`;

/**
 * Stores the call metadata (client_id, caller_phone, etc.) in Redis.
 * Called when a call is initiated so we can look it up when the call ends.
 * 
 * @param {string} callControlId - The Telnyx call_control_id.
 * @param {object} metadata - Object containing:
 *   - client_id (required)
 *   - caller_phone (required)
 *   - caller_name (optional)
 * @returns {Promise<void>}
 */
export async function storeCallMetadata(callControlId, metadata) {
  try {
    await redis.set(callMetadataKey(callControlId), metadata, { 
      ex: CALL_MAPPING_TTL_SECONDS 
    });
  } catch (err) {
    console.warn(`Failed to store call metadata in Redis: ${err.message}`);
    // Don't fail the call if Redis is unavailable — we'll just lose some metadata
  }
}

/**
 * Retrieves the call metadata from Redis by call_control_id.
 * 
 * @param {string} callControlId - The Telnyx call_control_id.
 * @returns {Promise<object|null>} The stored metadata, or null if not found or expired.
 */
export async function getCallMetadata(callControlId) {
  try {
    const metadata = await redis.get(callMetadataKey(callControlId));
    return metadata || null;
  } catch (err) {
    console.warn(`Failed to retrieve call metadata from Redis: ${err.message}`);
    return null;
  }
}

/**
 * Removes call metadata from Redis after a call ends.
 * Helps keep Redis clean and reduces storage usage.
 * 
 * @param {string} callControlId - The Telnyx call_control_id.
 * @returns {Promise<void>}
 */
export async function deleteCallMetadata(callControlId) {
  try {
    await redis.del(callMetadataKey(callControlId));
  } catch (err) {
    console.warn(`Failed to delete call metadata from Redis: ${err.message}`);
  }
}
