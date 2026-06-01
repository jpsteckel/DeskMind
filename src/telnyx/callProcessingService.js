// =============================================================================
// callProcessingService.js
// Call Transcript Processing Service — powered by Gemini 2.5 Flash-Lite
// =============================================================================
//
// REQUIRED ENVIRONMENT VARIABLES:
//   GEMINI_API_KEY   — Your Google AI Studio API key
//
// OPTIONAL ENVIRONMENT VARIABLES:
//   GEMINI_MODEL     — Override the model (default: gemini-2.5-flash-lite)
//   GEMINI_MAX_TOKENS — Max output tokens per request (default: 1024)
//   GEMINI_TEMPERATURE — Model temperature 0.0–1.0 (default: 0.1 for accuracy)
//
// INSTALLATION:
//   npm install @google/generative-ai dotenv
//
// USAGE:
//   import { processTranscript, batchProcessTranscripts } from './callProcessingService.js';
//   const result = await processTranscript(transcriptText);
//
// =============================================================================

import { GoogleGenerativeAI } from "@google/generative-ai";

// ---------------------------------------------------------------------------
// Configuration — tweak defaults here or via environment variables
// ---------------------------------------------------------------------------
const CONFIG = {
  model: process.env.GEMINI_MODEL || "gemini-2.5-flash-lite",
  maxOutputTokens: parseInt(process.env.GEMINI_MAX_TOKENS) || 1024,
  // Lower temperature = more deterministic/accurate for extraction tasks
  temperature: parseFloat(process.env.GEMINI_TEMPERATURE) || 0.1,
};

