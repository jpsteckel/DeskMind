import { getCallMetadata, updateCallMetadata, deleteCallMetadata } from '../calls/callCache.js';
import { fetchAndUploadRecording, scheduleCallCalendarEvent } from '../telnyx/recordingService.js';
import { getCallById } from '../calls/callRepository.js';
import { getTranscript } from '../telnyx/analyzeCall.js';
import { updateCall } from '../calls/callRepository.js';
import { processTranscript, summarizeTranscript, extractEntities, classifyCall, getBooked, analyzeSentiment, extractActionItems } from '../telnyx/callProcessingService.js';
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

  const existingTranscript = callRecord.transcript;
  if (callRecord.recording_url && existingTranscript) {
    console.log(`Call ${callId} already has recording URL and transcript, skipping duplicate upload and transcription.`);
    await deleteCallMetadata(callControlId);
    return;
  }

  let recordingUrl = callRecord.recording_url;
  if (!recordingUrl) {
    const uploadResult = await fetchAndUploadRecording(callControlId, callId, recordingId, payload);
    if (!uploadResult) {
      console.warn(`Failed to attach recording ${recordingId} for call ${callId}. Recording payload keys: ${Object.keys(payload).join(', ')}`);
      return;
    }
    recordingUrl = uploadResult[0];
  }

  if (!recordingUrl) {
    console.warn(`No recording URL available after upload for call ${callId}.`);
    return;
  }

  const transcript = existingTranscript || await getTranscript(callControlId, recordingUrl);
  if (!transcript) {
    console.warn(`Transcription failed or returned empty for call ${callId}.`);
    return;
  }

  let updatedCallRecord = callRecord;
  if (!existingTranscript) {
    const processedTranscript = await processTranscript(transcript);
    updatedCallRecord = await updateCall(callId, {
      transcript,
      summary: processedTranscript.summary,
      caller_name: processedTranscript.clientName,
      caller_email: processedTranscript.clientEmail,
      business_name: processedTranscript.companyName,
      call_type: processedTranscript.callType,
      is_appointment_booked: processedTranscript.isAppointmentBooked,
      appointment_date: processedTranscript.appointmentDate,
      appointment_time: processedTranscript.appointmentTime,
      service_booked: processedTranscript.serviceBooked,
      sentiment: processedTranscript.sentiment,
      urgency: processedTranscript.urgency,
      follow_up_required: processedTranscript.followUpRequired,
      resolution_status: processedTranscript.resolutionStatus,
      resolution: processedTranscript.resolution,
      tags: processedTranscript.tags,
      key_issues: processedTranscript.keyIssues,
      follow_up_tasks: processedTranscript.followUpActions,
    });
    console.log(`Recording attached to call ${callId}: ${recordingUrl}`);
  } else {
    console.log(`Call ${callId} already has transcript; skipping transcription but keeping existing recording URL.`);
  }

  const calendarTokens = updatedCallRecord.calendar_tokens || callMetadata?.calendar_tokens;
  if (!updatedCallRecord.calendar_event_id && calendarTokens) {
    await scheduleCallCalendarEvent(callId, transcript, calendarTokens);
  }

  await deleteCallMetadata(callControlId);
}
