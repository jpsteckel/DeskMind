import { getCallMetadata, updateCallMetadata, deleteCallMetadata } from '../calls/callCache.js';
import { updateCallWithConversationDetails } from '../telnyx/conversationService.js';
import { getCallById } from '../calls/callRepository.js';
import { updateCall } from '../calls/callRepository.js';

export async function handleCallTranscript(payload) {
    console.debug(`handleCallTranscript received payload: ${JSON.stringify(payload, null, 2)}`);
    const callControlId = payload.call_control_id;
    const transcript = payload.transcript_data ?? payload.transcript_data?.transcript ?? null;

    if (!callControlId) {
        console.warn('Transcript webhook received without call_control_id. Unable to associate transcript.');
        return;
    }

    if (!transcript) {
        console.warn(`Transcript webhook received for call ${callControlId} but no transcript was available.`);
        return;
    }

    const callMetadata = await getCallMetadata(callControlId);
    if (!callMetadata) {
        console.warn(`No call metadata found for call_control_id=${callControlId}. Can't attach recording yet.`);
        return;
    }

    const callId = callMetadata.call_id;
    if (!callId) {
        console.warn(`No callId found for ${callControlId}.`);
        return;
    }

    await updateCall(callId, {
        transcript,
    });

    console.log(`Transcript updated for call ${callId}: \n\t${transcript}`);
}