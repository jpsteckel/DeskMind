/**
 * Handles the call.answered webhook event from Telnyx.
 *
 * This fires after the call is answered and the media session is established.
 * For most setups this can remain a no-op — the assistant is started in
 * callInitiated.js. Use this handler if you need to trigger any post-answer
 * logic, such as logging the answer timestamp or starting a recording.
 *
 * @param {object} payload - The `data.payload` object from the Telnyx webhook body.
 * @returns {Promise<void>}
 */
export async function handleCallAnswered(payload) {
  const { call_control_id } = payload;
  console.log(`Call answered: ${call_control_id}`);
  // Add any post-answer logic here (e.g. start recording, notify CRM)
}