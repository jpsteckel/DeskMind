import { getCallMetadata, deleteCallMetadata } from '../calls/callCache.js';
import { createCall } from '../calls/callRepository.js';
import telnyx from '../telnyx/client.js';

/**
 * Handles the call.conversation.ended webhook event from Telnyx.
 *
 * Fired when the AI assistant's conversation concludes (either the caller
 * hung up or the assistant ended the call). Records all call information
 * to the database including transcript, summary, and call metrics.
 *
 * @param {object} payload - The `data.payload` object from the Telnyx webhook body.
 * @returns {Promise<void>}
 */
export async function handleCallEnded(payload) {
  const {
    call_control_id,
    conversation_id,  // Unique ID for the AI conversation session
    duration_secs = 0,
    from: callerPhone,
  } = payload;

  console.log(`Conversation ended. call_control_id=${call_control_id}, conversation_id=${conversation_id}`);

  // Retrieve call metadata stored during call initiation
  const callMetadata = await getCallMetadata(call_control_id);
  
  if (!callMetadata) {
    console.warn(`No call metadata found for call_control_id=${call_control_id}. Call record will not be created.`);
    return;
  }

  try {
    // Extract metadata
    const { client_id, caller_phone: storedCallerPhone } = callMetadata;
    const finalCallerPhone = callerPhone || storedCallerPhone;

    // Fetch conversation details from Telnyx (transcript, summary, etc.)
    let conversationDetails = {};
    if (conversation_id) {
      try {
        const conversation = await telnyx.ai.conversations.retrieve(conversation_id);
        conversationDetails = {
          transcript: conversation.messages ? formatTranscript(conversation.messages) : null,
          summary: conversation.summary || null,
          call_type: inferCallType(conversation),
          is_appointment_booked: detectAppointmentBooking(conversation),
        };
      } catch (err) {
        console.warn(`Failed to retrieve conversation details for ${conversation_id}:`, err.message);
        // Continue without conversation details rather than failing the record
      }
    }

    // Create the call record with all available information
    const callRecord = await createCall({
      client_id,
      caller_phone: finalCallerPhone,
      caller_name: callMetadata.caller_name || null,
      transcript: conversationDetails.transcript || null,
      summary: conversationDetails.summary || null,
      call_type: conversationDetails.call_type || null,
      is_appointment_booked: conversationDetails.is_appointment_booked || false,
      duration_seconds: Math.floor(duration_secs),
    });

    console.log(`Call record created: id=${callRecord.id}, client_id=${client_id}`);
  } catch (err) {
    console.error(`Error creating call record for call_control_id=${call_control_id}:`, err);
  } finally {
    // Clean up Redis regardless of success or failure
    await deleteCallMetadata(call_control_id);
  }
}

/**
 * Formats conversation messages into a readable transcript.
 * 
 * @param {Array} messages - Array of message objects from Telnyx conversation.
 * @returns {string} Formatted transcript.
 */
function formatTranscript(messages) {
  if (!Array.isArray(messages)) return null;
  
  return messages
    .map(msg => `${msg.role || 'Unknown'}: ${msg.content || msg.text || ''}`)
    .join('\n');
}

/**
 * Infers the call type from conversation content.
 * Can be extended to use more sophisticated analysis.
 * 
 * @param {object} conversation - Conversation object from Telnyx.
 * @returns {string|null} Call type or null if unable to infer.
 */
function inferCallType(conversation) {
  // This is a placeholder — you can enhance this with AI-based classification
  // or by parsing custom fields from the assistant's response
  if (conversation.summary) {
    const summary = conversation.summary.toLowerCase();
    if (summary.includes('appointment')) return 'Appointment Booking';
    if (summary.includes('inquiry') || summary.includes('question')) return 'Inquiry';
    if (summary.includes('emergency') || summary.includes('urgent')) return 'Emergency';
  }
  return null;
}

/**
 * Detects if an appointment was booked during the call.
 * Can be enhanced with more sophisticated detection logic.
 * 
 * @param {object} conversation - Conversation object from Telnyx.
 * @returns {boolean} True if an appointment appears to have been booked.
 */
function detectAppointmentBooking(conversation) {
  // Placeholder logic — enhance this based on your assistant's actions/tools
  if (conversation.summary) {
    const summary = conversation.summary.toLowerCase();
    return summary.includes('appointment booked') || summary.includes('appointment scheduled');
  }
  return false;
}