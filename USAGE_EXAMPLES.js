/**
 * Complete Example: Using the Call Recording System
 * 
 * This is a full working example showing how to integrate the recording system
 * into a Node.js/Express application.
 */

// ============================================================================
// EXAMPLE 1: App Initialization
// ============================================================================

// In your main index.js or app.js file:

/*
import express from 'express';
import { initializeRecordingSystem } from './db/recordingInit.js';
import { setupRecordingAPI } from './api/recordingEndpoints.js';

const app = express();
app.use(express.json());

// Initialize recording system during app startup
async function startApp() {
  try {
    console.log('Starting DeskMind...');
    
    // Initialize recording system (creates storage buckets, etc.)
    await initializeRecordingSystem();
    console.log('✓ Recording system initialized');
    
    // Setup API endpoints
    setupRecordingAPI(app);
    
    // Start server
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      console.log(`✓ Server running on port ${PORT}`);
      console.log('✓ Ready to handle calls');
    });
  } catch (err) {
    console.error('Failed to start app:', err);
    process.exit(1);
  }
}

startApp();
*/

// ============================================================================
// EXAMPLE 2: Programmatic Usage
// ============================================================================

// Using the recording system directly in your code:

export async function exampleUsage() {
  const { 
    getCallRecording, 
    getCallTranscript, 
    getCallSummary,
    searchTranscripts,
    getClientCallStats
  } = await import('./calls/callRepository.js');

  // Assume we have a call ID from the database
  const callId = '550e8400-e29b-41d4-a716-446655440000';
  const clientId = 'client-uuid-here';

  // 1. Get complete call information
  console.log('--- Getting Call Information ---');
  const recording = await getCallRecording(callId);
  console.log('Recording URL:', recording?.publicUrl);

  const transcript = await getCallTranscript(callId);
  console.log('Transcript preview:', transcript?.substring(0, 100) + '...');

  const summary = await getCallSummary(callId);
  console.log('Summary:', summary);

  // 2. Get signed URL for secure access (expires in 1 hour)
  console.log('\n--- Getting Secure URL ---');
  const secureRecording = await getCallRecording(callId, true, 3600);
  console.log('Signed URL:', secureRecording?.signedUrl);
  console.log('Valid for: 1 hour');

  // 3. Search client's transcripts
  console.log('\n--- Searching Transcripts ---');
  const appointmentCalls = await searchTranscripts(clientId, 'appointment', 10);
  console.log(`Found ${appointmentCalls.length} calls mentioning "appointment"`);
  appointmentCalls.forEach(call => {
    console.log(`  - Call ${call.id}: ${call.summary}`);
  });

  // 4. Get client statistics
  console.log('\n--- Client Statistics ---');
  const stats = await getClientCallStats(clientId);
  console.log(`Total calls: ${stats.total_calls}`);
  console.log(`Total duration: ${stats.total_duration_seconds} seconds`);
  console.log(`Average duration: ${stats.average_duration_seconds} seconds`);
  console.log(`Calls with recordings: ${stats.calls_with_recordings}/${stats.total_calls}`);
  console.log(`Recording coverage: ${Math.round((stats.calls_with_recordings / stats.total_calls) * 100)}%`);
  console.log(`Appointment booking rate: ${Math.round((stats.appointment_booked_count / stats.total_calls) * 100)}%`);
}

// ============================================================================
// EXAMPLE 3: Building a Call Analytics Dashboard
// ============================================================================

export async function buildAnalyticsDashboard(clientId) {
  const {
    getClientCallStats,
    getCallsByClientId,
    searchTranscripts
  } = await import('./calls/callRepository.js');

  // Get all statistics
  const stats = await getClientCallStats(clientId);
  const calls = await getCallsByClientId(clientId, 100);

  // Build dashboard data
  const dashboard = {
    overview: {
      totalCalls: stats.total_calls,
      totalDurationMinutes: Math.round(stats.total_duration_seconds / 60),
      averageDurationMinutes: Math.round(stats.average_duration_seconds / 60),
      recordingCoverage: `${Math.round((stats.calls_with_recordings / stats.total_calls) * 100)}%`,
      transcriptCoverage: `${Math.round((stats.calls_with_transcripts / stats.total_calls) * 100)}%`,
    },
    appointments: {
      bookedCount: stats.appointment_booked_count,
      bookingRate: `${Math.round((stats.appointment_booked_count / stats.total_calls) * 100)}%`,
    },
    callBreakdown: {
      byType: groupBy(calls, 'call_type'),
      recentCalls: calls.slice(0, 10).map(c => ({
        id: c.id,
        date: c.created_at,
        caller: c.caller_name || c.caller_phone,
        duration: c.duration_seconds,
        type: c.call_type,
        hasRecording: !!c.recording_url,
      })),
    },
    keywords: await getTopKeywords(clientId),
  };

  return dashboard;
}

function groupBy(array, key) {
  return array.reduce((result, item) => {
    const group = item[key] || 'Unknown';
    result[group] = (result[group] || 0) + 1;
    return result;
  }, {});
}

