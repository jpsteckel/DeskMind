import { getCallMetadata } from '../calls/callCache.js';
import { getCallByConversationId } from '../calls/callRepository.js';
import { updateCallWithConversationDetails } from '../telnyx/conversationService.js';
import redis from '../db/redis.js';

/**
 * Handles the `call.analyzed` webhook event from Telnyx.
 *
 * This event fires after the assistant finishes analyzing the call and
 * the conversation is ready in Telnyx's system (transcript, summary, etc.).
 * We use this as a trigger to immediately fetch and persist conversation
 * details to the database.
 *
 * @param {object} payload - The webhook payload.
 * @returns {Promise<void>}
 */
export async function handleCallAnalyzed(payload) {
  const callControlId = payload.call_control_id;
  const conversationId = payload.conversation_id;
  const callSessionId = payload.call_session_id;
  const callLegId = payload.call_leg_id;
  const assistantId = payload.assistant_id;
  const eventType = 'call.analyzed';

  if (!callControlId) {
    console.warn(`${eventType}: missing call_control_id`, { payload });
    return;
  }

  if (!conversationId) {
    console.warn(`${eventType}: missing conversation_id`, { callControlId, callSessionId, callLegId, assistantId });
    return;
  }

  const callMetadata = await getCallMetadata(callControlId);
  const diagnostics = {
    callControlId,
    callSessionId,
    callLegId,
    assistantId,
    conversationId,
    from: payload.from,
    to: payload.to,
    duration_sec: payload.duration_sec,
    recordingCount: Array.isArray(payload.recordings) ? payload.recordings.length : 0,
    metadataKey: `call:${callControlId}`,
  };

  if (!callMetadata) {
    try {
      diagnostics.metadataTtl = await redis.ttl(diagnostics.metadataKey);
      diagnostics.metadataExists = await redis.exists(diagnostics.metadataKey);
    } catch (err) {
      diagnostics.redisDiagnosticsError = err?.message || err;
    }

    try {
      const callRecord = await getCallByConversationId(conversationId);
      diagnostics.callRecordFoundByConversationId = Boolean(callRecord);
      diagnostics.callRecordByConversationId = callRecord || undefined;
    } catch (err) {
      diagnostics.callRecordLookupError = err?.message || err;
    }

    console.warn(`${eventType}: no call metadata found for call_control_id=${callControlId}.`, diagnostics);
    return;
  }

  const callId = callMetadata.call_id;
  const clientId = callMetadata.client_id;

  if (!callId) {
    console.warn(`${eventType}: call metadata found but missing call_id.`, {
      callControlId,
      callSessionId,
      callLegId,
      assistantId,
      conversationId,
      metadata: callMetadata,
    });
    return;
  }

  console.debug(`${eventType}: immediately backfilling conversation ${conversationId} into call ${callId}`, {
    callControlId,
    conversationId,
    callId,
    clientId,
  });

  try {
    const updated = await updateCallWithConversationDetails(callId, conversationId);
    if (updated) {
      console.log(`${eventType}: successfully updated call ${callId} with conversation data`, {
        callControlId,
        conversationId,
        callId,
      });
    } else {
      console.warn(`${eventType}: update returned no data for call ${callId}`, {
        callControlId,
        conversationId,
        callId,
      });
    }
  } catch (err) {
    console.warn(`${eventType}: failed to update call ${callId}:`, {
      callControlId,
      conversationId,
      callId,
      error: err?.message || err,
    });
  }
}
