/**
 * Handles the call.conversation.ended webhook event from Telnyx.
 *
 * Fired when the AI assistant's conversation concludes (either the caller
 * hung up or the assistant ended the call). Use this to log call outcomes,
 * post summaries to a CRM, trigger follow-up workflows, or store transcripts.
 *
 * @param {object} payload - The `data.payload` object from the Telnyx webhook body.
 * @returns {Promise<void>}
 */
export async function handleCallEnded(payload) {
  const {
    call_control_id,
    conversation_id,  // Unique ID for the AI conversation session
  } = payload;

  console.log(`Conversation ended. call_control_id=${call_control_id}, conversation_id=${conversation_id}`);

  // Example post-call actions you might add here:
  // - POST the conversation_id to your CRM webhook to pull the transcript
  // - Write a call record to a Supabase `call_logs` table
  // - Trigger an SMS follow-up via Telnyx Messaging API
}