async function getTopKeywords(clientId) {
  const { getClientTranscripts } = await import('./calls/callRepository.js');
  const transcripts = await getClientTranscripts(clientId);
  
  // Simple keyword extraction (in production, use NLP library)
  const keywords = {};
  const commonWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'is', 'was', 'are']);
  
  transcripts.forEach(call => {
    if (call.transcript) {
      call.transcript.split(/\s+/).forEach(word => {
        const clean = word.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (clean.length > 4 && !commonWords.has(clean)) {
          keywords[clean] = (keywords[clean] || 0) + 1;
        }
      });
    }
  });

  return Object.entries(keywords)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([keyword, count]) => ({ keyword, count }));
}

// ============================================================================
// EXAMPLE 4: Webhook Handler with Recording Integration
// ============================================================================

export async function handleCallEndedWebhook(payload) {
  const { 
    call_control_id,
    conversation_id,
    duration_secs,
    recording_id 
  } = payload;

  console.log(`Call ended: ${call_control_id}, duration: ${duration_secs}s`);

  // The handleCallEnded function is automatically called by the webhook router
  // but here's what happens under the hood:
  
  // 1. Fetch conversation details from Telnyx
  // 2. Create call record with transcript, summary
  // 3. Fetch recording from Telnyx
  // 4. Upload to Supabase Storage
  // 5. Store URL in database
  
  console.log('✓ Call record created with recording');
}

// ============================================================================
// EXAMPLE 5: Exporting Call Data for Compliance
// ============================================================================

export async function exportCallDataForCompliance(clientId, fromDate, toDate) {
  const { getCallsByClientId } = await import('./calls/callRepository.js');
  const supabase = (await import('./db/supabase.js')).default;
  
  // Get all calls in date range
  const { data: calls } = await supabase
    .from('calls')
    .select('*')
    .eq('client_id', clientId)
    .gte('created_at', fromDate)
    .lte('created_at', toDate)
    .order('created_at');

  // Build CSV-friendly export
  const csvData = calls.map(call => ({
    'Call ID': call.id,
    'Date': call.created_at,
    'Caller Phone': call.caller_phone,
    'Caller Name': call.caller_name,
    'Duration (seconds)': call.duration_seconds,
    'Call Type': call.call_type,
    'Appointment Booked': call.is_appointment_booked ? 'Yes' : 'No',
    'Has Recording': call.recording_url ? 'Yes' : 'No',
    'Has Transcript': call.transcript ? 'Yes' : 'No',
    'Recording URL': call.recording_url || '',
  }));

  return csvData;
}

// ============================================================================
// EXAMPLE 6: Automated Cleanup of Old Recordings
// ============================================================================

export async function cleanupOldRecordings(daysToKeep = 90) {
  const { deleteFile } = await import('./db/storage.js');
  const { updateCall } = await import('./calls/callRepository.js');
  const supabase = (await import('./db/supabase.js')).default;

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

  console.log(`Cleaning up recordings older than ${daysToKeep} days...`);

  // Find old calls with recordings
  const { data: oldCalls } = await supabase
    .from('calls')
    .select('id, recording_url')
    .lt('created_at', cutoffDate.toISOString())
    .not('recording_url', 'is', null)
    .limit(100);

  let deleted = 0;
  for (const call of oldCalls || []) {
    try {
      // Extract file path from URL
      const filePath = extractFilePathFromUrl(call.recording_url);
      
      // Delete from Supabase Storage
      await deleteFile('call-recordings', filePath);
      
      // Clear recording_url in database
      await updateCall(call.id, { recording_url: null });
      
      deleted++;
    } catch (err) {
      console.error(`Failed to delete recording for call ${call.id}:`, err);
    }
  }

  console.log(`✓ Deleted ${deleted} old recordings`);
}

function extractFilePathFromUrl(url) {
  // Extract path from URL: https://.../.../call-recordings/2024-05-22/file.wav
  // Return: 2024-05-22/file.wav
  const matches = url.match(/call-recordings\/(.+)$/);
  return matches ? matches[1] : url;
}

// ============================================================================
// EXAMPLE 7: Setting Up Scheduled Tasks
// ============================================================================

export function setupScheduledTasks() {
  // You can use node-cron or similar package for this
  
  // Run cleanup daily at 2 AM
  // cron.schedule('0 2 * * *', async () => {
  //   console.log('Running scheduled cleanup...');
  //   await cleanupOldRecordings(90);
  // });

  // Run stats aggregation hourly
  // cron.schedule('0 * * * *', async () => {
  //   console.log('Updating call statistics...');
  //   // Your aggregation logic here
  // });
}

// ============================================================================
// EXAMPLE 8: React Component for Playing Call Recording
// ============================================================================

