import telnyx from './client.js';

/**
 * Starts the shared AI assistant on an answered call.
 *
 * @param {string} callControlId - The call_control_id from the webhook payload.
 * @param {object} dynamicVariables - The output of buildVariables(client).
 * @returns {Promise<void>}
 */
export async function startAssistant(callControlId, dynamicVariables) {
  const call = await telnyx.calls.retrieve(callControlId);
  await call.startAIAssistant({
    assistant_id: process.env.TELNYX_ASSISTANT_ID,
    AIAssistantDynamicVariables: dynamicVariables,
  });
}