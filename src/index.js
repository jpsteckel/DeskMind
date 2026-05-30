import 'dotenv/config';
import express from 'express';
import webhookRouter from './webhook/router.js';
import { initializeRecordingSystem } from './db/recordingInit.js';
import startConversationBackfillJob from './jobs/conversationBackfill.js';

const app = express();
const PORT = process.env.PORT ?? 3000;

// Parse incoming JSON bodies from Telnyx webhooks
app.use(express.json());
await initializeRecordingSystem();

// Mount the webhook router at /webhook
// Set this URL in your Telnyx Call Control Application settings
app.use('/webhook', webhookRouter);

/**
 * Health check endpoint.
 * Useful for Railway/Render uptime monitoring and deployment verification.
 */
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Start background backfill job to ensure conversation transcripts/summaries
// are filled in when Telnyx delays providing them.
// CURRENTLY DISABLED FOR TESTING
//startConversationBackfillJob();