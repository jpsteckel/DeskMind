import telnyx from './client.js';

/**
 * Starts the shared AI assistant on an answered call, injecting
 * per-client dynamic variables to personalize the conversation.
 * Also enables call recording for audit trail and quality assurance.
 *
 * @param {string} callControlId - The call_control_id from the webhook payload.
 * @param {object} dynamicVariables - The output of buildVariables(client),
 *   mapping {{variable_name}} placeholders to their resolved values.
 * @returns {Promise<void>}
 */
export async function startAssistant(callControlId, dynamicVariables) {
  try {
    // Start call recording before starting the assistant
    // This ensures the entire conversation is captured
    await telnyx.calls.actions.startRecording(callControlId, {
      format: 'wav', // WAV format for best compatibility
      channels: 'dual', // Record both directions separately
    });
    console.log(`Recording started for call ${callControlId}`);
  } catch (err) {
    console.warn(`Failed to start recording for call ${callControlId}: ${err.message}`);
    // Continue without recording rather than failing the call
  }

  // The single shared assistant configured in your Telnyx portal
  // Per-client values that fill {{variable_name}} placeholders in the
  // assistant's instructions, greeting, and tool configurations
  await telnyx.calls.actions.startAIAssistant(callControlId, {
    assistant: {
      id: process.env.TELNYX_ASSISTANT_ID,
      dynamic_variables: dynamicVariables,
    }
  });
  
  await telnyx.calls.actions.startTranscription(callControlId);
}