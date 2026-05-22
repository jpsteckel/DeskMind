# Quick Reference: Call Recording System API

## One-Line Setup
```javascript
import { initializeRecordingSystem } from './db/recordingInit.js';
await initializeRecordingSystem(); // Call during app startup
```

## Core Functions

### Get Call Recording
```javascript
import { getCallRecording } from './calls/callRepository.js';

// Public URL
const { publicUrl } = await getCallRecording(callId);

// Signed URL (expires in 1 hour)
const { publicUrl, signedUrl } = await getCallRecording(callId, true, 3600);
```

### Get Transcript
```javascript
import { getCallTranscript } from './calls/callRepository.js';

const transcript = await getCallTranscript(callId);
// Returns: "Assistant: Hello!...\nCaller: Hi, I'd like...\n..."
```

### Get Summary
```javascript
import { getCallSummary } from './calls/callRepository.js';

const summary = await getCallSummary(callId);
// Returns: "Caller requested appointment booking..."
```

### Search Transcripts
```javascript
import { searchTranscripts } from './calls/callRepository.js';

const results = await searchTranscripts(clientId, 'appointment', 20);
// Returns: Array of calls where transcript contains 'appointment'
```

### Get Statistics
```javascript
import { getClientCallStats } from './calls/callRepository.js';

const stats = await getClientCallStats(clientId);
// {
//   total_calls: 42,
//   total_duration_seconds: 18540,
//   average_duration_seconds: 441,
//   calls_with_recordings: 40,
//   calls_with_transcripts: 41,
//   appointment_booked_count: 12
// }
```

### Get All Transcripts
```javascript
import { getClientTranscripts } from './calls/callRepository.js';

const transcripts = await getClientTranscripts(clientId, 100);
// Returns: [{ id, created_at, transcript, summary }, ...]
```

## Storage Functions

### Upload File
```javascript
import { uploadFile } from './db/storage.js';

const result = await uploadFile(
  'bucket-name',
  'path/to/file.txt',
  Buffer.from('content'),
  'text/plain'
);
// Returns: { path, publicUrl, bucket }
```

### Download File
```javascript
import { downloadFile } from './db/storage.js';

const buffer = await downloadFile('bucket-name', 'path/to/file.txt');
```

### Get Signed URL
```javascript
import { getSignedUrl } from './db/storage.js';

const url = await getSignedUrl('bucket-name', 'path/to/file.txt', 3600);
// Returns: Signed URL valid for 1 hour
```

### Delete File
```javascript
import { deleteFile } from './db/storage.js';

await deleteFile('bucket-name', 'path/to/file.txt');
```

### List Files
```javascript
import { listFiles } from './db/storage.js';

const files = await listFiles('bucket-name', 'folder-path');
// Returns: [{ name, id, updated_at, metadata, ... }, ...]
```

## Recording Functions

### Fetch & Upload Recording
```javascript
import { fetchAndUploadRecording } from './telnyx/recordingService.js';

const recordingUrl = await fetchAndUploadRecording(
  callControlId,
  callId,
  recordingId
);
// Returns: Public URL of uploaded recording
```

### Get Recording Metadata
```javascript
import { getRecordingMetadata } from './telnyx/recordingService.js';

const metadata = await getRecordingMetadata(recordingId);
// Returns: { id, duration, channels, created_at, status }
```

### List Call Recordings
```javascript
import { listCallRecordings } from './telnyx/recordingService.js';

const recordings = await listCallRecordings(callControlId);
// Returns: Array of recording objects
```

## REST API Endpoints

### Get Call with All Data
```bash
curl http://localhost:3000/api/calls/550e8400-e29b-41d4-a716-446655440000
```

### Get Recording URL
```bash
# Public URL
curl http://localhost:3000/api/calls/{callId}/recording

# Signed URL (expires in 30 minutes)
curl "http://localhost:3000/api/calls/{callId}/recording?signed=true&expires=1800"
```

### Get Transcript
```bash
curl http://localhost:3000/api/calls/{callId}/transcript
```

### Get Summary
```bash
curl http://localhost:3000/api/calls/{callId}/summary
```

### Download Recording
```bash
curl http://localhost:3000/api/calls/{callId}/recording/download -o call.wav
```

### Export Transcript as Text
```bash
curl http://localhost:3000/api/calls/{callId}/transcript/export -o transcript.txt
```

### List Client Calls
```bash
curl "http://localhost:3000/api/clients/{clientId}/calls?limit=50&withRecordings=true"
```

### Get Client Statistics
```bash
curl http://localhost:3000/api/clients/{clientId}/calls/stats
```

