import telnyx from './client.js';
import { updateCall } from '../calls/callRepository.js';

export async function getTranscript(callControlId, recordingUrl) {
    if (!recordingUrl) {
        console.warn(`No recording URL available for call_control_id=${callControlId}. Cannot transcribe.`);
        return null;
    }
    const transcript = await telnyx.ai.audio.transcribe({
        model: 'deepgram/nova-3',
        file_url: recordingUrl,
        language: 'en-US',
        response_format: 'verbose_json',
        model_config: { "smart_format": true, "punctuate": true, "diarize": true }
    })
    console.log("transcript result for call_control_id=", callControlId, ":", JSON.stringify(transcript));
    let parsedTranscript = "";
    const segments = transcript.data?.segments || transcript.segments || [];
    for (let i = 0; i < segments.length; i++) {
        parsedTranscript += "Speaker [" + (segments[i].speaker === 0 ? "Assistant" : segments[i].speaker) + "] says: " + segments[i].text + "\n";
    }

    console.log("parsed transcript for call_control_id=", callControlId, ":", parsedTranscript);
    return parsedTranscript;
} 