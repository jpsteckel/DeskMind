import telnyx from './client.js';
import { updateCall } from '../calls/callRepository.js';
import { createAndScheduleCalendarEvent } from './callProcessingService.js';

export async function fetchConversationDetails(conversationId) {
  if (!conversationId) return null;

  try {
    console.debug(`fetchConversationDetails: retrieving conversation ${conversationId}`);
    const messages = [];
    for await (const messageListResponse of telnyx.ai.conversations.messages.list(conversationId)) {
      console.log(messageListResponse.role);
      messages.push(messageListResponse);
    }
    return {
      transcript: formatTranscript(messages),
      summary: conversation?.summary || null,
      call_type: inferCallType(conversation),
      is_appointment_booked: detectAppointmentBooking(conversation),
    };
  } catch (err) {
    console.warn(`Failed to retrieve conversation details for ${conversationId}:`, err?.message || err);
    return null;
  }
}

export async function updateCallWithConversationDetails(callId, conversationId) {
  const conversationDetails = await fetchConversationDetails(conversationId);
  if (!conversationDetails) return null;

  const updates = {};
  if (conversationDetails.transcript) updates.transcript = conversationDetails.transcript;
  if (conversationDetails.summary) updates.summary = conversationDetails.summary;
  if (conversationDetails.call_type) updates.call_type = conversationDetails.call_type;
  if (typeof conversationDetails.is_appointment_booked === 'boolean') {
    updates.is_appointment_booked = conversationDetails.is_appointment_booked;
  }

  if (Object.keys(updates).length === 0) return null;

  try {
    const updated = await updateCall(callId, updates);
    console.log(`updateCallWithConversationDetails: call ${callId} updated with conversation ${conversationId}`);
    return updated;
  } catch (err) {
    console.warn(`Failed to update call ${callId} with conversation details:`, err?.message || err);
    return null;
  }
}

/**
 * Orchestrates transcript processing to extract an appointment and push it to the client's Google Calendar.
 * 
 * @param {string} callId - UUID of the call record
 * @param {string} transcript - The transcribed text
 * @param {Object} calendarTokens - The client's OAuth2 tokens from the calendar_tokens column
 */
export async function processAndScheduleCallCalendarEvent(callId, transcript, calendarTokens) {
  if (!transcript || !calendarTokens) return null;

  // Ensure the transcript is always saved to the call record as soon as it's available.
  // This addresses the issue of the call row remaining blank if subsequent Gemini processing fails.
  try {
    await updateCall(callId, { transcript: transcript });
    console.log(`processAndScheduleCallCalendarEvent: transcript saved for call ${callId}.`);
  } catch (err) {
    console.error(`processAndScheduleCallCalendarEvent: Failed to save transcript for call ${callId}:`, err.message);
    // Continue attempting calendar event creation even if transcript saving failed, as it's a separate concern.
  }

  try {
    const event = await createAndScheduleCalendarEvent(transcript, calendarTokens);
    if (event) {
      await updateCall(callId, { calendar_event_id: event.id });
      console.log(`processAndScheduleCallCalendarEvent: call ${callId} updated with calendar event ${event.id}`);
    }
    return event;
  } catch (err) {
    console.warn(`Failed to process calendar event for call ${callId}:`, err.message);
    return null;
  }
}

function formatTranscript(messages) {
  if (!Array.isArray(messages)) return null;
  return messages
    .map(msg => `${msg.role || 'Unknown'}: ${msg.content || msg.text || ''}`)
    .join('\n');
}

function inferCallType(conversation) {
  if (!conversation || !conversation.summary) return null;
  const summary = conversation.summary.toLowerCase();
  if (summary.includes('appointment')) return 'Appointment Booking';
  if (summary.includes('inquiry') || summary.includes('question')) return 'Inquiry';
  if (summary.includes('emergency') || summary.includes('urgent')) return 'Emergency';
  return null;
}

function detectAppointmentBooking(conversation) {
  if (!conversation || !conversation.summary) return false;
  const summary = conversation.summary.toLowerCase();
  return summary.includes('appointment booked') || summary.includes('appointment scheduled');
}