// ---------------------------------------------------------------------------
// Gemini client initialization
// ---------------------------------------------------------------------------
if (!process.env.GEMINI_API_KEY) {
  throw new Error(
    "Missing GEMINI_API_KEY environment variable. " +
    "Get your key at https://aistudio.google.com/app/apikey"
  );
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

function getModel() {
  return genAI.getGenerativeModel({
    model: CONFIG.model,
    generationConfig: {
      maxOutputTokens: CONFIG.maxOutputTokens,
      temperature: CONFIG.temperature,
      responseMimeType: "application/json", // Enforce JSON output
    },
  });
}

// =============================================================================
// PROMPT TEMPLATES
// Customize these to match your business terminology, call types, and output
// fields. Each prompt instructs the model to return a JSON object.
// =============================================================================

const PROMPTS = {

  // --------------------------------------------------------------------------
  // Full analysis — runs all extractions in a single API call (most efficient)
  // --------------------------------------------------------------------------
  fullAnalysis: (transcript, options = {}) => {
    const callTypes = options.callTypes || [
      "Sales", "Support", "Billing", "Onboarding", "Complaint",
      "Follow-up", "Cancellation", "Technical", "General Inquiry", "Other"
    ];

    const sentimentOptions = options.sentimentOptions || ["Positive", "Neutral", "Negative", "Mixed"];

    const customFields = options.customFields
      ? `\nAdditional fields to extract:\n${options.customFields}`
      : "";

    return `
You are an expert call center analyst. Analyze the following call transcript and return a JSON object with these exact fields.

CALL TRANSCRIPT:
"""
${transcript}
"""

Return ONLY a valid JSON object with these fields (no markdown, no explanation):
{
  "clientName": "Full name of the client/customer. Use null if not mentioned.",
  "clientPhone": "Client phone number if mentioned, otherwise null.",
  "clientEmail": "Client email address if mentioned, otherwise null.",
  "agentName": "Name of the agent/representative. Use null if not mentioned.",
  "callType": "One of: ${callTypes.join(", ")}",
  "callDurationEstimate": "Estimated call duration based on content volume (e.g. '3-5 minutes'). Use null if unknown.",
  "summary": "A concise 2-4 sentence summary of the call covering: purpose, key discussion points, and outcome.",
  "keyIssues": ["Array of specific issues, requests, or topics raised during the call"],
  "resolution": "What was resolved or agreed upon. Use null if unresolved.",
  "resolutionStatus": "One of: Resolved, Unresolved, Pending, Escalated",
  "followUpRequired": true or false,
  "followUpActions": ["Array of specific follow-up tasks required. Empty array if none."],
  "sentiment": "Overall customer sentiment — one of: ${sentimentOptions.join(", ")}",
  "urgency": "One of: Low, Medium, High, Critical",
  "tags": ["Array of 2-5 descriptive tags for categorizing/searching this call"]${customFields}
}
`;
  },

  // --------------------------------------------------------------------------
  // Summary only — cheaper for high-volume pipelines
  // --------------------------------------------------------------------------
  summaryOnly: (transcript, options = {}) => {
    const length = options.summaryLength || "2-4 sentences";
    const focus = options.summaryFocus || "purpose, key points, and outcome";

    return `
Summarize the following call transcript in ${length}, focusing on: ${focus}.
Return ONLY a JSON object: { "summary": "..." }

TRANSCRIPT:
"""
${transcript}
"""
`;
  },

  // --------------------------------------------------------------------------
  // Entity extraction — client name, agent, contact info
  // --------------------------------------------------------------------------
  extractEntities: (transcript) => `
Extract named entities from this call transcript.
Return ONLY a JSON object:
{
  "clientName": "string or null",
  "clientPhone": "string or null",
  "clientEmail": "string or null",
  "agentName": "string or null",
  "companyName": "string or null",
  "accountNumber": "string or null",
  "orderNumber": "string or null"
}

TRANSCRIPT:
"""
${transcript}
"""
`,

  // --------------------------------------------------------------------------
  // Call classification only
  // --------------------------------------------------------------------------
  classifyCall: (transcript, options = {}) => {
    const callTypes = options.callTypes || [
      "Sales", "Support", "Billing", "Onboarding", "Complaint",
      "Follow-up", "Cancellation", "Technical", "General Inquiry", "Other"
    ];

    return `
Classify this call transcript into one call type.
Valid types: ${callTypes.join(", ")}
Return ONLY a JSON object: { "callType": "...", "confidence": "High|Medium|Low", "reason": "1 sentence explanation" }

TRANSCRIPT:
"""
${transcript}
"""
`;
  },

  // --------------------------------------------------------------------------
  // Sentiment & urgency analysis
  // --------------------------------------------------------------------------
  analyzeSentiment: (transcript, options = {}) => {
    const sentimentOptions = options.sentimentOptions || ["Positive", "Neutral", "Negative", "Mixed"];

    return `
Analyze the customer sentiment and urgency in this call transcript.
Return ONLY a JSON object:
{
  "sentiment": "One of: ${sentimentOptions.join(", ")}",
  "urgency": "One of: Low, Medium, High, Critical",
  "emotionalIndicators": ["Array of specific phrases or behaviors that reveal sentiment"],
  "customerSatisfactionScore": "Estimated score 1-10 (10 = very satisfied)"
}

TRANSCRIPT:
"""
${transcript}
"""
`;
  },

  // --------------------------------------------------------------------------
  // Action items / follow-up extraction
  // --------------------------------------------------------------------------
  extractActionItems: (transcript) => `
Extract all follow-up tasks and action items from this call transcript.
Return ONLY a JSON object:
{
  "followUpRequired": true or false,
  "resolutionStatus": "One of: Resolved, Unresolved, Pending, Escalated",
  "resolution": "What was resolved/agreed, or null",
  "actionItems": [
    { "task": "description", "assignedTo": "agent|client|unknown", "deadline": "if mentioned or null" }
  ]
}

TRANSCRIPT:
"""
${transcript}
"""
`,

  // --------------------------------------------------------------------------
  // Custom prompt — pass your own prompt string with {transcript} placeholder
  // --------------------------------------------------------------------------
  custom: (transcript, promptTemplate) => {
    if (!promptTemplate) throw new Error("custom prompt requires a promptTemplate string");
    return promptTemplate.replace("{transcript}", transcript);
  },
};

// =============================================================================
// CORE API CALL FUNCTION
// =============================================================================

/**
 * Send a prompt to Gemini and return parsed JSON.
 * @param {string} prompt - The full prompt string
 * @returns {Promise<Object>} Parsed JSON response
 */
async function callGemini(prompt) {
  const model = getModel();

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();

    // Strip markdown code fences if model wraps output despite responseMimeType
    const cleaned = text.replace(/^```json\s*/i, "").replace(/\s*```$/i, "").trim();

    return JSON.parse(cleaned);
  } catch (err) {
    if (err instanceof SyntaxError) {
      throw new Error(`Gemini returned non-JSON output: ${err.message}`);
    }
    throw err;
  }
}

