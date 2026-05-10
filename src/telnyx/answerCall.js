/**
 * Answers an inbound call via the Telnyx Call Control REST API.
 *
 * @param {string} callControlId - The call_control_id from the call.initiated webhook payload.
 * @returns {Promise<void>}
 */
export async function answerCall(callControlId) {
  const response = await fetch(
    `https://api.telnyx.com/v2/calls/${callControlId}/actions/answer`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.TELNYX_API_KEY}`,
      },
      body: JSON.stringify({}),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to answer call: ${JSON.stringify(error)}`);
  }
}