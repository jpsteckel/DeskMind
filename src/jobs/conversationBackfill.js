import redis from '../db/redis.js';
import { getCallsNeedingBackfill } from '../calls/callRepository.js';
import { updateCallWithConversationDetails } from '../telnyx/conversationService.js';

const INTERVAL_MS = Number(process.env.CONVERSATION_BACKFILL_INTERVAL_MS) || 60_000; // 1 minute
const MAX_ATTEMPTS = Number(process.env.CONVERSATION_BACKFILL_MAX_ATTEMPTS) || 6;
const MIN_AGE_SECONDS = Number(process.env.CONVERSATION_BACKFILL_MIN_AGE_SECONDS) || 10;

const attemptKey = (callId) => `backfill_attempts:${callId}`;

export function startConversationBackfillJob() {
  console.log(`Starting conversation backfill job (interval=${INTERVAL_MS}ms)`);

  setInterval(async () => {
    try {
      const calls = await getCallsNeedingBackfill(MIN_AGE_SECONDS, 100);
      if (!calls || calls.length === 0) return;

      for (const call of calls) {
        const key = attemptKey(call.id);
        let attempts = 0;
        try {
          const raw = await redis.get(key);
          attempts = raw ? Number(raw) : 0;
        } catch (err) {
          console.warn('Failed to read backfill attempts from Redis:', err?.message || err);
        }

        if (attempts >= MAX_ATTEMPTS) {
          console.warn(`Skipping backfill for call ${call.id} after ${attempts} attempts`);
          continue;
        }

        console.debug(`Backfill job: attempting call ${call.id} (attempt ${attempts + 1})`);
        try {
          const updated = await updateCallWithConversationDetails(call.id, call.conversation_id);
          if (updated) {
            console.log(`Backfill job: updated call ${call.id} successfully`);
            try { await redis.del(key); } catch (e) {}
            continue;
          }
        } catch (err) {
          console.warn(`Backfill job: update failed for call ${call.id}:`, err?.message || err);
        }

        // If we reach here, the attempt did not produce updates — increment attempt counter
        try {
          attempts += 1;
          // Set a TTL so attempts counter expires over time (e.g., 24 hours)
          await redis.set(key, String(attempts), { ex: 24 * 60 * 60 });
        } catch (err) {
          console.warn('Failed to persist backfill attempt counter in Redis:', err?.message || err);
        }
      }
    } catch (err) {
      console.warn('Conversation backfill job errored:', err?.message || err);
    }
  }, INTERVAL_MS);
}

export default startConversationBackfillJob;
