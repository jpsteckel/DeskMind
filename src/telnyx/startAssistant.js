import telnyx from './client.js';

/**
 * Starts the shared AI assistant on an answered call, injecting
 * per-client dynamic variables to personalize the conversation.
 *
 * @param {string} callControlId - The call_control_id from the webhook payload.
 * @param {object} dynamicVariables - The output of buildVariables(client),
 *   mapping {{variable_name}} placeholders to their resolved values.
 * @returns {Promise<void>}
 */
export async function startAssistant(callControlId, dynamicVariables) {
    // The single shared assistant configured in your Telnyx portal

    // Per-client values that fill {{variable_name}} placeholders in the
    // assistant's instructions, greeting, and tool configurations
  await telnyx.calls.actions.startAIAssistant(callControlId, {
    assistant: {
      id: process.env.TELNYX_ASSISTANT_ID,
      AIAssistantDynamicVariables: dynamicVariables,
    }
  });
}