// =============================================================================
// PUBLIC API FUNCTIONS
// =============================================================================

/**
 * Run a full analysis on a single transcript.
 * Most efficient option — one API call for all fields.
 *
 * @param {string} transcript - Raw call transcript text
 * @param {Object} options - Optional customization
 * @param {string[]} options.callTypes - Override the list of valid call types
 * @param {string[]} options.sentimentOptions - Override sentiment labels
 * @param {string} options.customFields - Extra JSON fields to append to the prompt
 * @returns {Promise<Object>} Full structured call data
 */
export async function processTranscript(transcript, options = {}) {
  if (!transcript || typeof transcript !== "string" || !transcript.trim()) {
    throw new Error("transcript must be a non-empty string");
  }

  const prompt = PROMPTS.fullAnalysis(transcript, options);
  return callGemini(prompt);
}

/**
 * Generate a summary only (cheapest option for high volume).
 *
 * @param {string} transcript
 * @param {Object} options
 * @param {string} options.summaryLength - e.g. "1-2 sentences" (default: "2-4 sentences")
 * @param {string} options.summaryFocus - What to focus the summary on
 * @returns {Promise<{summary: string}>}
 */
export async function summarizeTranscript(transcript, options = {}) {
  const prompt = PROMPTS.summaryOnly(transcript, options);
  return callGemini(prompt);
}

/**
 * Extract named entities: client name, agent, contact info, account numbers.
 *
 * @param {string} transcript
 * @returns {Promise<Object>} Entity fields
 */
export async function extractEntities(transcript) {
  const prompt = PROMPTS.extractEntities(transcript);
  return callGemini(prompt);
}

/**
 * Classify the call into a call type.
 *
 * @param {string} transcript
 * @param {Object} options
 * @param {string[]} options.callTypes - Override valid call types
 * @returns {Promise<{callType: string, confidence: string, reason: string}>}
 */
export async function classifyCall(transcript, options = {}) {
  const prompt = PROMPTS.classifyCall(transcript, options);
  return callGemini(prompt);
}

/**
 * Analyze customer sentiment and urgency.
 *
 * @param {string} transcript
 * @param {Object} options
 * @param {string[]} options.sentimentOptions - Override sentiment labels
 * @returns {Promise<Object>} Sentiment analysis result
 */
export async function analyzeSentiment(transcript, options = {}) {
  const prompt = PROMPTS.analyzeSentiment(transcript, options);
  return callGemini(prompt);
}

/**
 * Extract follow-up action items and resolution status.
 *
 * @param {string} transcript
 * @returns {Promise<Object>} Action items and resolution info
 */
export async function extractActionItems(transcript) {
  const prompt = PROMPTS.extractActionItems(transcript);
  return callGemini(prompt);
}

/**
 * Run a custom prompt against the transcript.
 * Use {transcript} as a placeholder in your template — it will be replaced.
 *
 * @param {string} transcript
 * @param {string} promptTemplate - Your custom prompt with {transcript} placeholder
 * @returns {Promise<Object>} Parsed JSON from model output
 *
 * @example
 * const result = await processWithCustomPrompt(transcript, `
 *   Extract product names mentioned in this call. Return JSON: { "products": [] }
 *   TRANSCRIPT: {transcript}
 * `);
 */
