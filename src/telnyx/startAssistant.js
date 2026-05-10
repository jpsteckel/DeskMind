/**
 * Starts the shared AI assistant on an answered call.
 *
 * @param {string} callControlId - The call_control_id from the webhook payload.
 * @param {object} dynamicVariables - The output of buildVariables(client).
 * @returns {Promise<void>}
 */
export async function startAssistant(callControlId, dynamicVariables) {
  const response = await fetch(
    `https://api.telnyx.com/v2/calls/${callControlId}/actions/start_ai_assistant`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.TELNYX_API_KEY}`,
      },
      body: JSON.stringify({
        assistant_id: process.env.TELNYX_ASSISTANT_ID,
        AIAssistantDynamicVariables: dynamicVariables,
      }),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to start assistant: ${JSON.stringify(error)}`);
  }
}