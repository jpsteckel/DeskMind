import telnyx from './client.js';

/**
 * Answers an inbound call via the Telnyx Call Control API.
 * Must be called before any other call control commands can be issued.
 *
 * @param {string} callControlId - The call_control_id from the call.initiated webhook payload.
 * @returns {Promise<void>}
 */
export async function answerCall(callControlId) {
  await telnyx.calls.actions.answer(callControlId);
}