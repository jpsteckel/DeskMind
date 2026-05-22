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
export async function fetchAndUploadRecording(callControlId, callId, recordingId, recordingPayload = {}) {
  if (!recordingId) {
    console.warn(`No recording ID provided for call ${callControlId}`);
    return null;
  }

  try {
    let recordingUrl;
    let contentType = 'audio/wav';

    // Prefer the download URL from the webhook payload if available.
    const recordingUrls = recordingPayload.recording_urls
      ? Array.isArray(recordingPayload.recording_urls)
        ? recordingPayload.recording_urls
        : [recordingPayload.recording_urls]
      : [];

    if (recordingUrls.length > 0) {
      recordingUrl = recordingUrls[0]?.url || recordingUrls[0]?.download_url || recordingUrls[0]?.recording_url;
      contentType = recordingUrls[0]?.mime_type || recordingUrls[0]?.content_type || contentType;
    }

    if (!recordingUrl && recordingPayload.public_recording_urls) {
      if (typeof recordingPayload.public_recording_urls === 'string') {
        recordingUrl = recordingPayload.public_recording_urls;
      } else if (recordingPayload.public_recording_urls?.url) {
        recordingUrl = recordingPayload.public_recording_urls.url;
      }
    }

    if (!recordingUrl) {
      // Fallback to Telnyx API metadata retrieval.
      let recordingDetails;
      try {
        recordingDetails = await telnyx.recordings.retrieve(recordingId);
      } catch (err) {
        console.warn(`Failed to retrieve recording metadata for ${recordingId}:`, err.message);
        return null;
      }

      // Support Telnyx responses that use channels or recording_urls.
      recordingUrl = recordingDetails?.channels?.[0]?.url;
      contentType = recordingDetails?.channels?.[0]?.mime_type || contentType;
      if (!recordingUrl && recordingDetails?.recording_urls?.length) {
        recordingUrl = recordingDetails.recording_urls[0]?.url || recordingDetails.recording_urls[0]?.download_url;
        contentType = recordingDetails.recording_urls[0]?.mime_type || recordingDetails.recording_urls[0]?.content_type || contentType;
      }

      if (!recordingUrl) {
        console.warn(`No download URL found for recording ${recordingId}`);
        return null;
      }
    }

    // Download the recording from Telnyx
    const response = await fetch(recordingUrl);
    if (!response.ok) {
      throw new Error(`Failed to download recording: ${response.statusText}`);
    }

    const recordingBuffer = await response.buffer();

    // Generate a unique filename with timestamp and call ID
    const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const fileName = `${timestamp}/${callId}.wav`;

    // Upload to Supabase Storage
    const uploadResult = await uploadFile(
      RECORDING_BUCKET,
      fileName,
      recordingBuffer,
      contentType
    );

    console.log(`Recording uploaded successfully for call ${callId}: ${uploadResult.publicUrl}`);

    // Update the call record with the recording URL
    await updateCall(callId, {
      recording_url: uploadResult.publicUrl,
    });

    return uploadResult.publicUrl;
  } catch (err) {
    console.error(`Error fetching and uploading recording for call ${callId}:`, err);
    // Don't throw — recording failure shouldn't block call logging
    return null;
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
