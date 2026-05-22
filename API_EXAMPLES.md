/**
 * API Endpoint Examples - Call Recording System
 * 
 * This file shows how to expose the recording functionality through Express.js API endpoints.
 * Copy and adapt these examples into your API router.
 */

// ============================================================================
// Setup (in your main Express app)
// ============================================================================

/*
import express from 'express';
import { getCallRecording, getCallTranscript, getCallSummary, searchTranscripts, getClientCallStats } from './calls/callRepository.js';

const app = express();

// Your middleware here (auth, error handling, etc.)
*/

// ============================================================================
// 1. GET /api/calls/:callId
// Retrieve complete call information including recording, transcript, summary
// ============================================================================

export function setupCallDetailsEndpoint(app) {
  app.get('/api/calls/:callId', async (req, res) => {
    try {
      const { callId } = req.params;
      const { withRecording = true, withTranscript = true, signedUrl = false } = req.query;

      // Get the basic call record
      const { getCallById } = await import('./calls/callRepository.js');
      const call = await getCallById(callId);

      if (!call) {
        return res.status(404).json({ error: 'Call not found' });
      }

      const response = {
        id: call.id,
        client_id: call.client_id,
        caller_phone: call.caller_phone,
        caller_name: call.caller_name,
        call_type: call.call_type,
        duration_seconds: call.duration_seconds,
        is_appointment_booked: call.is_appointment_booked,
        created_at: call.created_at,
        updated_at: call.updated_at,
      };

      // Include recording URL if requested
      if (withRecording && call.recording_url) {
        const recording = await getCallRecording(callId, signedUrl === 'true');
        response.recording = recording;
      }

      // Include transcript if requested
      if (withTranscript && call.transcript) {
        response.transcript = call.transcript;
        response.summary = call.summary;
      }

      res.json(response);
    } catch (err) {
      console.error('Error retrieving call:', err);
      res.status(500).json({ error: err.message });
    }
  });
}

// ============================================================================
// 2. GET /api/calls/:callId/recording
// Retrieve just the recording URL (public or signed)
// ============================================================================

export function setupRecordingEndpoint(app) {
  app.get('/api/calls/:callId/recording', async (req, res) => {
    try {
      const { callId } = req.params;
      const { signed = false, expires = 3600 } = req.query;

      const recording = await getCallRecording(
        callId,
        signed === 'true',
        parseInt(expires) || 3600
      );

      if (!recording) {
        return res.status(404).json({ error: 'No recording found for this call' });
      }

      res.json({
        callId,
        recording: recording.publicUrl,
        ...(recording.signedUrl && { signedUrl: recording.signedUrl }),
        expiresAt: recording.signedUrl ? new Date(Date.now() + parseInt(expires) * 1000).toISOString() : null,
      });
    } catch (err) {
      console.error('Error retrieving recording:', err);
      res.status(500).json({ error: err.message });
    }
  });
}

// ============================================================================
// 3. GET /api/calls/:callId/transcript
// Retrieve the complete call transcript
// ============================================================================

export function setupTranscriptEndpoint(app) {
  app.get('/api/calls/:callId/transcript', async (req, res) => {
    try {
      const transcript = await getCallTranscript(req.params.callId);

      if (!transcript) {
        return res.status(404).json({ error: 'No transcript available' });
      }

      // Format as lines for easier display
      const lines = transcript.split('\n').map((line, index) => ({
        sequence: index + 1,
        text: line,
      }));

      res.json({
        callId: req.params.callId,
        lineCount: lines.length,
        transcript: lines,
      });
    } catch (err) {
      console.error('Error retrieving transcript:', err);
      res.status(500).json({ error: err.message });
    }
  });
}

// ============================================================================
// 4. GET /api/calls/:callId/summary
// Retrieve the AI-generated call summary
// ============================================================================

export function setupSummaryEndpoint(app) {
  app.get('/api/calls/:callId/summary', async (req, res) => {
    try {
      const summary = await getCallSummary(req.params.callId);

      if (!summary) {
        return res.status(404).json({ error: 'No summary available' });
      }

      res.json({
        callId: req.params.callId,
        summary,
      });
    } catch (err) {
      console.error('Error retrieving summary:', err);
      res.status(500).json({ error: err.message });
    }
  });
}

