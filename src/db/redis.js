import { Redis } from '@upstash/redis';

/**
 * Singleton Upstash Redis client.
 * Upstash uses an HTTP-based API so no persistent TCP connection is needed —
 * works well in serverless and always-on environments alike.
 *
 * If you are not using Redis, you can delete this file and remove
 * the cache layer from clientCache.js.
 */
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

export default redis;