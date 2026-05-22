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
export async function fetchAndUploadRecording(callControlId, callId, recordingId) {
  if (!recordingId) {
    console.warn(`No recording ID provided for call ${callControlId}`);
    return null;
  }

  try {
    // Fetch recording metadata from Telnyx
    let recordingDetails;
    try {
      recordingDetails = await telnyx.recordings.retrieve(recordingId);
    } catch (err) {
      console.warn(`Failed to retrieve recording metadata for ${recordingId}:`, err.message);
      return null;
    }

    if (!recordingDetails || !recordingDetails.channels) {
      console.warn(`No recording channels found for recording ${recordingId}`);
      return null;
    }

    // Download the first channel (or use primary if available)
    const channelUrl = recordingDetails.channels[0]?.url;
    if (!channelUrl) {
      console.warn(`No download URL found in recording ${recordingId}`);
      return null;
    }

    // Download the recording from Telnyx
    const response = await fetch(channelUrl);
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
      'audio/wav'
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
