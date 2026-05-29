import telnyx from './client.js';
import { updateCall } from '../calls/callRepository.js';

export async function fetchConversationDetails(conversationId) {
  if (!conversationId) return null;

  try {
    console.debug(`fetchConversationDetails: retrieving conversation ${conversationId}`);
    const conversation = await telnyx.ai.conversations.retrieve(conversationId);
    
    const messages = conversation?.messages?.data || conversation?.messages;
    return {
      transcript: Array.isArray(messages) ? formatTranscript(messages) : null,
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
