import telnyx from './client.js';
import { uploadFile, ensureBucketExists } from '../db/storage.js';
import { updateCall } from '../calls/callRepository.js';

const RECORDING_BUCKET = 'call-recordings';

/**
 * Initializes storage buckets for call recordings and transcripts.
 * Should be called during application startup.
 * 
 * @returns {Promise<void>}
 */
export async function initializeRecordingBuckets() {
  try {
    await ensureBucketExists(RECORDING_BUCKET, true); // Public bucket for easy sharing
    console.log('Recording buckets initialized successfully.');
  } catch (err) {
    console.error(`Failed to initialize recording buckets: ${err.message}`);
    throw err;
  }
}

/**
 * Fetches a call recording from Telnyx and uploads it to Supabase Storage.
 * 
 * @param {string} callControlId - The Telnyx call_control_id
 * @param {string} callId - The UUID of the call record in the database
 * @param {string} recordingId - The Telnyx recording ID (if available in webhook)
 * @returns {Promise<string>} The public URL of the uploaded recording
 */
function normalizeRecordingPayload(payload = {}) {
  return payload.recording && typeof payload.recording === 'object'
    ? payload.recording
    : payload;
}

function toArray(value) {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  return [value];
}

function extractStringValue(value) {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'string') return value[0];
  return null;
}

function extractUrlFromEntry(entry) {
  if (entry == null) return null;
  if (typeof entry === 'string') return entry;
  if (typeof entry !== 'object') return null;

  const directUrl = entry.url || entry.download_url || entry.recording_url || entry.public_url || entry.public_recording_url || entry.href || entry.uri || entry.direct_url || entry.direct_uri;
  if (typeof directUrl === 'string') return directUrl;

  for (const key of Object.keys(entry)) {
    const nested = entry[key];
    const candidate = extractStringValue(nested);
    if (candidate) return candidate;
  }

  return null;
}

function extractFirstRecordingUrl(payload) {
  const normalized = normalizeRecordingPayload(payload);
  const candidateCollections = [
    normalized.recording_urls,
    normalized.public_recording_urls,
    normalized.public_urls,
    normalized.urls,
  ];

  for (const collection of candidateCollections) {
    const entries = toArray(collection);
    for (const entry of entries) {
      const url = extractUrlFromEntry(entry);
      if (url) {
        return {
          url,
          contentType: entry?.mime_type || entry?.content_type || normalized?.mime_type || normalized?.content_type || 'audio/wav',
        };
      }
    }
  }

  const scalarUrl = extractUrlFromEntry(normalized);
  if (scalarUrl) {
    return {
      url: scalarUrl,
      contentType: normalized.mime_type || normalized.content_type || 'audio/wav',
    };
  }

  return null;
}

