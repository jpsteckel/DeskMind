import { Router } from 'express';
import { handleCallInitiated } from './callInitiated.js';
import { handleCallAnswered } from './callAnswered.js';
import { handleCallEnded } from './callEnded.js';

const router = Router();

/**
 * POST /webhook
 *
 * Single entry point for all Telnyx Call Control webhook events.
 * Telnyx sends every event type to this URL — we route to the correct
 * handler based on `data.event_type`.
 *
 * Important: always respond 200 quickly. Telnyx will retry if it doesn't
 * receive a timely acknowledgement. We acknowledge first, then process async.
 */
router.post('/', async (req, res) => {
  // Acknowledge immediately so Telnyx doesn't retry the webhook
  res.sendStatus(200);
  console.log('Webhook received:', req.body);

  const event = req.body?.data;
  if (!event) return;

  const { event_type, payload } = event;

  try {
    switch (event_type) {
      case 'call.initiated':
        await handleCallInitiated(payload);
        break;

      case 'call.answered':
        await handleCallAnswered(payload);
        break;

      case 'call.conversation.ended':
        await handleCallEnded(payload);
        break;

      default:
        // Silently ignore event types we don't handle
        break;
    }
  } catch (err) {
    // Log errors without crashing the server — the 200 was already sent
    console.error(`Error handling ${event_type}:`, err);
  }
});

export default router;