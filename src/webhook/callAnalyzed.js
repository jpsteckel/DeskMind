import { getCallMetadata } from '../calls/callCache.js';
import { updateCallWithConversationDetails } from '../telnyx/conversationService.js';

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

  if (!callControlId) {
    console.warn('call.analyzed webhook received without call_control_id.');
    return;
  }

  if (!conversationId) {
    console.warn(`call.analyzed webhook for call_control_id=${callControlId} has no conversation_id.`);
    return;
  }

  const callMetadata = await getCallMetadata(callControlId);
  if (!callMetadata) {
    console.warn(
      `call.analyzed: no call metadata found for call_control_id=${callControlId}. ` +
      `Call record may not exist yet; backfill job will retry.`
    );
    return;
  }

  const callId = callMetadata.call_id;
  if (!callId) {
    console.warn(
      `call.analyzed: call metadata for ${callControlId} has no call_id. ` +
      `Call record may not exist yet; backfill job will retry.`
    );
    return;
  }

  console.debug(`call.analyzed: immediately backfilling conversation ${conversationId} into call ${callId}`);
  try {
    const updated = await updateCallWithConversationDetails(callId, conversationId);
    if (updated) {
      console.log(`call.analyzed: successfully updated call ${callId} with conversation data`);
    } else {
      console.warn(`call.analyzed: update returned no data for call ${callId}`);
    }
  } catch (err) {
    console.warn(`call.analyzed: failed to update call ${callId}:`, err?.message || err);
  }
}
