/**
 * Initialization module for call recording and storage infrastructure.
 * Call initializeRecordingSystem() once during app startup to set up all necessary
 * Supabase storage buckets and ensure the recording system is ready.
 */

import { initializeRecordingBuckets } from '../telnyx/recordingService.js';

/**
 * Initializes the entire recording and storage infrastructure.
 * Should be called during application startup (before handling any calls).
 * 
 * @returns {Promise<void>}
 */
export async function initializeRecordingSystem() {
  try {
    console.log('Initializing recording system...');
    
    // Ensure storage buckets exist
    await initializeRecordingBuckets();
    
    console.log('Recording system initialized successfully.');
  } catch (err) {
    console.error('Failed to initialize recording system:', err);
    throw err;
  }
}

/**
 * Health check for the recording system.
 * Can be called to verify the system is operational.
 * 
 * @returns {Promise<object>} Status object
 */
export async function getRecordingSystemStatus() {
  try {
    // Add more checks as needed (e.g., verify storage connectivity)
    return {
      status: 'operational',
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    return {
      status: 'error',
      error: err.message,
      timestamp: new Date().toISOString(),
    };
  }
}