// ============================================================================
// 5. GET /api/clients/:clientId/calls
// List all calls for a client with filtering
// ============================================================================

export function setupClientCallsEndpoint(app) {
  app.get('/api/clients/:clientId/calls', async (req, res) => {
    try {
      const { clientId } = req.params;
      const { limit = 50, withRecordings = false, withTranscripts = false, appointmentOnly = false } = req.query;

      const { getCallsByClientId } = await import('./calls/callRepository.js');
      let calls = await getCallsByClientId(clientId, parseInt(limit));

      // Filter if needed
      if (appointmentOnly === 'true') {
        calls = calls.filter(c => c.is_appointment_booked);
      }

      if (withRecordings === 'true') {
        calls = calls.filter(c => c.recording_url);
      }

      if (withTranscripts === 'true') {
        calls = calls.filter(c => c.transcript);
      }

      // Format response
      const formattedCalls = calls.map(call => ({
        id: call.id,
        caller_phone: call.caller_phone,
        caller_name: call.caller_name,
        duration_seconds: call.duration_seconds,
        call_type: call.call_type,
        is_appointment_booked: call.is_appointment_booked,
        has_recording: !!call.recording_url,
        has_transcript: !!call.transcript,
        has_summary: !!call.summary,
        created_at: call.created_at,
      }));

      res.json({
        clientId,
        total: formattedCalls.length,
        calls: formattedCalls,
      });
    } catch (err) {
      console.error('Error retrieving client calls:', err);
      res.status(500).json({ error: err.message });
    }
  });
}

// ============================================================================
// 6. GET /api/clients/:clientId/calls/stats
// Get aggregated statistics for a client's calls
// ============================================================================

export function setupClientStatsEndpoint(app) {
  app.get('/api/clients/:clientId/calls/stats', async (req, res) => {
    try {
      const stats = await getClientCallStats(req.params.clientId);

      res.json({
        clientId: req.params.clientId,
        statistics: {
          totalCalls: stats.total_calls,
          totalDurationSeconds: stats.total_duration_seconds,
          totalDurationMinutes: Math.round(stats.total_duration_seconds / 60),
          averageDurationSeconds: stats.average_duration_seconds,
          averageDurationMinutes: Math.round(stats.average_duration_seconds / 60),
          callsWithRecordings: stats.calls_with_recordings,
          recordingCoverage: `${Math.round((stats.calls_with_recordings / stats.total_calls) * 100)}%`,
          callsWithTranscripts: stats.calls_with_transcripts,
          transcriptCoverage: `${Math.round((stats.calls_with_transcripts / stats.total_calls) * 100)}%`,
          appointmentBookedCount: stats.appointment_booked_count,
          appointmentBookingRate: `${Math.round((stats.appointment_booked_count / stats.total_calls) * 100)}%`,
        },
      });
    } catch (err) {
      console.error('Error retrieving client stats:', err);
      res.status(500).json({ error: err.message });
    }
  });
}

// ============================================================================
// 7. GET /api/clients/:clientId/calls/search
// Search through call transcripts
// ============================================================================

export function setupTranscriptSearchEndpoint(app) {
  app.get('/api/clients/:clientId/calls/search', async (req, res) => {
    try {
      const { clientId } = req.params;
      const { q, limit = 20 } = req.query;

      if (!q) {
        return res.status(400).json({ error: 'Search query (q parameter) is required' });
      }

      const results = await searchTranscripts(clientId, q, parseInt(limit));

      res.json({
        clientId,
        query: q,
        resultCount: results.length,
        results: results.map(call => ({
          id: call.id,
          created_at: call.created_at,
          summary: call.summary,
          // Show snippet of transcript with query highlighted
          transcriptSnippet: call.transcript
            .split('\n')
            .find(line => line.toLowerCase().includes(q.toLowerCase())) || 'Match found in transcript',
        })),
      });
    } catch (err) {
      console.error('Error searching transcripts:', err);
      res.status(500).json({ error: err.message });
    }
  });
}

// ============================================================================
// 8. Download Recording File
// GET /api/calls/:callId/recording/download
// ============================================================================

