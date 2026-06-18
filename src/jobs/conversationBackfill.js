import redis from '../db/redis.js';
import { getCallsNeedingBackfill, updateCall } from '../calls/callRepository.js';
import { updateCallWithConversationDetails } from '../telnyx/conversationService.js';
import { processTranscript } from '../telnyx/callProcessingService.js';

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
          const updated = await backfillCallData(call);
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

async function backfillCallData(call) {
  if (typeof call.transcript === 'string' && call.transcript.trim().length > 0) {
    const processed = await processTranscript(call.transcript);
    const updates = {};

    if (processed.summary !== undefined) updates.summary = processed.summary;
    if (processed.clientName !== undefined) updates.caller_name = processed.clientName;
    if (processed.clientEmail !== undefined) updates.caller_email = processed.clientEmail;
    if (processed.companyName !== undefined) updates.business_name = processed.companyName;
    if (processed.callType !== undefined) updates.call_type = processed.callType;
    if (processed.isAppointmentBooked !== undefined) updates.is_appointment_booked = processed.isAppointmentBooked;
    if (processed.appointmentDate !== undefined) updates.appointment_date = processed.appointmentDate;
    if (processed.appointmentTime !== undefined) updates.appointment_time = processed.appointmentTime;
    if (processed.serviceBooked !== undefined) updates.service_booked = processed.serviceBooked;
    if (processed.sentiment !== undefined) updates.sentiment = processed.sentiment;
    if (processed.urgency !== undefined) updates.urgency = processed.urgency;
    if (processed.followUpRequired !== undefined) updates.follow_up_required = processed.followUpRequired;
    if (processed.resolutionStatus !== undefined) updates.resolution_status = processed.resolutionStatus;
    if (processed.resolution !== undefined) updates.resolution = processed.resolution;
    if (processed.tags !== undefined) updates.tags = processed.tags;
    if (processed.keyIssues !== undefined) updates.key_issues = processed.keyIssues;
    if (processed.followUpActions !== undefined) updates.follow_up_tasks = processed.followUpActions;

    if (Object.keys(updates).length > 0) {
      return updateCall(call.id, updates);
    }
    return null;
  }

  if (call.conversation_id) {
    return updateCallWithConversationDetails(call.id, call.conversation_id);
  }

  return null;
}

export default startConversationBackfillJob;
