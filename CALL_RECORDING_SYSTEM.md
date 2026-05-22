# Call Recording, Transcripts, and Storage System

This document explains the complete implementation for recording calls, capturing transcripts and summaries, and storing them in the database.

## Overview

The system implements a complete call lifecycle that captures:
- **Recordings**: Audio files hosted in Supabase Storage
- **Transcripts**: Complete message-by-message conversation records
- **Summaries**: AI-generated call summaries
- **Metadata**: Duration, call type, appointment bookings, etc.

## Architecture

### Components

1. **Recording Service** (`src/telnyx/recordingService.js`)
   - Fetches recordings from Telnyx
   - Uploads to Supabase Storage
   - Manages recording lifecycle

2. **Storage Module** (`src/db/storage.js`)
   - Handles file uploads/downloads to Supabase Storage
   - Generates signed URLs for secure access
   - Manages storage buckets

3. **Call Repository** (`src/calls/callRepository.js`)
   - Stores/retrieves call records from database
   - Provides utility functions for accessing recordings and transcripts

4. **Call Cache** (`src/calls/callCache.js`)
   - Redis-backed metadata storage during active calls
   - Tracks recording IDs and call information

## Data Flow

### During Call Initiation (callInitiated.js)

```
1. Call received → Look up client
2. Answer call
3. Store metadata in Redis (client_id, caller_phone)
4. START RECORDING (via Telnyx API)
5. Start AI assistant
```

### During Call End (callEnded.js)

```
1. Conversation ends
2. Fetch transcript and summary from Telnyx
3. Fetch recording from Telnyx
4. Upload recording to Supabase Storage
5. Create database record with all information:
   - transcript
   - summary
   - recording_url
   - call duration
   - caller info
6. Clean up Redis metadata
```

## Video Hosting Strategy

### Why Supabase Storage?

We use **Supabase Storage** for call recordings because:

1. **Fully Managed**: No servers to maintain
2. **Cost-Effective**: Pay only for storage and bandwidth used
3. **Integrated**: Works seamlessly with PostgreSQL and existing Supabase setup
4. **CDN**: Built-in CDN for fast downloads globally
5. **Security**: Row-level security and signed URLs for access control
6. **Scalability**: Handles any volume of recordings

### Storage Organization

Recordings are stored in the `call-recordings` bucket with this structure:

```
call-recordings/
├── 2024-05-15/
│   ├── {call-id-1}.wav
│   ├── {call-id-2}.wav
│   └── {call-id-3}.wav
├── 2024-05-16/
│   ├── {call-id-4}.wav
│   └── {call-id-5}.wav
```

This organization enables:
- Easy date-based cleanup and archival
- Efficient listing and browsing
- Logical organization for compliance

## Usage Examples

### 1. Get Call Recording URL

```javascript
import { getCallRecording } from './calls/callRepository.js';

// Get public URL
const recording = await getCallRecording(callId);
console.log(recording.publicUrl); // Direct playback URL

// Get signed URL (expires in 1 hour)
const secure = await getCallRecording(callId, true, 3600);
console.log(secure.signedUrl); // For restricted access
```

### 2. Get Call Transcript

```javascript
import { getCallTranscript } from './calls/callRepository.js';

const transcript = await getCallTranscript(callId);
console.log(transcript);
/* Output:
Assistant: Hello! Thank you for calling...
Caller: Hi, I'd like to book an appointment...
Assistant: I'd be happy to help you schedule an appointment...
*/
```

### 3. Get Call Summary

```javascript
import { getCallSummary } from './calls/callRepository.js';

const summary = await getCallSummary(callId);
console.log(summary);
// "Caller requested appointment booking for dental cleaning on Friday at 2pm"
```

### 4. Search Call Transcripts

```javascript
import { searchTranscripts } from './calls/callRepository.js';

const results = await searchTranscripts(clientId, 'appointment', 20);
// Returns up to 20 calls where transcript mentions 'appointment'
```

