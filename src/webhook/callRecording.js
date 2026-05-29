import { getCallMetadata, updateCallMetadata, deleteCallMetadata } from '../calls/callCache.js';
import { fetchAndUploadRecording } from '../telnyx/recordingService.js';
import { updateCallWithConversationDetails } from '../telnyx/conversationService.js';
import { getCallById } from '../calls/callRepository.js';
import { getTranscript } from '../telnyx/analyzeCall.js';
/**
 * Handles recording-related webhook events from Telnyx.
 *
 * This is used when the recording is finalized after the call ends.
 * It updates the existing call record with the uploaded recording URL.
 *
 * @param {object} payload - The webhook payload for the recording event.
 * @returns {Promise<void>}
 */
export async function handleCallRecording(payload) {
  const recordingPayload = payload.recording || payload;
  const callControlId = payload.call_control_id || payload.call?.call_control_id || recordingPayload.call_control_id;
  const recordingId = payload.recording_id || recordingPayload.id || recordingPayload.recording_id || payload.id;

  if (!callControlId) {
    console.warn('Recording webhook received without call_control_id. Unable to associate recording.');
    return;
  }

  if (!recordingId) {
    console.warn(`Recording webhook received for call ${callControlId} but no recording ID was available.`);
    return;
  }

  const callMetadata = await getCallMetadata(callControlId);
  if (!callMetadata) {
    console.warn(`No call metadata found for call_control_id=${callControlId}. Can't attach recording yet.`);
    return;
  }

  const updatedMetadata = await updateCallMetadata(callControlId, { recording_id: recordingId });
  const callId = updatedMetadata?.call_id || callMetadata.call_id;
  if (!callId) {
    console.log(`Recording ID ${recordingId} stored for call ${callControlId}, waiting for call record to be created.`);
    return;
  }

  const callRecord = await getCallById(callId);
  if (!callRecord) {
    console.warn(`Call record ${callId} not found for recording ${recordingId}.`);
    return;
  }

  if ((!callRecord.transcript || !callRecord.summary) && callMetadata.conversation_id) {
    console.debug(`Attempting to backfill conversation details for call ${callId} (conversation=${callMetadata.conversation_id})`);
    let backfilled = false;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const result = await updateCallWithConversationDetails(callId, callMetadata.conversation_id);
        if (result) {
          console.log(`Backfill success for call ${callId} on attempt ${attempt}`);
          backfilled = true;
          break;
        } else {
          console.debug(`Backfill attempt ${attempt} returned no updates for call ${callId}`);
        }
      } catch (err) {
        console.warn(`Backfill attempt ${attempt} failed for call ${callId}:`, err?.message || err);
      }
      // small delay before retrying
      await new Promise((r) => setTimeout(r, 2000));
    }
    if (!backfilled) {
      console.warn(`Unable to backfill conversation details for call ${callId} after 3 attempts.`);
    }
  }

  if (callRecord.recording_url) {
    console.log(`Call ${callId} already has recording URL, skipping duplicate upload.`);
    await deleteCallMetadata(callControlId);
    return;
  }

  const recordingUrl, originalURL = await fetchAndUploadRecording(callControlId, callId, recordingId, payload);
  if (recordingUrl) {
    console.log(`Recording attached to call ${callId}: ${recordingUrl}`);
    await deleteCallMetadata(callControlId);
    await getTranscript(callControlId, originalURL);
  } else {
    console.warn(`Failed to attach recording ${recordingId} for call ${callId}. Recording payload keys: ${Object.keys(payload).join(', ')}`);
  }
}
