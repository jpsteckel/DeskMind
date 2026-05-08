import 'dotenv/config';
import express from 'express';
import webhookRouter from './webhook/router.js';

const app = express();
const PORT = process.env.PORT ?? 3000;

// Parse incoming JSON bodies from Telnyx webhooks
app.use(express.json());

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