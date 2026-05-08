import { answerCall } from '../telnyx/answerCall.js';
import { startAssistant } from '../telnyx/startAssistant.js';
import { getCachedClient } from '../clients/clientCache.js';
import { buildVariables } from '../assistant/buildVariables.js';

/**
 * Handles the call.initiated webhook event from Telnyx.
 *
 * Flow:
 *  1. Extract the dialed number (telnyx_agent_target) and call_control_id.
 *  2. Answer the call immediately so Telnyx doesn't time out.
 *  3. Look up the client record by their Telnyx number.
 *  4. Build the dynamic variables payload from the client record.
 *  5. Start the AI assistant with those variables injected.
 *
 * @param {object} payload - The `data.payload` object from the Telnyx webhook body.
 * @returns {Promise<void>}
 */
export async function handleCallInitiated(payload) {
  const { call_control_id, to: dialedNumber, direction } = payload;

  // Only handle inbound calls — ignore legs created by outbound dials or transfers
  if (direction !== 'incoming') return;

  // Answer first so the caller hears something while we do the DB lookup.
  // Telnyx will time out if no command is issued promptly after call.initiated.
  await answerCall(call_control_id);

  // Look up the client whose Telnyx number was dialed
  const client = await getCachedClient(dialedNumber);

  if (!client) {
    // No client record found for this number — log and hang up gracefully.
    // In production you may want to play an error message before hanging up.
    console.warn(`No client found for number: ${dialedNumber}`);
    return;
  }

  // Map the client DB record to Telnyx dynamic variable format
  const variables = buildVariables(client);

  // Start the shared AI assistant, personalized for this client
  await startAssistant(call_control_id, variables);
}