export function RecordingPlayerComponent() {
  return `
<!DOCTYPE html>
<html>
<head>
  <title>Call Recording Player</title>
  <style>
    .recording-player {
      padding: 20px;
      background: #f5f5f5;
      border-radius: 8px;
      max-width: 600px;
    }
    audio {
      width: 100%;
      margin: 10px 0;
    }
    .call-info {
      background: white;
      padding: 15px;
      border-radius: 4px;
      margin: 10px 0;
    }
    .transcript {
      background: white;
      padding: 15px;
      border-radius: 4px;
      max-height: 300px;
      overflow-y: auto;
      margin: 10px 0;
    }
    .line {
      margin: 8px 0;
      padding: 8px;
      border-left: 3px solid #007bff;
      padding-left: 12px;
    }
  </style>
</head>
<body>
  <div class="recording-player">
    <h2>Call Recording</h2>
    
    <div class="call-info">
      <p><strong>Caller:</strong> <span id="caller">Loading...</span></p>
      <p><strong>Duration:</strong> <span id="duration">Loading...</span></p>
      <p><strong>Type:</strong> <span id="type">Loading...</span></p>
    </div>

    <h3>Recording</h3>
    <audio id="player" controls></audio>

    <h3>Transcript</h3>
    <div class="transcript" id="transcript">
      Loading transcript...
    </div>

    <h3>Summary</h3>
    <div class="call-info" id="summary">
      Loading summary...
    </div>
  </div>

  <script>
    const callId = new URLSearchParams(window.location.search).get('callId');
    
    async function loadCallData() {
      const response = await fetch(\`/api/calls/\${callId}\`);
      const data = await response.json();

      document.getElementById('caller').textContent = data.caller_name || data.caller_phone;
      document.getElementById('duration').textContent = \`\${data.duration_seconds}s\`;
      document.getElementById('type').textContent = data.call_type || 'Unknown';

      if (data.recording) {
        document.getElementById('player').src = data.recording.publicUrl;
      }

      document.getElementById('transcript').innerHTML = data.transcript
        ? data.transcript.split('\\n').map(line => 
            \`<div class="line">\${line}</div>\`
          ).join('')
        : 'No transcript available';

      document.getElementById('summary').textContent = data.summary || 'No summary available';
    }

    loadCallData();
  </script>
</body>
</html>
`;
}

// ============================================================================
// EXAMPLE 9: Generating a Call Report
// ============================================================================

export async function generateCallReport(clientId, format = 'json') {
  const {
    getClientCallStats,
    getClientTranscripts,
    getCallsByClientId
  } = await import('./calls/callRepository.js');

  const stats = await getClientCallStats(clientId);
  const recentCalls = await getCallsByClientId(clientId, 30);
  const transcripts = await getClientTranscripts(clientId, 10);

  const report = {
    clientId,
    generatedAt: new Date().toISOString(),
    statistics: stats,
    recentCalls: recentCalls.map(c => ({
      id: c.id,
      date: c.created_at,
      caller: c.caller_name || c.caller_phone,
      duration: c.duration_seconds,
      type: c.call_type,
      hasRecording: !!c.recording_url,
    })),
    topTranscripts: transcripts.map(t => ({
      callId: t.id,
      summary: t.summary,
      wordCount: t.transcript ? t.transcript.split(/\s+/).length : 0,
    })),
  };

  if (format === 'html') {
    return generateHtmlReport(report);
  }
  return report;
}

function generateHtmlReport(report) {
  return `
<html>
<head>
  <title>Call Report</title>
  <style>
    body { font-family: Arial; margin: 20px; }
    table { border-collapse: collapse; width: 100%; margin: 20px 0; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background-color: #f2f2f2; }
    h1 { color: #333; }
  </style>
</head>
<body>
  <h1>Call Report - ${report.clientId}</h1>
  <p>Generated: ${report.generatedAt}</p>

  <h2>Statistics</h2>
  <p>Total Calls: ${report.statistics.total_calls}</p>
  <p>Average Duration: ${report.statistics.average_duration_seconds}s</p>
  <p>Recording Coverage: ${Math.round((report.statistics.calls_with_recordings / report.statistics.total_calls) * 100)}%</p>

  <h2>Recent Calls</h2>
  <table>
    <tr>
      <th>Date</th>
      <th>Caller</th>
      <th>Duration</th>
      <th>Type</th>
      <th>Recording</th>
    </tr>
    ${report.recentCalls.map(c => `
    <tr>
      <td>${c.date}</td>
      <td>${c.caller}</td>
      <td>${c.duration}s</td>
      <td>${c.type || '-'}</td>
      <td>${c.hasRecording ? '✓' : '✗'}</td>
    </tr>
    `).join('')}
  </table>
</body>
</html>
`;
}

// ============================================================================
// EXAMPLE 10: Error Handling Best Practices
// ============================================================================

export async function safeGetCallData(callId) {
  try {
    const { getCallRecording, getCallTranscript, getCallSummary } = 
      await import('./calls/callRepository.js');

    // All of these return null if data doesn't exist
    const recording = await getCallRecording(callId);
    const transcript = await getCallTranscript(callId);
    const summary = await getCallSummary(callId);

    return {
      success: true,
      recording: recording?.publicUrl || null,
      transcript: transcript || null,
      summary: summary || null,
    };
  } catch (err) {
    console.error(`Error retrieving call data for ${callId}:`, err);
    return {
      success: false,
      error: err.message,
      recording: null,
      transcript: null,
      summary: null,
    };
  }
}

console.log('✓ Example implementations loaded and ready to use');
