import Telnyx from 'telnyx';

/**
 * Singleton Telnyx SDK client.
 * Initialized once and shared across all modules that need to issue
 * Call Control commands (answer, start assistant, transfer, etc.).
 */
const telnyx = new Telnyx(process.env.TELNYX_API_KEY);

export default telnyx;