### Search Transcripts
```bash
curl "http://localhost:3000/api/clients/{clientId}/calls/search?q=appointment&limit=20"
```

## Common Patterns

### Handle Missing Data Gracefully
```javascript
async function getCallInfo(callId) {
  const [recording, transcript, summary] = await Promise.all([
    getCallRecording(callId).catch(() => null),
    getCallTranscript(callId).catch(() => null),
    getCallSummary(callId).catch(() => null),
  ]);

  return { recording, transcript, summary };
}
```

### Create Download Link
```javascript
async function getDownloadLink(callId, expiresIn = 3600) {
  const recording = await getCallRecording(callId, true, expiresIn);
  return recording?.signedUrl || recording?.publicUrl;
}
```

### Search Multiple Keywords
```javascript
async function searchCalls(clientId, keywords) {
  const results = await Promise.all(
    keywords.map(kw => searchTranscripts(clientId, kw))
  );
  return results.flat();
}
```

### Export Call Data to CSV
```javascript
async function exportToCsv(clientId) {
  const calls = await getCallsByClientId(clientId, 1000);
  const csv = [
    ['Call ID', 'Date', 'Duration', 'Caller', 'Type'].join(','),
    ...calls.map(c => 
      [c.id, c.created_at, c.duration_seconds, c.caller_name, c.call_type].join(',')
    )
  ].join('\n');
  return csv;
}
```

## Error Handling

```javascript
async function safeGetRecording(callId) {
  try {
    const recording = await getCallRecording(callId);
    if (!recording) {
      console.log('No recording found');
      return null;
    }
    return recording.publicUrl;
  } catch (err) {
    console.error('Failed to get recording:', err.message);
    return null;
  }
}
```

## Monitoring SQL Queries

### Recording Coverage by Date
```sql
SELECT
  DATE(created_at) as date,
  COUNT(*) as total_calls,
  COUNT(CASE WHEN recording_url IS NOT NULL THEN 1 END) as calls_with_recordings,
  ROUND(100.0 * COUNT(CASE WHEN recording_url IS NOT NULL THEN 1 END) / COUNT(*), 2) as coverage_percent
FROM calls
GROUP BY DATE(created_at)
ORDER BY date DESC
LIMIT 30;
```

### Average Call Duration
```sql
SELECT
  call_type,
  COUNT(*) as count,
  ROUND(AVG(duration_seconds), 0) as avg_duration_seconds,
  SUM(duration_seconds) as total_seconds
FROM calls
GROUP BY call_type
ORDER BY count DESC;
```

### Appointment Booking Analysis
```sql
SELECT
  DATE(created_at) as date,
  COUNT(*) as total_calls,
  COUNT(CASE WHEN is_appointment_booked THEN 1 END) as bookings,
  ROUND(100.0 * COUNT(CASE WHEN is_appointment_booked THEN 1 END) / COUNT(*), 2) as booking_rate_percent
FROM calls
WHERE client_id = 'client-uuid'
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

## Environment Variables

Required (should already be set):
```bash
TELNYX_API_KEY=...
TELNYX_ASSISTANT_ID=...
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
REDIS_URL=...
```

## File Locations

| Purpose | File |
|---------|------|
| Storage utilities | `src/db/storage.js` |
| Recording service | `src/telnyx/recordingService.js` |
| Query functions | `src/calls/callRepository.js` |
| Call metadata | `src/calls/callCache.js` |
| Initialization | `src/db/recordingInit.js` |
| Webhook handler | `src/webhook/callEnded.js` |
| Start recording | `src/telnyx/startAssistant.js` |

## Documentation References

- **Complete Reference**: `CALL_RECORDING_SYSTEM.md`
- **Setup Guide**: `RECORDING_INTEGRATION.md`
- **API Examples**: `API_EXAMPLES.md`
- **Code Examples**: `USAGE_EXAMPLES.js`

## Troubleshooting

| Problem | Solution |
|---------|----------|
| "Recording not found" | Check Telnyx API key, verify call was recorded |
| Storage upload fails | Verify Supabase credentials, check quota |
| Transcript is NULL | Ensure AI assistant recorded the conversation |
| Signed URL expired | Generate new signed URL with longer expiry |
| Redis not available | Recording still works, but metadata may be lost |

## Performance Tips

1. **Async Processing**: Use `setImmediate` for non-blocking recording upload
2. **Batch Operations**: Query multiple calls at once
3. **Caching**: Cache frequently accessed recordings in memory
4. **CDN**: Supabase Storage has built-in CDN for fast access
5. **Compression**: Archive old recordings as MP3 or compressed WAV

---

**Last Updated**: 2024-05-22
**Version**: 1.0