### 5. Get Client Call Statistics

```javascript
import { getClientCallStats } from './calls/callRepository.js';

const stats = await getClientCallStats(clientId);
console.log(stats);
/* Output:
{
  total_calls: 42,
  total_duration_seconds: 18540,
  average_duration_seconds: 441,
  calls_with_transcripts: 41,
  calls_with_recordings: 40,
  appointment_booked_count: 12
}
*/
```

### 6. Retrieve All Client Transcripts

```javascript
import { getClientTranscripts } from './calls/callRepository.js';

const transcripts = await getClientTranscripts(clientId, 50);
// Returns array of {id, created_at, transcript, summary} for each call
```

## Environment Variables Required

Ensure these are set in your `.env` file:

```bash
# Existing
TELNYX_API_KEY=your_telnyx_key
TELNYX_ASSISTANT_ID=your_assistant_id
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
REDIS_URL=your_redis_url
```

## Database Schema

The existing `calls` table already supports all recording features:

```sql
CREATE TABLE calls (
  id UUID PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES clients(id),
  caller_phone TEXT NOT NULL,
  caller_name TEXT,
  transcript TEXT,           -- Full conversation transcript
  summary TEXT,              -- AI-generated summary
  recording_url TEXT,        -- URL to Supabase Storage (NEW)
  call_type TEXT,            -- e.g., 'Appointment Booking'
  is_appointment_booked BOOLEAN DEFAULT FALSE,
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

No migration needed — `recording_url` column already exists!

## Initialization

Add this to your main `index.js` or startup sequence:

```javascript
import { initializeRecordingSystem } from './db/recordingInit.js';

// During app startup
await initializeRecordingSystem();
// Now the storage buckets are created and ready
```

## Webhook Configuration (Telnyx)

To receive recording notifications, configure these webhooks in your Telnyx portal:

### 1. Recording Started
**Event**: `call.recording.started`
**Handler**: Optional (for informational purposes)

### 2. Recording Finished
**Event**: `call.recording.finished`
**Handler**: Use this to immediately process recordings
**Payload includes**: `recording_id`

Your webhook handler can extract the `recording_id` and pass it to `fetchAndUploadRecording()`.

### Simpler Approach (Polling)

If you don't want to set up additional webhooks, the system will:
1. Check the `call.conversation.ended` payload for `recording_id`
2. If not found, query Telnyx to list recordings for that call
3. Automatically upload the first available recording

## API Reference

### Recording Service (`src/telnyx/recordingService.js`)

```javascript
// Fetch recording from Telnyx and upload to Supabase
await fetchAndUploadRecording(callControlId, callId, recordingId);

// Get recording metadata from Telnyx
const metadata = await getRecordingMetadata(recordingId);

// List all recordings for a call
const recordings = await listCallRecordings(callControlId);

// Delete recording from Telnyx (not Storage)
await deleteRecordingFromTelnyx(recordingId);

// Initialize storage buckets
await initializeRecordingBuckets();
```

### Storage Module (`src/db/storage.js`)

```javascript
// Upload file to Supabase Storage
const result = await uploadFile(bucket, fileName, content, contentType);

// Download file from Storage
const buffer = await downloadFile(bucket, filePath);

// Get signed URL for temporary access
const signedUrl = await getSignedUrl(bucket, filePath, expiresIn);

// Delete file from Storage
await deleteFile(bucket, filePath);

// List files in folder
const files = await listFiles(bucket, folderPath);

// Ensure bucket exists (creates if needed)
await ensureBucketExists(bucketName, isPublic);
```

### Call Repository (`src/calls/callRepository.js`)

```javascript
// Get recording URL(s)
const recording = await getCallRecording(callId, signed, expiresIn);

// Get transcript
const transcript = await getCallTranscript(callId);

// Get summary
const summary = await getCallSummary(callId);

// Search transcripts
const results = await searchTranscripts(clientId, keyword, limit);