export async function fetchAndUploadRecording(callControlId, callId, recordingId, recordingPayload = {}) {
  if (!recordingId) {
    console.warn(`No recording ID provided for call ${callControlId}`);
    return null;
  }

  try {
    let recordingUrl;
    let contentType = 'audio/wav';
    const normalizedPayload = normalizeRecordingPayload(recordingPayload);

    const payloadMatch = extractFirstRecordingUrl(normalizedPayload);
    if (payloadMatch) {
      recordingUrl = payloadMatch.url;
      contentType = payloadMatch.contentType;
    }

    if (recordingUrl && recordingUrl.endsWith('.mp3') && contentType === 'audio/wav') {
      contentType = 'audio/mpeg';
    }

    if (!recordingUrl) {
      let recordingDetails;
      try {
        recordingDetails = await telnyx.recordings.retrieve(recordingId);
      } catch (err) {
        console.warn(`Failed to retrieve recording metadata for ${recordingId}:`, err.message);
        return null;
      }

      const normalizedDetails = normalizeRecordingPayload(recordingDetails);
      const detailsMatch = extractFirstRecordingUrl(normalizedDetails);
      if (detailsMatch) {
        recordingUrl = detailsMatch.url;
        contentType = detailsMatch.contentType;
      }

      if (!recordingUrl) {
        recordingUrl = recordingDetails?.channels?.[0]?.url;
        contentType = recordingDetails?.channels?.[0]?.mime_type || contentType;
      }

      if (!recordingUrl) {
        console.warn(`No download URL found for recording ${recordingId}`);
        console.debug('Recording metadata keys:', Object.keys(recordingDetails || {}));
        return null;
      }
    }

    const response = await fetch(recordingUrl);
    if (!response.ok) {
      throw new Error(`Failed to download recording: ${response.statusText}`);
    }

    const recordingArrayBuffer = await response.arrayBuffer();
    const recordingBuffer = Buffer.from(recordingArrayBuffer);
    const timestamp = new Date().toISOString().split('T')[0];
    const extension = recordingUrl.endsWith('.mp3') || contentType === 'audio/mpeg'
      ? 'mp3'
      : recordingUrl.endsWith('.wav') || contentType === 'audio/wav'
      ? 'wav'
      : 'wav';
    const fileName = recordingId
      ? `${timestamp}/${callId}-${recordingId}.${extension}`
      : `${timestamp}/${callId}.${extension}`;

    const uploadResult = await uploadFile(
      RECORDING_BUCKET,
      fileName,
      recordingBuffer,
      contentType
    );

    console.log(`Recording uploaded successfully for call ${callId}: ${uploadResult.publicUrl}`);
    await updateCall(callId, {
      recording_url: uploadResult.publicUrl,
    });

    return uploadResult.publicUrl, recordingUrl;
  } catch (err) {
    console.error(`Error fetching and uploading recording for call ${callId}:`, err);
    return null, null;
  }
}

/**
 * Retrieves recording download links and metadata from Telnyx.
 * Useful for on-demand download or streaming scenarios.
 * 
 * @param {string} recordingId - The Telnyx recording ID
 * @returns {Promise<object>} Recording metadata including download URLs
 */
export async function getRecordingMetadata(recordingId) {
  try {
    const recording = await telnyx.recordings.retrieve(recordingId);
    return {
      id: recording.id,
      duration: recording.duration_millis,
      channels: recording.channels || [],
      created_at: recording.created_at,
      status: recording.status,
    };
  } catch (err) {
    console.error(`Failed to retrieve recording metadata for ${recordingId}:`, err);
    throw err;
  }
}

/**
 * Lists all recordings for a specific call.
 * 
 * @param {string} callControlId - The Telnyx call_control_id
 * @returns {Promise<Array>} Array of recording objects
 */
export async function listCallRecordings(callControlId) {
  try {
    const recordings = await telnyx.recordings.list({
      filter: { call_control_id: callControlId },
    });
    return recordings.data || [];
  } catch (err) {
    console.error(`Failed to list recordings for call ${callControlId}:`, err);
    throw err;
  }
}

/**
 * Deletes a recording from Telnyx (not Supabase Storage).
 * Use when you want to remove recordings from Telnyx but keep them in Storage.
 * 
 * @param {string} recordingId - The Telnyx recording ID
 * @returns {Promise<void>}
 */
export async function deleteRecordingFromTelnyx(recordingId) {
  try {
    await telnyx.recordings.delete(recordingId);
    console.log(`Recording ${recordingId} deleted from Telnyx.`);
  } catch (err) {
    console.error(`Failed to delete recording ${recordingId} from Telnyx:`, err);
    // Don't throw — deletion failure shouldn't block other operations
  }
}

/**
 * Stores the recording ID in call metadata (Redis) for later retrieval.
 * Called by the webhook handler when recording information is available.
 * 
 * @param {string} callControlId - The Telnyx call_control_id
 * @param {string} recordingId - The recording ID to store
 * @returns {Promise<void>}
 */
export async function storeRecordingId(callControlId, recordingId) {
  // This function would integrate with Redis call metadata storage
  // Implementation depends on your Redis key structure
  console.log(`Recording ID ${recordingId} associated with call ${callControlId}`);
}