export function setupRecordingDownloadEndpoint(app) {
  app.get('/api/calls/:callId/recording/download', async (req, res) => {
    try {
      const { callId } = req.params;
      
      const recording = await getCallRecording(callId);
      if (!recording) {
        return res.status(404).json({ error: 'Recording not found' });
      }

      // Redirect to the public URL (browser will download)
      res.redirect(recording.publicUrl);
    } catch (err) {
      console.error('Error downloading recording:', err);
      res.status(500).json({ error: err.message });
    }
  });
}

// ============================================================================
// 9. Export Transcript as Plain Text
// GET /api/calls/:callId/transcript/export
// ============================================================================

export function setupTranscriptExportEndpoint(app) {
  app.get('/api/calls/:callId/transcript/export', async (req, res) => {
    try {
      const { callId } = req.params;
      const { getCallById } = await import('./calls/callRepository.js');
      
      const call = await getCallById(callId);
      if (!call || !call.transcript) {
        return res.status(404).json({ error: 'No transcript available' });
      }

      // Export as plain text file
      res.setHeader('Content-Type', 'text/plain');
      res.setHeader('Content-Disposition', `attachment; filename="call-${callId}-transcript.txt"`);
      
      const content = `
Call ID: ${callId}
Date: ${call.created_at}
Duration: ${call.duration_seconds} seconds
Caller: ${call.caller_name || call.caller_phone}
Call Type: ${call.call_type || 'Unknown'}

SUMMARY:
${call.summary || 'No summary available'}

TRANSCRIPT:
${call.transcript}
`.trim();

      res.send(content);
    } catch (err) {
      console.error('Error exporting transcript:', err);
      res.status(500).json({ error: err.message });
    }
  });
}

// ============================================================================
// 10. Setup All Endpoints at Once
// ============================================================================

export function setupRecordingAPI(app) {
  setupCallDetailsEndpoint(app);
  setupRecordingEndpoint(app);
  setupTranscriptEndpoint(app);
  setupSummaryEndpoint(app);
  setupClientCallsEndpoint(app);
  setupClientStatsEndpoint(app);
  setupTranscriptSearchEndpoint(app);
  setupRecordingDownloadEndpoint(app);
  setupTranscriptExportEndpoint(app);

  console.log('✓ Recording API endpoints registered');
  console.log('  GET  /api/calls/:callId');
  console.log('  GET  /api/calls/:callId/recording');
  console.log('  GET  /api/calls/:callId/transcript');
  console.log('  GET  /api/calls/:callId/summary');
  console.log('  GET  /api/calls/:callId/transcript/export');
  console.log('  GET  /api/calls/:callId/recording/download');
  console.log('  GET  /api/clients/:clientId/calls');
  console.log('  GET  /api/clients/:clientId/calls/stats');
  console.log('  GET  /api/clients/:clientId/calls/search');
}

// ============================================================================
// Usage in your main app file
// ============================================================================

/*
import express from 'express';
import { setupRecordingAPI } from './api/recordingEndpoints.js';

const app = express();

// ... other setup ...

setupRecordingAPI(app);

// Start server
app.listen(3000, () => console.log('Server running on port 3000'));
*/

// ============================================================================
// Example API Calls
// ============================================================================

/*
// Get complete call information
curl "http://localhost:3000/api/calls/550e8400-e29b-41d4-a716-446655440000"

// Get just the recording with signed URL (expires in 30 minutes)
curl "http://localhost:3000/api/calls/550e8400-e29b-41d4-a716-446655440000/recording?signed=true&expires=1800"

// Get transcript
curl "http://localhost:3000/api/calls/550e8400-e29b-41d4-a716-446655440000/transcript"

// Get summary
curl "http://localhost:3000/api/calls/550e8400-e29b-41d4-a716-446655440000/summary"

// Search transcripts for keyword
curl "http://localhost:3000/api/clients/client-uuid/calls/search?q=appointment"

// Get client statistics
curl "http://localhost:3000/api/clients/client-uuid/calls/stats"

// List all calls for a client
curl "http://localhost:3000/api/clients/client-uuid/calls?limit=50&withRecordings=true"

// Download recording
curl "http://localhost:3000/api/calls/550e8400-e29b-41d4-a716-446655440000/recording/download" -o call.wav

// Export transcript
curl "http://localhost:3000/api/calls/550e8400-e29b-41d4-a716-446655440000/transcript/export" -o transcript.txt
*/
