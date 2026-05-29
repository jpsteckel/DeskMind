import telnyx from './client.js';
import { updateCall } from '../calls/callRepository.js';

export async function getTranscript(callControlId, recordingUrl) {
    const transcript = await telnyx.ai.audio.transcribe({
        model: 'deepgram/nova-3',
        file_url: recordingUrl,
        language: 'en-US',
        response_format: 'verbose_json',
        model_config: { "smart_format": true, "punctuate": true, "diarize": true }
    })
    console.log("transcript result for call_control_id=", callControlId, ":", JSON.stringify(transcript));
    return transcript;
}