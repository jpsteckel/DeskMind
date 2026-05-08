import redis from '../db/redis.js';
import { getClientByPhoneNumber } from './clientRepository.js';

const CACHE_TTL_SECONDS = 300; // 5 minutes

/**
 * Builds the Redis key for a given phone number.
 *
 * @param {string} phoneNumber - E.164 formatted number.
 * @returns {string} Redis key.
 */
const cacheKey = (phoneNumber) => `client:${phoneNumber}`;

/**
 * Retrieves a client config, checking Redis first before falling back to Supabase.
 * On a cache miss, the result is stored in Redis for future calls.
 *
 * @param {string} phoneNumber - E.164 formatted number to look up.
 * @returns {Promise<object|null>} Client record, or null if not found.
 */
export async function getCachedClient(phoneNumber) {
  try {
    // Attempt Redis cache hit first (~1–2ms vs ~10–30ms for Supabase)
    const cached = await redis.get(cacheKey(phoneNumber));
    if (cached) return cached; // Upstash auto-parses JSON
  } catch (err) {
    // If Redis is unavailable, fall through to Supabase rather than failing the call
    console.warn('Redis unavailable, falling back to Supabase:', err.message);
  }

  // Cache miss — query Supabase
  const client = await getClientByPhoneNumber(phoneNumber);

  if (client) {
    try {
      // Store in Redis for subsequent calls within the TTL window
      await redis.set(cacheKey(phoneNumber), client, { ex: CACHE_TTL_SECONDS });
    } catch (err) {
      console.warn('Failed to write to Redis cache:', err.message);
    }
  }

  return client;
}

/**
 * Invalidates the Redis cache entry for a client.
 * Call this whenever a client record is updated in Supabase so the
 * next inbound call gets fresh data.
 *
 * @param {string} phoneNumber - E.164 formatted number whose cache to clear.
 */
export async function invalidateClientCache(phoneNumber) {
  try {
    await redis.del(cacheKey(phoneNumber));
  } catch (err) {
    console.warn('Failed to invalidate Redis cache:', err.message);
  }
}