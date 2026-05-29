import { getCallById, updateCall } from '../calls/callRepository.js';
import { getTranscript } from '../telnyx/analyzeCall.js';
import { getCallMetadata, updateCallMetadata, deleteCallMetadata } from '../calls/callCache.js';

// uses payload from recording finished webhook to update call record with transcript.
export async function handleCallMetadata(payload) {
    // ULTIMATELY SHOULD FETCH FROM THEIR SERVERS but getting errors rn

    const callControlId = payload.call_control_id || payload.call?.call_control_id;
    const callMetadata = await getCallMetadata(callControlId);
    if (!callMetadata) {
        console.warn(`No call metadata found for call_control_id=${callControlId}. Cannot transcribe`);
        return;
    };
    const callId = callMetadata.call_id;
    const recordingUrl = getCallById(callId)?.recording_url;
    const transcript = await getTranscript(callControlId, recordingUrl);
    if (transcript) {
        await updateCall(callMetadata.call_id, {
            transcript: transcript,
        });
        await deleteCallMetadata(callControlId);
    } else {
        console.warn(`Failed to transcribe call ${callControlId}.`);
    }
}