// Get all transcripts for client
const transcripts = await getClientTranscripts(clientId, limit);

// Get statistics
const stats = await getClientCallStats(clientId);

// Delete call record
await deleteCall(callId);
```

## Error Handling

The system is designed to be resilient:

- **Recording failure**: Call record is created even if recording fails
- **Transcript unavailable**: Call record created with NULL transcript
- **Storage error**: Error is logged but doesn't block call logging
- **Redis unavailable**: Cache failures are non-blocking

## Compliance and Data Retention

### GDPR/Privacy Considerations

1. **Storage**: Recordings stored on Supabase (EU or US data centers)
2. **Retention**: Configure per your privacy policy
3. **Access Control**: Use signed URLs to limit who can access
4. **Deletion**: Implement scheduled cleanup for old recordings

### Cleanup Example

```javascript
import { deleteFile } from './db/storage.js';

// Delete recordings older than 30 days
async function cleanupOldRecordings() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const oldCalls = await supabase
    .from('calls')
    .select('id, recording_url')
    .lt('created_at', thirtyDaysAgo.toISOString())
    .not('recording_url', 'is', null);
  
  for (const call of oldCalls.data) {
    const filePath = extractFilePath(call.recording_url);
    await deleteFile('call-recordings', filePath);
    await updateCall(call.id, { recording_url: null });
  }
}
```

## Performance Optimization

### Download Recording Asynchronously

For large recordings, process asynchronously:

```javascript
// In callEnded webhook handler
setImmediate(async () => {
  try {
    await fetchAndUploadRecording(call_control_id, callRecord.id, recording_id);
  } catch (err) {
    console.error('Background recording upload failed:', err);
  }
});
```

### Transcoding for Streaming

For web streaming, consider transcoding WAV to MP3:

```javascript
// Pseudocode for MP3 conversion
import ffmpeg from 'fluent-ffmpeg';

const mp3Buffer = await new Promise((resolve) => {
  ffmpeg(wavBuffer)
    .audioCodec('libmp3lame')
    .toFormat('mp3')
    .on('end', () => resolve(output))
    .pipe(stream);
});
```

## Testing

```javascript
// Test recording flow
import { getCallRecording, getCallTranscript, getCallSummary } from './calls/callRepository.js';

async function testCallRecording(callId) {
  const recording = await getCallRecording(callId, true);
  const transcript = await getCallTranscript(callId);
  const summary = await getCallSummary(callId);
  
  console.assert(recording.publicUrl, 'Recording URL should exist');
  console.assert(transcript, 'Transcript should exist');
  console.assert(summary, 'Summary should exist');
}
```

## Troubleshooting

### Recording Not Found

**Problem**: `fetchAndUploadRecording` returns null

**Solutions**:
1. Verify recording was actually created in Telnyx
2. Check `startRecording` wasn't silently failing in `startAssistant.js`
3. Ensure `recording_id` is correctly extracted from webhook payload
4. Check Telnyx API key permissions

### Storage Upload Fails

**Problem**: Files not appearing in Supabase Storage

**Solutions**:
1. Verify `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are correct
2. Check bucket permissions in Supabase dashboard
3. Verify file sizes aren't exceeding limits
4. Check Supabase Storage quota

### Transcript/Summary Empty

**Problem**: Database shows NULL for transcript/summary

**Solutions**:
1. Verify conversation was properly recorded by AI assistant
2. Check `conversation_id` is being passed to webhook
3. Verify Telnyx API can retrieve conversation details
4. Check conversation contains messages

## Future Enhancements

1. **Transcription Service**: Send recordings to third-party transcription service if Telnyx transcription unavailable
2. **Speaker Diarization**: Identify speaker changes in transcript
3. **Sentiment Analysis**: Analyze call sentiment
4. **Call Classification**: ML-based call categorization
5. **Recording Compression**: Archive old recordings in compressed format
6. **Playback UI**: Web player for call recordings and transcripts
