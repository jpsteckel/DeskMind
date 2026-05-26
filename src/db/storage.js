import supabase from './supabase.js';
import fs from 'fs';
import path from 'path';

/**
 * Uploads a file (recording, transcript, etc.) to Supabase Storage.
 * 
 * @param {string} bucket - The Supabase storage bucket name (e.g., 'call-recordings', 'call-transcripts')
 * @param {string} fileName - The file name to store as (e.g., 'call-12345.wav')
 * @param {Buffer|string} fileContent - File content as Buffer or string
 * @param {string} contentType - MIME type (e.g., 'audio/wav', 'application/json', 'text/plain')
 * @returns {Promise<object>} Object with publicUrl and path
 */
export async function uploadFile(bucket, fileName, fileContent, contentType) {
  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(fileName, fileContent, {
        contentType,
        upsert: true, // Allow repeated recording uploads to reuse the same path
      });

    if (error) throw new Error(`Upload failed: ${error.message}`);

    // Generate a public URL for the uploaded file
    const { data: publicData } = supabase.storage
      .from(bucket)
      .getPublicUrl(fileName);

    return {
      path: data.path,
      publicUrl: publicData.publicUrl,
      bucket,
    };
  } catch (err) {
    throw new Error(`Failed to upload file to Supabase Storage: ${err.message}`);
  }
}

/**
 * Downloads a file from Supabase Storage.
 * 
 * @param {string} bucket - The Supabase storage bucket name
 * @param {string} filePath - The file path in storage
 * @returns {Promise<Buffer>} File content as Buffer
 */
export async function downloadFile(bucket, filePath) {
  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .download(filePath);

    if (error) throw new Error(`Download failed: ${error.message}`);
    return data;
  } catch (err) {
    throw new Error(`Failed to download file from Supabase Storage: ${err.message}`);
  }
}

/**
 * Generates a signed URL for temporary access to a private file.
 * Useful for secure sharing of call recordings without exposing public URLs.
 * 
 * @param {string} bucket - The Supabase storage bucket name
 * @param {string} filePath - The file path in storage
 * @param {number} expiresIn - Expiry time in seconds (default: 3600 = 1 hour)
 * @returns {Promise<string>} Signed URL
 */
export async function getSignedUrl(bucket, filePath, expiresIn = 3600) {
  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(filePath, expiresIn);

    if (error) throw new Error(`Signed URL creation failed: ${error.message}`);
    return data.signedUrl;
  } catch (err) {
    throw new Error(`Failed to create signed URL: ${err.message}`);
  }
}

/**
 * Deletes a file from Supabase Storage.
 * 
 * @param {string} bucket - The Supabase storage bucket name
 * @param {string} filePath - The file path to delete
 * @returns {Promise<void>}
 */
export async function deleteFile(bucket, filePath) {
  try {
    const { error } = await supabase.storage
      .from(bucket)
      .remove([filePath]);

    if (error) throw new Error(`Delete failed: ${error.message}`);
  } catch (err) {
    throw new Error(`Failed to delete file from Supabase Storage: ${err.message}`);
  }
}

/**
 * Lists all files in a directory within a Supabase Storage bucket.
 * Useful for auditing or cleanup operations.
 * 
 * @param {string} bucket - The Supabase storage bucket name
 * @param {string} folderPath - The folder path to list (e.g., '2024-05')
 * @returns {Promise<Array>} Array of file objects
 */
export async function listFiles(bucket, folderPath = '') {
  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .list(folderPath);

    if (error) throw new Error(`List failed: ${error.message}`);
    return data || [];
  } catch (err) {
    throw new Error(`Failed to list files in Supabase Storage: ${err.message}`);
  }
}

/**
 * Ensures a storage bucket exists by creating it if necessary.
 * Idempotent — safe to call multiple times.
 * 
 * @param {string} bucketName - The bucket name to ensure exists
 * @param {boolean} isPublic - Whether the bucket should be public (default: false)
 * @returns {Promise<void>}
 */
export async function ensureBucketExists(bucketName, isPublic = false) {
  try {
    // Try to list bucket — if it exists, this succeeds
    await supabase.storage.from(bucketName).list('', { limit: 1 });
    console.log(`Bucket '${bucketName}' already exists.`);
  } catch (err) {
    // Bucket doesn't exist, create it
    try {
      const { data, error } = await supabase.storage.createBucket(bucketName, {
        public: isPublic,
      });
      if (error) throw error;
      console.log(`Bucket '${bucketName}' created successfully.`);
    } catch (createErr) {
      if (createErr.message && createErr.message.includes('already exists')) {
        console.log(`Bucket '${bucketName}' already exists.`);
      } else {
        throw createErr;
      }
    }
  }
}
