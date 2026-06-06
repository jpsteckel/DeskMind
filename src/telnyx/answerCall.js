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

/**
 * Transfers an active call to the configured fallback destination.
 *
 * @param {string} callControlId - The call_control_id from the webhook payload.
 * @param {string} destination - The phone or SIP URI to transfer to.
 * @returns {Promise<void>}
 */
export async function transferCall(callControlId, destination) {
  await telnyx.calls.actions.transfer(callControlId, {
    to: destination,
  });
}
