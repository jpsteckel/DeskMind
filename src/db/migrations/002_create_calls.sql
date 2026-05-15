CREATE TABLE IF NOT EXISTS calls (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id            UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,

  -- Caller Information
  caller_phone         TEXT NOT NULL,
  caller_name          TEXT,

  -- Call Content & AI Analysis
  transcript           TEXT,
  summary              TEXT,
  recording_url        TEXT, -- Path to Supabase Storage bucket
  call_type            TEXT, -- e.g., 'Appointment Booking', 'Inquiry', 'Emergency'
  is_appointment_booked BOOLEAN DEFAULT FALSE,

  -- Metrics
  duration_seconds     INTEGER NOT NULL DEFAULT 0,
  
  -- Metadata
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);