export async function processWithCustomPrompt(transcript, promptTemplate) {
  const prompt = PROMPTS.custom(transcript, promptTemplate);
  return callGemini(prompt);
}

/**
 * Process multiple transcripts in sequence with a delay to respect rate limits.
 *
 * @param {string[]} transcripts - Array of transcript strings
 * @param {Object} options - Same options as processTranscript()
 * @param {number} options.delayMs - Delay between requests in ms (default: 200)
 * @param {Function} options.onProgress - Callback(index, total, result) for progress tracking
 * @param {boolean} options.continueOnError - If true, log errors and continue (default: true)
 * @returns {Promise<Array<{index: number, result?: Object, error?: string}>>}
 */
export async function batchProcessTranscripts(transcripts, options = {}) {
  if (!Array.isArray(transcripts) || transcripts.length === 0) {
    throw new Error("transcripts must be a non-empty array");
  }

  const delayMs = options.delayMs ?? 200;
  const continueOnError = options.continueOnError ?? true;
  const results = [];

  for (let i = 0; i < transcripts.length; i++) {
    try {
      const result = await processTranscript(transcripts[i], options);
      results.push({ index: i, result });

      if (typeof options.onProgress === "function") {
        options.onProgress(i + 1, transcripts.length, result);
      }
    } catch (err) {
      if (continueOnError) {
        console.error(`[callProcessingService] Error on transcript ${i}:`, err.message);
        results.push({ index: i, error: err.message });
      } else {
        throw err;
      }
    }

    // Throttle requests to stay within Gemini rate limits
    if (i < transcripts.length - 1 && delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return results;
}

/**
 * Run a selective set of analyses in parallel (saves latency vs sequential calls).
 * Useful when you want some — but not all — fields from the full analysis.
 *
 * @param {string} transcript
 * @param {string[]} analyses - Any of: "summary", "entities", "classification", "sentiment", "actions"
 * @param {Object} options - Options passed to each sub-function
 * @returns {Promise<Object>} Merged results from all requested analyses
 *
 * @example
 * const result = await selectiveAnalysis(transcript, ["summary", "entities", "sentiment"]);
 */
export async function selectiveAnalysis(transcript, analyses = [], options = {}) {
  const validAnalyses = ["summary", "entities", "classification", "sentiment", "actions"];
  const selected = analyses.filter((a) => validAnalyses.includes(a));

  if (selected.length === 0) {
    throw new Error(`No valid analyses requested. Choose from: ${validAnalyses.join(", ")}`);
  }

  const taskMap = {
    summary:        () => summarizeTranscript(transcript, options),
    entities:       () => extractEntities(transcript),
    classification: () => classifyCall(transcript, options),
    sentiment:      () => analyzeSentiment(transcript, options),
    actions:        () => extractActionItems(transcript),
  };

  const tasks = selected.map((key) => taskMap[key]());
  const results = await Promise.all(tasks);

  // Merge all result objects into one
  return results.reduce((acc, r) => ({ ...acc, ...r }), {});
}

// =============================================================================
// PROMPT CUSTOMIZATION HELPERS
// Export these so callers can modify prompts without editing this file.
// =============================================================================

/**
 * Get the raw prompt templates object for inspection or modification.
 * You can call PROMPTS.fullAnalysis(transcript, options) directly.
 */
export { PROMPTS };

/**
 * Get or update the active configuration.
 * Call updateConfig() before any API calls to change model/token settings at runtime.
 *
 * @param {Object} overrides - Keys: model, maxOutputTokens, temperature
 */
export function updateConfig(overrides = {}) {
  Object.assign(CONFIG, overrides);
}

/**
 * Return the current active configuration (read-only snapshot).
 * @returns {Object}
 */
export function getConfig() {
  return { ...CONFIG };
}